import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { IJEOMA_ORANGE } from "./car";

// IJEOMA from the real W166 model: "2013 Mercedes-Benz ML250 Bluetec
// Executive" by tonielpro520 (Sketchfab), CC BY 4.0, recoloured. The ML250 and
// ML350 share the W166 body. Compressed into /models/ijeoma.glb with
// gltf-transform (meshopt).

export const MODEL_CREDIT = {
  // Author, licence and a note that it's changed: what CC BY 4.0 asks for.
  text: "3D model © tonielpro520 · CC BY 4.0 · modified",
  url: "https://sketchfab.com/3d-models/2013-mercedes-benz-ml250-bluetec-executive-03d647d99f9348328391cd7b1394c7e2",
};

const LENGTH_M = 4.8;

// IJEOMA's finish from her photos: satin orange wrap, silver rims and rails,
// chrome steps, dark tinted glass.
function paint(mat: THREE.MeshStandardMaterial): THREE.Material {
  switch (mat.name) {
    // Standard rather than Physical: identical with no clearcoat, and it shares
    // shaders with the rest of the car, so there's less to compile.
    case "body_color":
      return new THREE.MeshStandardMaterial({ name: mat.name, color: IJEOMA_ORANGE, roughness: 0.62, metalness: 0, side: mat.side });
    case "chrome":
      return new THREE.MeshStandardMaterial({ name: mat.name, color: 0xd9d9d9, metalness: 1, roughness: 0.18, side: mat.side });
    case "rims":
      return new THREE.MeshStandardMaterial({ name: mat.name, color: 0xd5d9de, metalness: 0.55, roughness: 0.32, side: mat.side });
    case "glass_window":
      return new THREE.MeshStandardMaterial({ name: mat.name, color: 0x0b0d10, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.78, side: mat.side });
    case "black_plastic_gloss":
      mat.roughness = 0.25;
      return mat;
    case "black_plastic_matt":
    case "tyre":
      mat.roughness = 0.9;
      return mat;
    case "light":
      mat.emissive = new THREE.Color(0xfff2dc);
      mat.emissiveIntensity = 0.6;
      return mat;
    default:
      if (mat.name.startsWith("tail_light")) {
        mat.emissive = new THREE.Color(0xff1a1a);
        mat.emissiveIntensity = 0.5;
      }
      return mat;
  }
}

// "full" for the garage. "lite" for the map, where she's about 60 px wide: a
// simplified mesh (70 KB instead of 1.15 MB) without normals, which are
// recomputed here.
type Variant = "full" | "lite";
const templates: Partial<Record<Variant, Promise<THREE.Group>>> = {};

/** The normalised car: 4.8 m long, front facing +x, centred, wheels on y = 0. */
export function loadIjeoma(variant: Variant = "full"): Promise<THREE.Group> {
  return (templates[variant] ??= new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(variant === "lite" ? "/models/ijeoma-lite.glb" : "/models/ijeoma.glb")
    .then((gltf) => {
      const model = gltf.scene;
      const tails: THREE.Vector3[] = [];
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!m.geometry.getAttribute("normal")) m.geometry.computeVertexNormals();
        m.material = paint(m.material as THREE.MeshStandardMaterial);
        // One pass for see-through parts (glass, lamp covers): double-sided
        // transparency otherwise draws, and compiles, twice.
        if ((m.material as THREE.Material).transparent) (m.material as THREE.Material).forceSinglePass = true;
        m.castShadow = true;
        m.receiveShadow = true;
        if ((m.material as THREE.Material).name.startsWith("tail_light")) {
          tails.push(new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
        }
      });

      const car = new THREE.Group();
      car.add(model);
      model.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      model.scale.multiplyScalar(LENGTH_M / size.x);
      // Face the front along +x: the tail lights must end up at -x.
      const tailX = tails.reduce((s, v) => s + v.x, 0) / Math.max(1, tails.length);
      if (tails.length && tailX > centre.x) model.rotation.y += Math.PI;
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      const c = box.getCenter(new THREE.Vector3());
      model.position.x -= c.x;
      model.position.z -= c.z;
      model.position.y -= box.min.y;
      car.updateMatrixWorld(true);
      // Only the map car drives, so only it gets turning wheels and a sprung body.
      if (variant === "lite") rigWheels(car);
      return car;
    }));
}

