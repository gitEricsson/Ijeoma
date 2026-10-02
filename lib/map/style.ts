import type { StyleSpecification } from "maplibre-gl";

export const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
// Layers from the OpenFreeMap dark style that add noise without adding story.
const DROP = /oneway|aeroway|pier|path|minor|dashline|railway|building|landuse|landcover|place_other|place_suburb|place_village|highway_name|water_name|boundary_state|place_state|place_country_other|place_town/;


export async function loadStyle(): Promise<StyleSpecification> {
  const style: StyleSpecification = await fetch(STYLE_URL).then((r) => r.json());
  style.layers = style.layers.filter((l) => !DROP.test(l.id));
  for (const l of style.layers) {
    if (l.id === "background" && l.type === "background") l.paint = { "background-color": "#0b0b0c" };
    if (l.id === "water" && l.type === "fill") l.paint = { "fill-color": "#030304" };
    if (l.type === "line" && l.id.startsWith("boundary_country")) {
      l.paint = { ...l.paint, "line-color": "#3a3a3a", "line-width": 0.6, "line-dasharray": [1] };
    }
    if (l.type === "line" && l.id.startsWith("highway")) {
      l.paint = { ...l.paint, "line-color": "#1c1c1e" };
    }
    if (l.type === "symbol") {
      l.paint = { ...l.paint, "text-color": "#6d6d6b", "text-halo-color": "#050506", "text-halo-width": 1 };
      // No city dots: the style asks for "circle-11", which its own sprite
      // doesn't have (thousands of console warnings), and we want labels only.
      const layout: Record<string, unknown> = { ...l.layout, "text-font": ["Noto Sans Regular"] };
      delete layout["icon-image"];
      l.layout = layout as typeof l.layout;
    }
  }
  // With no icons left, skip downloading the sprite sheet altogether.
  delete style.sprite;
  return style;
}
