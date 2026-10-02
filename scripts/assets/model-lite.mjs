// Builds public/models/ijeoma-lite.glb, the light model the map uses (about
// 70 KB): normals dropped so seams don't block welding, then simplified and
// meshopt-compressed. three.js recomputes the normals on load.
//
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//   node scripts/assets/model-lite.mjs public/models/ijeoma.glb public/models/ijeoma-lite.glb 0.12 0.003
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, meshopt, prune, dedup, quantize } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const [src, dest, ratio = "0.05", error = "0.01"] = process.argv.slice(2);
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);

// Drop normals (and UVs on untextured meshes) so seams don't block welding;
// the app recomputes smooth normals for the map car.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute("NORMAL", null);
    const textured = !!prim.getMaterial()?.getBaseColorTexture();
    if (!textured) prim.setAttribute("TEXCOORD_0", null);
  }
}
await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratio), error: Number(error) }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);
await io.write(dest, doc);
let v = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) v += p.getAttribute("POSITION").getCount();
console.log("vertices", v);
