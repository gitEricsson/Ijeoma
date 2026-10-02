// Private analytics for the admin dashboard, from analytics_summary()
// (supabase/migrations/0005_analytics.sql). Admins only.

export type Summary = {
  visitors: number;
  visitors_today: number;
  visitors_7d: number;
  page_views: number;
  donate_clicks: number;
  donate_clickers: number;
  daily: { day: string; visitors: number; clicks: number }[];
};

const n = (v: number) => v.toLocaleString("en-US");
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default function Analytics({ data }: { data: Summary | null }) {
  if (!data) return <p className="label">Analytics aren&apos;t available right now.</p>;
  const rate = data.visitors ? (data.donate_clickers / data.visitors) * 100 : 0;
  const peak = Math.max(1, ...data.daily.map((d) => d.visitors));
  const stats = [
    { label: "Visitors", value: n(data.visitors), hint: "unique browsers, all time" },
    { label: "Today", value: n(data.visitors_today), hint: "visitors (Lagos time)" },
    { label: "Last 7 days", value: n(data.visitors_7d), hint: "visitors" },
    { label: "Page views", value: n(data.page_views), hint: "all time" },
    { label: "Donate clicks", value: n(data.donate_clicks), hint: `${n(data.donate_clickers)} ${data.donate_clickers === 1 ? "person" : "people"}` },
    { label: "Click-through", value: `${rate.toFixed(rate && rate < 10 ? 1 : 0)}%`, hint: "of visitors clicked Donate" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="hud p-3">
            <div className="label">{s.label}</div>
            <div className="font-mono text-xl">{s.value}</div>
            <div className="label mt-0.5">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="border border-line p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label">Last {data.daily.length} days</span>
          <span className="label flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 bg-line-strong" /> Visitors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 bg-orange" /> Donate clicks
            </span>
          </span>
        </div>
        <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Daily visitors and Donate clicks for the last ${data.daily.length} days`}>
          {data.daily.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${dayLabel(d.day)}: ${n(d.visitors)} visitors, ${n(d.clicks)} Donate clicks`}>
              <div className="relative w-full bg-line-strong" style={{ height: `${(d.visitors / peak) * 100}%`, minHeight: d.visitors ? 2 : 0 }}>
                {d.clicks > 0 && <div className="absolute inset-x-0 bottom-0 bg-orange" style={{ height: `${Math.min(100, (d.clicks / Math.max(1, d.visitors)) * 100)}%`, minHeight: 2 }} />}
              </div>
            </div>
          ))}
        </div>
        <div className="label mt-1.5 flex justify-between">
          <span>{data.daily[0] && dayLabel(data.daily[0].day)}</span>
          <span>Today</span>
        </div>
      </div>
      <p className="label">
        Counted privately on this site: no cookies, no third parties, no personal data. Your own visits while signed in to the admin, and local test runs, aren&apos;t counted.
      </p>
    </div>
  );
}
