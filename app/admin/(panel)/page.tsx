import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import { fmtUsd, timeAgo } from "@/lib/format";
import { fetchCampaignTotals, ngnToUsd } from "@/lib/oncrowdr";
import ActionForm, { Field } from "@/components/admin/ActionForm";
import Analytics, { type Summary } from "@/components/admin/Analytics";
import { refreshRaised, updateSiteState } from "../actions";

export default async function Dashboard() {
  const { db } = await getAdmin();
  const [{ data: site }, { data: countries }, { data: log }, { data: current }, live, { data: analytics }] = await Promise.all([
    db.from("site_state").select("*").eq("id", 1).single(),
    db.from("countries").select("iso2,name").order("name"),
    db.from("audit_log").select("actor_email,action,entity,created_at").order("created_at", { ascending: false }).limit(8),
    db.from("countries").select("name").eq("status", "current").maybeSingle(),
    fetchCampaignTotals(),
    db.rpc("analytics_summary", { p_days: 30 }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="hud p-3">
          <div className="label">Current</div>
          <div className="truncate">{current?.name ?? "None"}</div>
        </div>
        <div className="hud p-3">
          <div className="label">Raised (Oncrowdr, live)</div>
          <div className="font-mono">{live ? `$${ngnToUsd(live.ngn).toLocaleString("en-US")}` : "unreachable"}</div>
        </div>
        <div className="hud p-3">
          <div className="label">Donors</div>
          <div className="font-mono">{live ? live.donors.toLocaleString("en-US") : "n/a"}</div>
        </div>
        <div className="hud p-3">
          <div className="label">Site updated</div>
          <div className="font-mono text-sm">{site ? timeAgo(site.updated_at) : "n/a"}</div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Visitors and Donate clicks</h2>
        <Analytics data={(analytics as Summary | null) ?? null} />
      </section>

      <Link href="/admin/stops/new" className="btn-primary text-center">
        + Add a stop
      </Link>

      <section className="flex flex-wrap items-center justify-between gap-3 border border-line p-3 text-sm">
        <span className="text-muted">
          The public site reads the Oncrowdr total automatically every 6 hours.
          {live && ` Right now: $${ngnToUsd(live.ngn).toLocaleString("en-US")} of ${fmtUsd(ngnToUsd(live.goalNgn))} (₦${live.ngn.toLocaleString("en-US")} ÷ 1,400, rounded up).`}
        </span>
        <form action={refreshRaised}>
          <button className="btn">Refresh now</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Status</h2>
        <ActionForm action={updateSiteState}>
          <Field label="Status">
            <select name="status" defaultValue={site?.status} className="field">
              <option value="on_the_road">On the road</option>
              <option value="at_base">At base (between expeditions)</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
          <Field label="Fallback amount raised (USD)" hint="Only shown if Oncrowdr can't be reached.">
            <input name="raised_usd" type="number" min="0" step="1" inputMode="numeric" defaultValue={Number(site?.raised_usd ?? 0)} className="field font-mono" />
          </Field>
          <Field label="Next country (teaser shown while at base)">
            <select name="next_country_iso2" defaultValue={site?.next_country_iso2 ?? ""} className="field">
              <option value="">None</option>
              {countries?.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="count_home" defaultChecked={site?.count_home} className="accent-orange" />
            Count Nigeria (home) toward the x/54 total
          </label>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent changes</h2>
        <ul className="flex flex-col divide-y divide-line border-y border-line text-sm">
          {log?.length ? (
            log.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span>
                  {l.action} {l.entity}
                </span>
                <span className="label">
                  {l.actor_email?.split("@")[0]} · {timeAgo(l.created_at)}
                </span>
              </li>
            ))
          ) : (
            <li className="label py-2">Nothing yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