// The map car's rig. Tyres, rims and brake discs come as one mesh each for
// all four wheels; they're baked into car space, split by wheel (front/back
// by x, left/right by z) and hung on a pivot at each wheel's centre, so each
// wheel can turn on its own axle (car-space z). Everything else moves into a
// "body" group that can ride on its suspension while the wheels stay put.
export const WHEEL_NAMES = ["wheel-fl", "wheel-fr", "wheel-rl", "wheel-rr"] as const;
export const BODY_NAME = "ijeoma-body";
const WHEEL_PART = /^(tyre|rims|brake_disc)$/;

function rigWheels(car: THREE.Group) {
  const model = car.children[0];
  const body = new THREE.Group();
  body.name = BODY_NAME;
  car.remove(model);
  body.add(model);
  car.add(body);
  car.updateMatrixWorld(true);

  const parts: THREE.Mesh[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && WHEEL_PART.test((m.material as THREE.Material).name)) parts.push(m);
  });
  if (!parts.length) return;

  type Piece = { wheel: number; tyre: boolean; mat: THREE.Material; pos: number[]; nor: number[] };
  const pieces: Piece[] = [];
  const v = new THREE.Vector3();
  for (const m of parts) {
    // The light model's positions are quantized (16-bit, -1..1). Transform them
    // as floats: applyMatrix4 on the quantized attribute would clamp metres to ±1.
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const src = g.getAttribute("position");
    const srcNor = g.getAttribute("normal");
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const pos: number[] = [];
    const nor: number[] = [];
    for (let i = 0; i < src.count; i++) {
      v.fromBufferAttribute(src, i).applyMatrix4(m.matrixWorld);
      pos.push(v.x, v.y, v.z);
      if (srcNor) {
        v.fromBufferAttribute(srcNor, i).applyMatrix3(normalMatrix).normalize();
        nor.push(v.x, v.y, v.z);
      }
    }
    if (g !== m.geometry) g.dispose();
    const split: Piece[] = [0, 1, 2, 3].map((wheel) => ({ wheel, tyre: (m.material as THREE.Material).name === "tyre", mat: m.material as THREE.Material, pos: [], nor: [] }));
    for (let t = 0; t + 9 <= pos.length; t += 9) {
      const cx = (pos[t] + pos[t + 3] + pos[t + 6]) / 3;
      const cz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3;
      const piece = split[(cx >= 0 ? 0 : 2) + (cz < 0 ? 0 : 1)]; // front +x, left -z
      piece.pos.push(...pos.slice(t, t + 9));
      if (nor.length) piece.nor.push(...nor.slice(t, t + 9));
    }
    pieces.push(...split.filter((p) => p.pos.length));
    m.removeFromParent();
  }

  WHEEL_NAMES.forEach((name, wheel) => {
    const mine = pieces.filter((p) => p.wheel === wheel);
    if (!mine.length) return;
    // The axle sits at the centre of the tyre (or of whatever this wheel has).
    const box = new THREE.Box3();
    for (const p of mine.some((p) => p.tyre) ? mine.filter((p) => p.tyre) : mine) {
      for (let i = 0; i < p.pos.length; i += 3) box.expandByPoint(new THREE.Vector3(p.pos[i], p.pos[i + 1], p.pos[i + 2]));
    }
    const c = box.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.copy(c);
    for (const p of mine) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p.pos, 3));
      if (p.nor.length) geo.setAttribute("normal", new THREE.Float32BufferAttribute(p.nor, 3));
      else geo.computeVertexNormals();
      geo.translate(-c.x, -c.y, -c.z);
      const mesh = new THREE.Mesh(geo, p.mat);
      mesh.castShadow = true;
      pivot.add(mesh);
    }
    car.add(pivot);
  });
  car.updateMatrixWorld(true);
}

// A soft studio reflection map so the paint and chrome read correctly.
// PMREM textures belong to one WebGL context, so cache one per renderer.
const envTextures = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
export function studioEnvironment(renderer: THREE.WebGLRenderer) {
  let tex = envTextures.get(renderer);
  if (!tex) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    envTextures.set(renderer, tex);
  }
  return tex;
}

