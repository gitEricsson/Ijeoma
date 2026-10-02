import type { LngLat } from "@/lib/routing";
import type { Leg, Stop } from "@/lib/types";

// The whole journey as one parameterised path. Progress p runs 0..1 over
// on-screen (degree) length so the animation speed looks even.

type PathLeg = { leg: Leg; coords: LngLat[]; cum: number[]; len: number; start: number; kmStart: number };
export type JourneyPath = { legs: PathLeg[]; total: number; totalKm: number; stops: Stop[] };

const seg = (a: LngLat, b: LngLat) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function buildPath(legs: Leg[], stops: Stop[]): JourneyPath {
  const order = new Map(stops.map((s, i) => [s.id, i]));
  const sorted = [...legs].sort((a, b) => (order.get(a.to_stop_id) ?? 0) - (order.get(b.to_stop_id) ?? 0));
  let total = 0;
  let totalKm = 0;
  const out: PathLeg[] = sorted.map((leg) => {
    const coords = leg.geometry.coordinates;
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + seg(coords[i - 1], coords[i]));
    const len = cum[cum.length - 1];
    const pl = { leg, coords, cum, len, start: total, kmStart: totalKm };
    total += len;
    totalKm += Number(leg.distance_km);
    return pl;
  });
  return { legs: out, total, totalKm, stops };
}

function along(pl: PathLeg, d: number): { at: LngLat; ahead: LngLat } {
  const { coords, cum } = pl;
  if (coords.length < 2) return { at: coords[0], ahead: coords[0] };
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const span = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / span));
  const a = coords[i - 1];
  const b = coords[i];
  return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ahead: b };
}

export type PathPoint = { at: LngLat; ahead: LngLat; legIndex: number; frac: number };

function locate(path: JourneyPath, d: number) {
  let i = path.legs.findIndex((l) => d <= l.start + l.len);
  if (i < 0) i = path.legs.length - 1;
  const pl = path.legs[i];
  return { i, pl, local: Math.min(pl.len, Math.max(0, d - pl.start)) };
}

// Heading is taken from a point a fixed distance further along the journey,
// not the next road vertex, so the car turns through corners instead of
// snapping at each one.
function lookAhead(path: JourneyPath) {
  return Math.max(path.total * 0.006, 0.03);
}

export function pointAt(path: JourneyPath, p: number): PathPoint | null {
  if (!path.legs.length) return null;
  const d = Math.min(1, Math.max(0, p)) * path.total;
  const { i, pl, local } = locate(path, d);
  const at = along(pl, local).at;
  const look = lookAhead(path);
  let ahead: LngLat;
  if (d + look <= path.total) {
    const a = locate(path, d + look);
    ahead = along(a.pl, a.local).at;
  } else {
    // Near the end: extend the last stretch forwards.
    const b = locate(path, Math.max(0, path.total - look));
    const back = along(b.pl, b.local).at;
    const end = along(path.legs[path.legs.length - 1], path.legs[path.legs.length - 1].len).at;
    ahead = [end[0] + (end[0] - back[0]), end[1] + (end[1] - back[1])];
  }
  return { at, ahead, legIndex: i, frac: pl.len ? local / pl.len : 1 };
}

export function trailAt(path: JourneyPath, p: number): GeoJSON.FeatureCollection {
  const budget = Math.min(1, Math.max(0, p)) * path.total;
  const features: GeoJSON.Feature[] = [];
  for (const pl of path.legs) {
    if (pl.start >= budget) break;
    const local = budget - pl.start;
    let coords: LngLat[];
    if (local >= pl.len) coords = pl.coords;
    else {
      let i = 1;
      while (i < pl.cum.length && pl.cum[i] <= local) i++;
      coords = [...pl.coords.slice(0, i), along(pl, local).at];
    }
    if (coords.length > 1) {
      features.push({ type: "Feature", properties: { id: pl.leg.id, to: pl.leg.to_stop_id, mode: pl.leg.mode }, geometry: { type: "LineString", coordinates: coords } });
    }
  }
  return { type: "FeatureCollection", features };
}

const DAY = 86_400_000;

/** Interpolated date and leg label for replay progress p. */
export function replayLabel(path: JourneyPath, pt: PathPoint | null) {
  if (!pt) return { date: null as string | null, from: "", to: "" };
  const leg = path.legs[pt.legIndex].leg;
  const from = path.stops.find((s) => s.id === leg.from_stop_id);
  const to = path.stops.find((s) => s.id === leg.to_stop_id);
  if (!from || !to) return { date: null, from: "", to: "" };
  const a = Date.parse(from.left_on ?? from.arrived_on);
  const b = Date.parse(to.arrived_on);
  const t = a + Math.max(0, b - a) * pt.frac;
  return { date: new Date(Math.round(t / DAY) * DAY).toISOString().slice(0, 10), from: from.city, to: to.city };
}
