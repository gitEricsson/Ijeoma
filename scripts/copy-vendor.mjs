// Copies runtime files out of node_modules into public/:
// - MapLibre's worker modules (bundlers can't follow its worker import)
// - SVG flags for the 54 countries (flag-icons, MIT): square for stamps and
//   chips, 4:3 for the waving flag
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `public/maplibre/${f}`);
}

mkdirSync("public/flags/4x3", { recursive: true });
const { features } = JSON.parse(readFileSync("public/data/africa.geojson", "utf8"));
for (const iso of new Set(features.map((f) => f.properties.iso.toLowerCase()))) {
  for (const [from, to] of [["1x1", ""], ["4x3", "4x3/"]]) {
    const src = `node_modules/flag-icons/flags/${from}/${iso}.svg`;
    if (existsSync(src)) copyFileSync(src, `public/flags/${to}${iso}.svg`);
  }
}

// The model is meshopt-compressed now; drop the Draco decoder older builds copied.
rmSync("public/draco", { recursive: true, force: true });
