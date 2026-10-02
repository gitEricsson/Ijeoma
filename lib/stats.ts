import type { Country, Expedition, Leg, SiteState, Stats, Stop } from "./types";

const DAY = 86_400_000;

export function computeStats(
  countries: Country[],
  expeditions: Expedition[],
  stops: Stop[],
  legs: Leg[],
  site: SiteState,
  today = new Date(),
): Stats {
  const counted = countries.filter((c) => c.status !== "upcoming" && (site.count_home || !c.is_home));
  const approxKm = legs.filter((l) => l.mode === "drive").reduce((sum, l) => sum + Number(l.distance_km), 0);
  // Placeholder expeditions have made-up dates, so they stay out of the day count.
  const daysOnRoad = expeditions
    .filter((e) => !e.is_placeholder)
    .reduce((sum, e) => {
      const start = Date.parse(e.start_date);
      const end = e.end_date ? Date.parse(e.end_date) : today.getTime();
      return sum + Math.max(0, Math.floor((end - start) / DAY) + 1);
    }, 0);
  return {
    countriesVisited: counted.length,
    totalCountries: countries.length || 54,
    approxKm: Math.round(approxKm),
    expeditions: expeditions.length,
    daysOnRoad,
    stops: stops.length,
  };
}

// km driven inside one country, attributed by each leg's destination stop.
export function kmInCountry(iso2: string, stops: Stop[], legs: Leg[]): number {
  const ids = new Set(stops.filter((s) => s.country_iso2 === iso2).map((s) => s.id));
  return Math.round(legs.filter((l) => l.mode === "drive" && ids.has(l.to_stop_id)).reduce((s, l) => s + Number(l.distance_km), 0));
}
