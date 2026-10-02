import type { SupabaseClient } from "@supabase/supabase-js";
import { routeLeg, type Mode } from "./routing";

type StopRow = { id: string; lat: number; lng: number; arrival_mode: Mode };

// Makes the legs of one expedition match its stops in date order. Existing
// legs are kept when their pair and mode are unchanged, so OSRM is only
// called for new or changed pairs. Mirrors scripts/db-apply.mjs.
export async function rebuildLegs(db: SupabaseClient, expeditionId: string) {
  const { data: stops, error } = await db
    .from("stops")
    .select("id,lat,lng,arrival_mode")
    .eq("expedition_id", expeditionId)
    .is("deleted_at", null)
    .order("arrived_on")
    .order("created_at");
  if (error) throw new Error(error.message);

  const { data: legs } = await db.from("legs").select("id,from_stop_id,to_stop_id,mode").eq("expedition_id", expeditionId);
  const existing = new Map((legs ?? []).map((l) => [`${l.from_stop_id}>${l.to_stop_id}`, l]));
  const keep = new Set<string>();
  const fallbacks: number[] = [];

  const rows = stops as StopRow[];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const found = existing.get(`${a.id}>${b.id}`);
    if (found && found.mode === b.arrival_mode) {
      keep.add(found.id);
      continue;
    }
    const r = await routeLeg([a.lng, a.lat], [b.lng, b.lat], b.arrival_mode);
    if (r.isFallback) fallbacks.push(i);
    const { data: leg, error: upsertError } = await db
      .from("legs")
      .upsert(
        {
          expedition_id: expeditionId,
          from_stop_id: a.id,
          to_stop_id: b.id,
          mode: b.arrival_mode,
          geometry: r.geometry,
          distance_km: r.distanceKm,
          is_fallback: r.isFallback,
        },
        { onConflict: "from_stop_id,to_stop_id" },
      )
      .select("id")
      .single();
    if (upsertError) throw new Error(upsertError.message);
    keep.add(leg.id);
  }

  const stale = (legs ?? []).filter((l) => !keep.has(l.id)).map((l) => l.id);
  if (stale.length) await db.from("legs").delete().in("id", stale);
  return { fallbacks: fallbacks.length };
}