/**
 * One look for IJEOMA everywhere (map and garage): same tone mapping,
 * reflections and lights, so the orange is the same orange.
 */
export function applyCarLook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, opts: { shadows?: boolean; exposure?: number; environment?: boolean } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Checking every shader compile reads the info log synchronously, which
  // stalls the main thread (and floods the console with ANGLE warnings).
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
  // Khronos PBR Neutral keeps product colours true; ACES pulled the orange towards salmon.
  renderer.toneMapping = THREE.NeutralToneMapping;
  // Tuned so the rendered paint measures close to IJEOMA's #e9401e.
  renderer.toneMappingExposure = opts.exposure ?? 1.3;
  // The garage brings its own showroom reflections (lib/three/showroom.ts).
  if (opts.environment !== false) scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.3;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(5, 9, 6);
  key.castShadow = !!opts.shadows;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  return { key, hemi };
}

// Where each sticker sits on the normalised car (front +x, right +z). Each is
// placed from photos of IJEOMA against landmarks on the model (pillars,
// seams, handles, glass edges, badges). `size` is width, height and
// projection depth; `target` picks which material's mesh the decal is
// projected onto. `rot` turns the sticker to face the panel's measured
// surface normal across the sticker, and `tilt` leans it back to match, so
// it lies flat with its text level. Every sticker lands 100% on its panel
// (checked by casting a 9 x 5 grid of rays over it).
export type DecalSpec = { pos: [number, number, number]; rot: [number, number, number]; size: [number, number, number]; target: string; tilt?: number };
// Projected straight down, reading correctly when you stand in front of the car.
const DOWN: [number, number, number] = [-Math.PI / 2, 0, Math.PI / 2];
const RIGHT: [number, number, number] = [0, 0, 0];
const facing = (yaw: number): [number, number, number] => [0, yaw, 0];

// Sponsor sticker spots, keyed as in SPOTS (lib/site.ts). Only spots with a
// sponsor get a sticker.
export const STICKER_SPOTS: Record<string, DecalSpec> = {
  // Front. Just ahead of the two bonnet vents and centred between them.
  bonnet: { pos: [1.66, 1.14, 0], rot: DOWN, size: [0.56, 0.11, 0.6], target: "body_color" },
  // Right side. Just under the right front door handle.
  "right front door handle": { pos: [0.03, 0.975, 0.94], rot: RIGHT, size: [0.22, 0.041, 0.3], target: "body_color" },
  // Top rear corner of the right front wing: just ahead of the door seam and
  // the mirror, under the windscreen corner, by the bonnet shut line.
  "right front wing": { pos: [1.059, 1.145, 0.836], rot: facing(0.121), tilt: -0.517, size: [0.17, 0.087, 0.3], target: "body_color" },
  // Bottom of the small fixed triangular glass at the back of the right rear
  // door, its front end just behind the divider bar (x -0.89).
  "right rear door glass": { pos: [-1.03, 1.293, 0.782], rot: facing(-0.028), tilt: -0.304, size: [0.2, 0.065, 0.3], target: "glass_window" },
  // Lower front corner of the right quarter glass, tucked against the C-pillar.
  "right rear quarter glass": { pos: [-1.66, 1.37, 0.744], rot: facing(-0.056), tilt: -0.366, size: [0.13, 0.058, 0.3], target: "glass_window" },
  // Left side. Left front door, just ahead of the handle, mid-height.
  "left front door": { pos: [0.3, 0.84, -0.937], rot: facing(3.132), tilt: -0.039, size: [0.38, 0.257, 0.3], target: "body_color" },
  // Left rear door glass, front part by the B-pillar, just above the seal.
  "left rear window": { pos: [-0.575, 1.268, -0.802], rot: facing(-3.13), tilt: -0.303, size: [0.15, 0.057, 0.3], target: "glass_window" },
  // Upper part of the left C-pillar, a little ahead of its middle.
  "left C-pillar": { pos: [-1.22, 1.49, -0.726], rot: facing(-3.078), tilt: -0.396, size: [0.12, 0.067, 0.3], target: "body_color" },
  // Rear. The WRAPHAUS wordmark, bottom right of the rear glass, past the wiper.
  "rear window": { pos: [-2.118, 1.272, 0.645], rot: facing(-1.036), tilt: -0.633, size: [0.12, 0.02, 0.4], target: "glass_window" },
  // Left rear corner, sitting on the outer part of the left tail light.
  "rear left corner": { pos: [-2.114, 1.162, -0.785], rot: facing(-2.493), tilt: -0.386, size: [0.18, 0.08, 0.3], target: "body_color" },
};

