"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { rebuildLegs } from "@/lib/legs";
import { routeLeg, type LineString } from "@/lib/routing";
import { fetchPostMeta, parseInstagramUrl, SHORTCODE_RE } from "@/lib/instagram";
import { lagosDay, shortcodeDate, stopForDay } from "@/lib/igDate";
import { JOURNEY_TAG, RAISED_TAG } from "@/lib/site";

export type ActionState = { ok?: string; error?: string } | null;

async function requireAdmin() {
  const db = await createSessionClient();
  const { data } = await db.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();
  if (!email) redirect("/admin/login");
  const { data: admin } = await db.from("admins").select("email").eq("email", email).maybeSingle();
  if (!admin) throw new Error("Not an admin");
  return { db, email };
}

type Db = Awaited<ReturnType<typeof requireAdmin>>["db"];

// Every write: log it, bump "Updated x ago", and expire the public cache.
async function done(db: Db, email: string, action: string, entity: string, entityId: string | null, payload?: unknown) {
  await db.from("audit_log").insert({ actor_email: email, action, entity, entity_id: entityId, payload: payload ?? null });
  await db.from("site_state").update({ updated_at: new Date().toISOString() }).eq("id", 1);
  revalidateTag(JOURNEY_TAG, { expire: 0 });
  revalidatePath("/admin", "layout");
}

function fail(e: unknown): ActionState {
  if (e instanceof z.ZodError) return { error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  if (e && typeof e === "object" && "digest" in e) throw e; // let redirect() through
  return { error: e instanceof Error ? e.message : String(e) };
}

const blank = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : v);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

// ------------------------------------------------------------ site state

const SiteSchema = z.object({
  status: z.enum(["on_the_road", "at_base", "paused"]),
  raised_usd: z.coerce.number().min(0),
  next_country_iso2: z.string().length(2).nullable(),
  count_home: z.boolean(),
});

