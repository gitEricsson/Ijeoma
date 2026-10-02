// Leg geometry between two stops. Drive legs come from the public OSRM demo
// server (one call per saved stop); ferry/flight/ship legs are curved arcs.
// Self-contained (no imports) so scripts/db-apply.mjs can load it directly.

export type Mode = "drive" | "ferry" | "flight" | "ship";
export type LngLat = [number, number];
export type LineString = { type: "LineString"; coordinates: LngLat[] };
export type RouteResult = { geometry: LineString; distanceKm: number; isFallback: boolean };

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// A gentle quadratic bezier bowed to one side of the straight line.
export function arc(a: LngLat, b: LngLat, steps = 48): LineString {
  const mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ctrl: LngLat = [mid[0] - dy * 0.2, mid[1] + dx * 0.2];
  const coordinates: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    coordinates.push([
      round(u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0]),
      round(u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1]),
    ]);
  }
  return { type: "LineString", coordinates };
}

function round(n: number) {
  return Math.round(n * 1e5) / 1e5;
}

export async function routeLeg(from: LngLat, to: LngLat, mode: Mode): Promise<RouteResult> {
  if (mode !== "drive") {
    return { geometry: arc(from, to), distanceKm: round1(haversineKm(from, to)), isFallback: false };
  }
  const url = `${OSRM_URL}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=simplified&geometries=geojson`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "spydey-tracker (one request per saved stop)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (data.code !== "Ok" || !route) throw new Error(`OSRM ${data.code}`);
    return {
      geometry: { type: "LineString", coordinates: route.geometry.coordinates.map((c: LngLat) => [round(c[0]), round(c[1])]) },
      distanceKm: round1(route.distance / 1000),
      isFallback: false,
    };
  } catch {
    // Straight line so a routing outage never blocks saving a stop.
    return {
      geometry: { type: "LineString", coordinates: [from, to] },
      distanceKm: round1(haversineKm(from, to) * 1.25),
      isFallback: true,
    };
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
