import { SECTIONS, SPOTS, type SectionId } from "./site";
import type { Sponsor } from "./types";

// A sticker spot can carry several sponsors.
export function sponsorsByPanel(sponsors: Sponsor[]) {
  const map = new Map<string, Sponsor[]>();
  for (const s of sponsors) if (s.active) map.set(s.panel, [...(map.get(s.panel) ?? []), s]);
  return map;
}

/** The side of the car a sponsor's panel is on: a sticker spot's side, or the section itself. */
export function sectionOf(panel: string): SectionId | null {
  if (panel in SPOTS) return SPOTS[panel];
  return SECTIONS.some((s) => s.id === panel) ? (panel as SectionId) : null;
}

/** Whether the sponsor has a sticker on the car (a spot, not just a side). */
export const hasSticker = (s: Sponsor) => s.panel in SPOTS;

// Active sponsors by side, front to back in spot order.
export function sponsorsBySection(sponsors: Sponsor[]) {
  const order = Object.keys(SPOTS);
  const rank = (s: Sponsor) => (hasSticker(s) ? order.indexOf(s.panel) : order.length);
  const map = new Map<SectionId, Sponsor[]>(SECTIONS.map((s) => [s.id, []]));
  for (const s of sponsors) {
    const section = s.active ? sectionOf(s.panel) : null;
    if (section) map.get(section)!.push(s);
  }
  for (const list of map.values()) list.sort((a, b) => rank(a) - rank(b));
  return map;
}
