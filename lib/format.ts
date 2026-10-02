const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function fmtDate(d: string | null) {
  return d ? dateFmt.format(new Date(d)) : "Not yet";
}

export function fmtRange(a: string, b: string | null) {
  if (!b || a === b) return fmtDate(a);
  const [da, db] = [new Date(a), new Date(b)];
  const sameYear = da.getUTCFullYear() === db.getUTCFullYear();
  if (sameYear && da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${fmtDate(b)}`;
  if (sameYear) return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(da)} – ${fmtDate(b)}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

export function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)} h ago`;
  const d = h / 24;
  if (d < 60) return `${Math.round(d)} days ago`;
  return `${Math.round(d / 30)} months ago`;
}

export const MODE_LABEL = { drive: "Road", ferry: "Ferry", flight: "Flight", ship: "Ship" } as const;
