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
  text: '"2013 Mercedes-Benz ML250 Bluetec Executive" by tonielpro520, CC BY 4.0, recoloured',
  url: "https://sketchfab.com/3d-models/2013-mercedes-benz-ml250-bluetec-executive-03d647d99f9348328391cd7b1394c7e2",
};

const LENGTH_M = 4.8;

// IJEOMA's finish from her photos: satin orange wrap, silver rims and rails,
// chrome steps, dark tinted glass.
function paint(mat: THREE.MeshStandardMaterial): THREE.Material {
  switch (mat.name) {
    case "body_color":
      return new THREE.MeshPhysicalMaterial({ name: mat.name, color: IJEOMA_ORANGE, roughness: 0.62, metalness: 0, clearcoat: 0, side: mat.side });
    case "chrome":
      return new THREE.MeshStandardMaterial({ name: mat.name, color: 0xd9d9d9, metalness: 1, roughness: 0.18, side: mat.side });
    case "rims":
      return new THREE.MeshStandardMaterial({ name: mat.name, color: 0xd5d9de, metalness: 0.55, roughness: 0.32, side: mat.side });
    case "glass_window":
      return new THREE.MeshPhysicalMaterial({ name: mat.name, color: 0x0b0d10, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.78, side: mat.side });
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
      return car;
    }));
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
export function applyCarLook(renderer: THREE.WebGLRenderer, scene: THREE.Scene, opts: { shadows?: boolean; exposure?: number } = {}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Checking every shader compile reads the info log synchronously, which
  // stalls the main thread (and floods the console with ANGLE warnings).
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
  // Khronos PBR Neutral keeps product colours true; ACES pulled the orange towards salmon.
  renderer.toneMapping = THREE.NeutralToneMapping;
  // Tuned so the rendered paint measures close to IJEOMA's #e9401e.
  renderer.toneMappingExposure = opts.exposure ?? 1.3;
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.3;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(5, 9, 6);
  key.castShadow = !!opts.shadows;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  return key;
}

// Where each sponsor panel sits on the normalised car (front +x, right +z).
// `target` picks which material's mesh the decal is projected onto.
type PanelSpec = { pos: [number, number, number]; rot: [number, number, number]; size: [number, number, number]; target: string };
// Projected straight down, text reading correctly when you stand in front of the car.
const DOWN: [number, number, number] = [-Math.PI / 2, 0, Math.PI / 2];
export const PANEL_SPECS: Record<string, PanelSpec> = {
  // Just ahead of the two bonnet vents and centred between them, as on the car.
  bonnet: { pos: [1.66, 1.14, 0], rot: DOWN, size: [0.56, 0.11, 0.6], target: "body_color" },
  roof: { pos: [-0.55, 1.75, 0], rot: DOWN, size: [1.15, 1.0, 0.7], target: "body_color" },
  "left front door": { pos: [0.5, 0.8, -1], rot: [0, Math.PI, 0], size: [0.95, 0.34, 0.6], target: "body_color" },
  "left rear door": { pos: [-0.55, 0.8, -1], rot: [0, Math.PI, 0], size: [0.9, 0.34, 0.6], target: "body_color" },
  "right front door": { pos: [0.5, 0.8, 1], rot: [0, 0, 0], size: [0.95, 0.34, 0.6], target: "body_color" },
  "right rear door": { pos: [-0.55, 0.8, 1], rot: [0, 0, 0], size: [0.9, 0.34, 0.6], target: "body_color" },
  tailgate: { pos: [-2.35, 0.95, 0], rot: [0, -Math.PI / 2, 0], size: [1.1, 0.32, 0.6], target: "body_color" },
  "rear window": { pos: [-2.25, 1.42, 0], rot: [0, -Math.PI / 2, 0], size: [1.0, 0.3, 0.6], target: "glass_window" },
};

/**
 * Projects a decal for each panel onto the car body. Returns the decal meshes
 * by panel name (used for highlighting and tap detection).
 */
export function addPanelDecals(car: THREE.Group, textureFor: (panel: string, aspect: number) => THREE.Texture) {
  car.updateMatrixWorld(true);
  const byMaterial = new Map<string, THREE.Mesh[]>();
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.material as THREE.Material).name;
    byMaterial.set(name, [...(byMaterial.get(name) ?? []), m]);
  });

  const decals = new Map<string, THREE.Mesh>();
  for (const [panel, spec] of Object.entries(PANEL_SPECS)) {
    const position = new THREE.Vector3(...spec.pos);
    const orientation = new THREE.Euler(...spec.rot);
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
    if (!best) continue;
    const mat = new THREE.MeshStandardMaterial({
      map: textureFor(panel, spec.size[0] / spec.size[1]),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 0.5,
      // The model's body is double-sided with mixed winding, so decals must be too.
      side: THREE.DoubleSide,
    });
    const decal = new THREE.Mesh(best, mat);
    decal.name = panel;
    decal.renderOrder = 3;
    // DecalGeometry is built in world space; the car sits at the origin here.
    car.add(decal);
    decals.set(panel, decal);
  }
  return decals;
}