export async function updateSiteState(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const input = SiteSchema.parse({
      status: form.get("status"),
      raised_usd: form.get("raised_usd"),
      next_country_iso2: blank(form.get("next_country_iso2")),
      count_home: form.get("count_home") === "on",
    });
    const { data: before } = await db.from("site_state").select("raised_usd").eq("id", 1).single();
    const raisedChanged = Number(before?.raised_usd) !== input.raised_usd;
    const { error } = await db
      .from("site_state")
      .update({ ...input, ...(raisedChanged ? { raised_updated_at: new Date().toISOString() } : {}) })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    await done(db, email, "update", "site_state", "1", input);
    return { ok: "Saved. The public site updates on its next visit." };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ stops

const StopSchema = z.object({
  id: z.string().uuid().nullable(),
  expedition_id: z.string().uuid(),
  city: z.string().trim().min(1).max(120),
  country_iso2: z.string().regex(/^[A-Z]{2}$/),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  arrived_on: dateStr,
  left_on: dateStr.nullable(),
  arrival_mode: z.enum(["drive", "ferry", "flight", "ship"]),
  caption: z.string().trim().max(600).nullable(),
  is_reconstructed: z.boolean(),
});

function parseStop(form: FormData) {
  return StopSchema.parse({
    id: blank(form.get("id")),
    expedition_id: form.get("expedition_id"),
    city: form.get("city"),
    country_iso2: String(form.get("country_iso2") ?? "").toUpperCase(),
    // City-level precision only (~100 m), never a raw GPS point.
    lat: Math.round(Number(form.get("lat")) * 1000) / 1000,
    lng: Math.round(Number(form.get("lng")) * 1000) / 1000,
    arrived_on: form.get("arrived_on"),
    left_on: blank(form.get("left_on")),
    arrival_mode: form.get("arrival_mode"),
    caption: blank(form.get("caption")),
    is_reconstructed: form.get("is_reconstructed") === "on",
  });
}

export async function saveStop(_: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const { db, email } = await requireAdmin();
    const { id: existingId, ...input } = parseStop(form);
    if (input.left_on && input.left_on < input.arrived_on) throw new Error("Left on is before arrived on");

    let previousExpedition: string | null = null;
    if (existingId) {
      const { data: old } = await db.from("stops").select("expedition_id").eq("id", existingId).single();
      previousExpedition = old?.expedition_id ?? null;
      const { error } = await db.from("stops").update(input).eq("id", existingId);
      if (error) throw new Error(error.message);
      id = existingId;
    } else {
      const { data, error } = await db.from("stops").insert(input).select("id").single();
      if (error) throw new Error(error.message);
      id = data.id;
    }

    const { fallbacks } = await rebuildLegs(db, input.expedition_id);
    if (previousExpedition && previousExpedition !== input.expedition_id) await rebuildLegs(db, previousExpedition);
    await db.rpc("refresh_country_status");
    await done(db, email, existingId ? "update" : "create", "stop", id, input);
    if (fallbacks) return { ok: "Saved, but routing failed for a leg, so it is drawn as a straight line. Re-save the stop later to retry." };
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/stops/${id}?saved=1`);
}

export async function deleteStop(form: FormData) {
  const { db, email } = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const { data: stop } = await db.from("stops").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("expedition_id").single();
  if (stop) await rebuildLegs(db, stop.expedition_id);
  await db.rpc("refresh_country_status");
  await done(db, email, "delete", "stop", id);
  redirect("/admin/stops");
}

export async function restoreStop(form: FormData) {
  const { db, email } = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const { data: stop } = await db.from("stops").update({ deleted_at: null }).eq("id", id).select("expedition_id").single();
  if (stop) await rebuildLegs(db, stop.expedition_id);
  await db.rpc("refresh_country_status");
  await done(db, email, "restore", "stop", id);
}

export type Preview = { geometry: LineString; distanceKm: number; isFallback: boolean; from: { city: string; lat: number; lng: number } | null } | { error: string };

// Draws the leg the stop would create, without saving anything.
export async function previewRoute(input: {
  stopId: string | null;
  expeditionId: string;
  lat: number;
  lng: number;
  arrivedOn: string;
  mode: "drive" | "ferry" | "flight" | "ship";
}): Promise<Preview> {
  try {
    const { db } = await requireAdmin();
    let q = db
      .from("stops")
      .select("id,city,lat,lng")
      .eq("expedition_id", input.expeditionId)
      .is("deleted_at", null)
      .lte("arrived_on", input.arrivedOn)
      .order("arrived_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (input.stopId) q = q.neq("id", input.stopId);
    const { data } = await q;
    const from = data?.[0] ?? null;
    if (!from) {
      return { geometry: { type: "LineString", coordinates: [[input.lng, input.lat], [input.lng, input.lat]] }, distanceKm: 0, isFallback: false, from: null };
    }
    const r = await routeLeg([from.lng, from.lat], [input.lng, input.lat], input.mode);
    return { ...r, from: { city: from.city, lat: from.lat, lng: from.lng } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------ posts

export async function addPost(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const parsed = parseInstagramUrl(String(form.get("url") ?? ""));
    if (!parsed) throw new Error("That isn't an Instagram post or reel link");
    const stopId = blank(form.get("stop_id")) as string | null;
    const countryIso = blank(form.get("country_iso2")) as string | null;
    const { count } = await db.from("posts").select("id", { count: "exact", head: true }).is("deleted_at", null);
    const row = {
      url: parsed.url,
      shortcode: parsed.shortcode,
      kind: parsed.kind,
      author: (blank(form.get("author")) as string | null) ?? parsed.author ?? "michaelspyder",
      posted_on: blank(form.get("posted_on")),
      caption: blank(form.get("caption")),
      stop_id: stopId,
      country_iso2: countryIso,
      sort: count ?? 0,
    };
    const { data, error } = await db.from("posts").insert(row).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "That post is already on the site" : error.message);
    await done(db, email, "create", "post", data.id, row);
    return { ok: "Post added." };
  } catch (e) {
    return fail(e);
  }
}

// One-click sync: posts and reels collected from Michael's profile by the
// "Send to Spydey" bookmark (or pasted). New ones are dated from their
// shortcodes and filed under the stop he was at that day. Posts already on the
// site, or deleted from it before, are left alone.
const ImportItems = z
  .array(z.object({ kind: z.enum(["post", "reel"]), code: z.string().regex(SHORTCODE_RE) }))
  .min(1)
  .max(200);

export async function importPosts(items: { kind: "post" | "reel"; code: string }[]): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const list = ImportItems.parse(items);
    const codes = [...new Set(list.map((i) => i.code))];
    const [{ data: known }, { data: stops }] = await Promise.all([
      db.from("posts").select("shortcode").in("shortcode", codes),
      db.from("stops").select("id,country_iso2,arrived_on").is("deleted_at", null),
    ]);
    const skip = new Set((known ?? []).map((k) => k.shortcode));
    const fresh = list.filter((i, n) => !skip.has(i.code) && list.findIndex((j) => j.code === i.code) === n);
    if (!fresh.length) return { ok: "Nothing new: those posts are already on the site." };

    const rows = await Promise.all(
      fresh.map(async (i) => {
        const url = `https://www.instagram.com/${i.kind === "post" ? "p" : "reel"}/${i.code}/`;
        const when = shortcodeDate(i.code);
        const day = when ? lagosDay(when) : null;
        const stop = day ? stopForDay(stops ?? [], day) : null;
        const meta = await fetchPostMeta(url);
        return {
          url,
          shortcode: i.code,
          kind: i.kind,
          author: meta?.author ?? "michaelspyder",
          caption: meta?.caption ?? null,
          posted_on: day,
          stop_id: stop?.id ?? null,
          country_iso2: stop?.country_iso2 ?? null,
          // Newer posts sort after older ones (seconds since 2026).
          sort: when ? Math.floor(when.getTime() / 1000) - 1_767_225_600 : 0,
        };
      }),
    );
    const { error } = await db.from("posts").insert(rows);
    if (error) throw new Error(error.message);
    await done(db, email, "import", "posts", null, { count: rows.length, codes: rows.map((r) => r.shortcode) });
    return { ok: `Imported ${rows.length} ${rows.length === 1 ? "post" : "posts"}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePost(form: FormData) {
  const { db, email } = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  await db.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await done(db, email, "delete", "post", id);
}

// ------------------------------------------------------------ countries

export async function updateCountry(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const iso2 = z.string().regex(/^[A-Z]{2}$/).parse(form.get("iso2"));
    const highlight = blank(form.get("ig_highlight_url")) as string | null;
    if (highlight && !/^https:\/\/(www\.)?instagram\.com\//.test(highlight)) throw new Error("Highlight must be an instagram.com link");
    const input = { cancer_fact: blank(form.get("cancer_fact")), ig_highlight_url: highlight };
    const { error } = await db.from("countries").update(input).eq("iso2", iso2);
    if (error) throw new Error(error.message);
    await done(db, email, "update", "country", iso2, input);
    return { ok: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ sponsors

const SponsorSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(80),
  panel: z.string().trim().min(1),
  tier: z.string().trim().min(1).max(40),
  link: z.string().url().nullable(),
  // A hosted image, or one shipped with the site (e.g. /sponsors/c9x.webp).
  logo_url: z.union([z.string().url(), z.string().regex(/^\/[\w./-]+$/)]).nullable(),
  active: z.boolean(),
});

export async function saveSponsor(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const { id, ...input } = SponsorSchema.parse({
      id: blank(form.get("id")),
      name: form.get("name"),
      panel: form.get("panel"),
      tier: form.get("tier") || "partner",
      link: blank(form.get("link")),
      logo_url: blank(form.get("logo_url")),
      active: form.get("active") === "on",
    });
    const res = id ? await db.from("sponsors").update(input).eq("id", id).select("id").single() : await db.from("sponsors").insert(input).select("id").single();
    if (res.error) throw new Error(res.error.message);
    await done(db, email, id ? "update" : "create", "sponsor", res.data.id, input);
    return { ok: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSponsor(form: FormData) {
  const { db, email } = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  await db.from("sponsors").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await done(db, email, "delete", "sponsor", id);
}

// ------------------------------------------------------------ expeditions

export async function saveExpedition(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const id = blank(form.get("id")) as string | null;
    const input = z
      .object({ name: z.string().trim().min(1).max(120), start_date: dateStr, end_date: dateStr.nullable(), summary: z.string().trim().max(600).nullable() })
      .parse({ name: form.get("name"), start_date: form.get("start_date"), end_date: blank(form.get("end_date")), summary: blank(form.get("summary")) });
    if (input.end_date && input.end_date < input.start_date) throw new Error("End date is before start date");
    const res = id
      ? await db.from("expeditions").update({ ...input, is_placeholder: form.get("is_placeholder") === "on" }).eq("id", id).select("id").single()
      : await db.from("expeditions").insert(input).select("id").single();
    if (res.error) throw new Error(res.error.message);
    await done(db, email, id ? "update" : "create", "expedition", res.data.id, input);
    return { ok: id ? "Saved." : "Expedition started." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpedition(form: FormData) {
  const { db, email } = await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const now = new Date().toISOString();
  await db.from("expeditions").update({ deleted_at: now }).eq("id", id);
  await db.from("stops").update({ deleted_at: now }).eq("expedition_id", id).is("deleted_at", null);
  await db.from("legs").delete().eq("expedition_id", id);
  await db.rpc("refresh_country_status");
  await done(db, email, "delete", "expedition", id);
}

export async function signOut() {
  const db = await createSessionClient();
  await db.auth.signOut();
  redirect("/admin/login");
}

// ------------------------------------------------------------ raised

export async function refreshRaised() {
  await requireAdmin();
  revalidateTag(RAISED_TAG, { expire: 0 });
  revalidatePath("/admin");
}

// ------------------------------------------------------------ photos

// Sets (or clears) the trail-preview picture for a country or a stop. `value`
// is an uploaded file's public URL, an Instagram post/reel link, or "".
export async function setPhoto(input: { kind: "country" | "stop"; id: string; value: string }): Promise<ActionState> {
  try {
    const { db, email } = await requireAdmin();
    const raw = input.value.trim();
    let url: string | null = null;
    if (raw) {
      const ig = parseInstagramUrl(raw);
      if (ig) url = `/ig/${ig.shortcode}`;
      else if (/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/photos\//.test(raw) || raw.startsWith("/photos/")) url = raw;
      else throw new Error("Use an uploaded photo or an Instagram post or reel link");
    }
    const res =
      input.kind === "country"
        ? await db.from("countries").update({ photo_url: url }).eq("iso2", z.string().regex(/^[A-Z]{2}$/).parse(input.id))
        : await db.from("stops").update({ photo_url: url }).eq("id", z.string().uuid().parse(input.id));
    if (res.error) throw new Error(res.error.message);
    await done(db, email, url ? "set photo" : "clear photo", input.kind, input.id, { url });
    return { ok: url ? "Photo saved." : "Photo removed." };
  } catch (e) {
    return fail(e);
  }
}
