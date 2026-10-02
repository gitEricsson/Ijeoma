import type { Sponsor } from "./types";

// A panel can carry several sponsors.
export function sponsorsByPanel(sponsors: Sponsor[]) {
  const map = new Map<string, Sponsor[]>();
  for (const s of sponsors) if (s.active) map.set(s.panel, [...(map.get(s.panel) ?? []), s]);
  return map;
}