// IJEOMA's own stickers: on the car, but not sponsors.
export const LIVERY: (DecalSpec & { logo: string })[] = [
  // Her name, bottom left of the rear glass, from near its left corner.
  { logo: "/sponsors/ijeoma.webp", pos: [-2.121, 1.308, -0.57], rot: facing(-1.916), tilt: -0.634, size: [0.24, 0.085, 0.4], target: "glass_window" },
  // Top right of the rear glass, just under the top edge, above Wraphaus.
  { logo: "/sponsors/cancer-awareness.webp", pos: [-1.926, 1.535, 0.565], rot: facing(-0.957), tilt: -0.68, size: [0.24, 0.104, 0.4], target: "glass_window" },
];

/** A sticker's orientation in car space; its +z axis points out of the car. */
export function stickerFrame(spec: DecalSpec) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rot));
  if (spec.tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), spec.tilt));
  return { quaternion: q, normal: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
}

type Projector = (spec: DecalSpec, map: THREE.Texture) => THREE.Mesh | null;

// Decals are built in world space, from the car's current place on the stage,
// then moved into the car's own space so they ride with her.
function decalProjector(car: THREE.Group): Projector {
  car.updateMatrixWorld(true);
  const byMaterial = new Map<string, THREE.Mesh[]>();
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.material as THREE.Material).name;
    byMaterial.set(name, [...(byMaterial.get(name) ?? []), m]);
  });
  const toCar = car.matrixWorld.clone().invert();
  const carRotation = car.getWorldQuaternion(new THREE.Quaternion());

  return (spec, map) => {
    const position = car.localToWorld(new THREE.Vector3(...spec.pos));
    const orientation = new THREE.Euler().setFromQuaternion(carRotation.clone().multiply(stickerFrame(spec).quaternion));
    const size = new THREE.Vector3(...spec.size);
    // The body may be split over several meshes: keep the one the decal lands on.
    let best: THREE.BufferGeometry | null = null;
    for (const mesh of byMaterial.get(spec.target) ?? []) {
      const g = new DecalGeometry(mesh, position, orientation, size);
      const n = g.getAttribute("position")?.count ?? 0;
      if (n > (best?.getAttribute("position")?.count ?? 0)) {
        best?.dispose();
        best = g;
      } else g.dispose();
    }
    if (!best) return null;
    best.applyMatrix4(toCar);
    const mat = new THREE.MeshStandardMaterial({
      map,
      // A little self-light, so white vinyl still reads on dark tinted glass
      // and under the Night preset.
      emissiveMap: map,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 0.5,
      // The model's body is double-sided with mixed winding, so decals must be too.
      side: THREE.DoubleSide,
    });
    const decal = new THREE.Mesh(best, mat);
    decal.renderOrder = 3;
    car.add(decal);
    return decal;
  };
}

/**
 * Projects a sticker onto the car for each listed spot, plus IJEOMA's own
 * stickers. Returns the sponsor stickers by spot (for tap detection) and
 * every decal mesh (to copy into her reflection).
 */
export function addStickers(car: THREE.Group, spots: string[], textureFor: (spot: string, aspect: number) => THREE.Texture, logoFor: (url: string, aspect: number) => THREE.Texture) {
  const project = decalProjector(car);
  const stickers = new Map<string, THREE.Mesh>();
  const all: THREE.Mesh[] = [];
  for (const spot of spots) {
    const spec = STICKER_SPOTS[spot];
    if (!spec) continue;
    const decal = project(spec, textureFor(spot, spec.size[0] / spec.size[1]));
    if (!decal) continue;
    decal.name = spot;
    stickers.set(spot, decal);
    all.push(decal);
  }
  for (const spec of LIVERY) {
    const decal = project(spec, logoFor(spec.logo, spec.size[0] / spec.size[1]));
    if (decal) all.push(decal);
  }
  return { stickers, all };
}
