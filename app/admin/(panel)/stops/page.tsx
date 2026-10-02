import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import { fmtRange, MODE_LABEL } from "@/lib/format";
import Flag from "@/components/Flag";
import { restoreStop } from "../../actions";

export default async function StopsPage() {
  const { db } = await getAdmin();
  const [{ data: expeditions }, { data: stops }, { data: legs }] = await Promise.all([
    db.from("expeditions").select("id,name,start_date,end_date,is_placeholder").is("deleted_at", null).order("start_date", { ascending: false }),
    db.from("stops").select("id,expedition_id,city,country_iso2,arrived_on,left_on,arrival_mode,deleted_at").order("arrived_on").order("created_at"),
    db.from("legs").select("to_stop_id,distance_km,is_fallback"),
  ]);
  const legBy = new Map(legs?.map((l) => [l.to_stop_id, l]));
  const deleted = stops?.filter((s) => s.deleted_at) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stops</h1>
        <Link href="/admin/stops/new" className="btn-primary">
          + Add stop
        </Link>
      </div>

      {expeditions?.length === 0 && (
        <p className="text-sm text-muted">
          No expeditions yet. <Link href="/admin/expeditions" className="text-orange underline">Start one</Link> first.
        </p>
      )}

      {expeditions?.map((e) => {
        const list = stops?.filter((s) => s.expedition_id === e.id && !s.deleted_at) ?? [];
        return (
          <section key={e.id}>
            <h2 className="mb-1 font-semibold">
              {e.name} {e.is_placeholder && <span className="label ml-2 text-orange">placeholder</span>}
            </h2>
            <div className="label mb-3">{fmtRange(e.start_date, e.end_date ?? "now")}</div>
            <ol className="flex flex-col divide-y divide-line border-y border-line">
              {list.map((s, i) => {
                const leg = legBy.get(s.id);
                return (
                  <li key={s.id}>
                    <Link href={`/admin/stops/${s.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-white/[0.02]">
                      <span className="min-w-0">
                        <span className="label mr-2">{i + 1}</span>
                        <Flag iso={s.country_iso2} /> {s.city}
                        <span className="label ml-2">{fmtRange(s.arrived_on, s.left_on)}</span>
                      </span>
                      <span className="label shrink-0">
                        {leg ? `${MODE_LABEL[s.arrival_mode as keyof typeof MODE_LABEL]} ${Math.round(leg.distance_km)} km${leg.is_fallback ? " ⚠ straight line" : ""}` : "start"}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {list.length === 0 && <li className="label py-3">No stops yet.</li>}
            </ol>
          </section>
        );
      })}

      {deleted.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-muted">Deleted stops</h2>
          <ul className="flex flex-col divide-y divide-line border-y border-line text-sm text-muted">
            {deleted.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                {s.city} · {s.arrived_on}
                <form action={restoreStop}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn">Restore</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
