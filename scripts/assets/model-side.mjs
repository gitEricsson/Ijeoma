// Orthographic side-view render of IJEOMA's model (public/models/ijeoma.glb)
// with a depth buffer: each pixel is labelled with the material class of the
// nearest surface. scripts/assets/icons.py turns it into the site icons.
//
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//   node scripts/assets/model-side.mjs && python scripts/assets/icons.py
//
// Writes side.labels + side.json to the system temp folder.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read("public/models/ijeoma.glb");
await doc.transform(dequantize());

// Material -> class. 0 = empty. Transparent lamp covers are skipped so the lamps show.
const CLASSES = ["empty", "body", "glass", "trim", "tyre", "rim", "chrome", "head", "tail", "brake"];
const classOf = (name) => {
  if (name === "body_color") return 1;
  if (name === "glass_window") return 2;
  if (name.startsWith("black_plastic") || name === "interior_1" || name === "interior_2" || name === "light_projector" || name === "logo") return 3;
  if (name === "tyre") return 4;
  if (name === "rims") return 5;
  if (name === "chrome") return 6;
  if (name === "light") return 7;
  if (name.startsWith("tail_light")) return 8;
  if (name.startsWith("brake")) return 9;
  return -1; // lamp_glass and anything unknown: not drawn
};

// Collect world-space triangles.
const tris = []; // [x0,y0,z0,x1,y1,z1,x2,y2,z2,cls]
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
let tailX = 0, tailN = 0;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const cls = classOf(p.getMaterial()?.getName() ?? "");
    if (cls < 0) continue;
    const pos = p.getAttribute("POSITION");
    const idx = p.getIndices();
    const count = idx ? idx.getCount() : pos.getCount();
    const v = [0, 0, 0];
    const get = (i) => { pos.getElement(idx ? idx.getScalar(i) : i, v); return mul(M, v[0], v[1], v[2]); };
    for (let i = 0; i + 2 < count; i += 3) {
      const a = get(i), b = get(i + 1), c = get(i + 2);
      tris.push([...a, ...b, ...c, cls]);
      if (cls === 8) { tailX += a[0] + b[0] + c[0]; tailN += 3; }
    }
  }
}
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const t of tris) for (let k = 0; k < 9; k += 3) {
  minX = Math.min(minX, t[k]); maxX = Math.max(maxX, t[k]);
  minY = Math.min(minY, t[k + 1]); maxY = Math.max(maxY, t[k + 1]);
  minZ = Math.min(minZ, t[k + 2]); maxZ = Math.max(maxZ, t[k + 2]);
}
// Nose to the right: if the tail lights sit at +x, mirror horizontally.
const mirror = tailN && tailX / tailN > (minX + maxX) / 2;
const W = Number(process.argv[2] ?? 2048);
const s = (W - 1) / (maxX - minX);
const H = Math.ceil((maxY - minY) * s) + 1;
const labels = new Uint8Array(W * H);
const depth = new Float32Array(W * H).fill(-Infinity);

// View from +z (nearest = largest z).
for (const t of tris) {
  const P = [0, 3, 6].map((k) => [mirror ? (maxX - t[k]) * s : (t[k] - minX) * s, (maxY - t[k + 1]) * s, t[k + 2]]);
  const [A, B, C] = P;
  const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
  if (Math.abs(area) < 1e-9) continue;
  const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
      const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
      const i = y * W + x;
      if (z > depth[i]) { depth[i] = z; labels[i] = t[9]; }
    }
  }
}
writeFileSync(join(tmpdir(), "side.labels"), labels);
writeFileSync(join(tmpdir(), "side.json"), JSON.stringify({ W, H, classes: CLASSES, mirror, tris: tris.length }));
console.log({ W, H, mirror, tris: tris.length });
