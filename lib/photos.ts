import type { Journey } from "./types";

// The picture shown when you hover or tap the trail: the stop's own photo,
// then its country's, then the image of a post from there (via /ig).
export function photoFor(j: Journey, iso2: string | null, stopId: string | null): string | null {
  const stop = stopId ? j.stops.find((s) => s.id === stopId) : undefined;
  if (stop?.photo_url) return stop.photo_url;
  const country = iso2 ? j.countries.find((c) => c.iso2 === iso2) : undefined;
  if (country?.photo_url) return country.photo_url;
  const inCountry = new Set(j.stops.filter((s) => s.country_iso2 === iso2).map((s) => s.id));
  const post =
    j.posts.find((p) => stopId && p.stop_id === stopId) ??
    j.posts.find((p) => (p.stop_id && inCountry.has(p.stop_id)) || (iso2 && p.country_iso2 === iso2));
  return post ? `/ig/${post.shortcode}` : null;
}

type Ring = number[][];
function inRing([x, y]: [number, number], ring: Ring) {
  let inside = false;
  for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
    const [xi, yi] = ring[i];
    const [xk, yk] = ring[k];
    if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ISO code of the country containing a point, from the Africa outlines. */
export function countryAt(features: GeoJSON.Feature[], pt: [number, number]): string | null {
  for (const f of features) {
    const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      if (inRing(pt, poly[0]) && !poly.slice(1).some((hole) => inRing(pt, hole))) return f.properties?.iso ?? null;
    }
  }
  return null;
}
