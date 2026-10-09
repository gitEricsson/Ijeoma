import * as THREE from "three";
import { IJEOMA_ORANGE } from "./car";

// IJEOMA's showroom: a spotlit turntable under a halo ring light, in a dark
// hall with a glowing cove line at the floor, soft light panels on the wall
// and a polished tiled floor. The stage turns and the car sits on it
// (`carHolder`). Built entirely in code, no assets.
//
// Weaker devices get the stage, LED ring, halo and basic lights only: no
// reflection, light cones or fog.
//
// The car's reflection in the stage is a mirrored copy of the car seen
// through the stage's dark gloss top. A true mirror (Reflector) renders
// into a texture, which makes three.js compile a second set of shaders for
// every material on the car; the copy reuses the car's own.
//
// Only one spotlight is a real light. Every real light is compiled into every
// car material's shader, and on Windows (Direct3D) shader compiles slow down
// sharply as they grow; the other two beams are light cones only.

// "off" is the lights-off switch: no spotlights, halo or glow, and no
// reflections, just soft neutral daylight so the car stays easy to see.
export type LightPreset = "showroom" | "night" | "sunset" | "off";
export const LIGHT_PRESETS: { id: Exclude<LightPreset, "off">; label: string }[] = [
  { id: "showroom", label: "Showroom" },
  { id: "night", label: "Night" },
  { id: "sunset", label: "Sunset" },
];

export const STAGE_R = 3.4; // metres
export const STAGE_TOP = 0.18;
const WALL_R = 22;

type Look = {
  bg: THREE.Color;
  spot: THREE.Color;
  spotI: number; // multiplier on SPOT_BASE
  cone: number;
  led: number;
  halo: THREE.Color;
  haloI: number;
  cove: THREE.Color;
  coveI: number;
  panel: number;
  sky: THREE.Color;
  ground: THREE.Color;
  hemiI: number;
  key: THREE.Color;
  keyI: number;
  env: number;
  pool: number; // the spots' pool of light on the floor
  sheen: number; // the highlight gliding round the stage rim
  mirror: number; // the car's reflection in the stage top
};

const c = (hex: number) => new THREE.Color(hex);
const LOOKS: Record<LightPreset, Look> = {
  // Paint calibrated to IJEOMA's #e9401e in this one. Warm, soft whites so the
  // highlights on the body stay highlights rather than glare.
  showroom: {
    bg: c(0x0a0908), spot: c(0xfff0de), spotI: 1, cone: 0.16, led: 1,
    halo: c(0xfff3e4), haloI: 1, cove: c(0xffe2c4), coveI: 0.7, panel: 0.16,
    sky: c(0xfff6ec), ground: c(0x1a1715), hemiI: 1.1, key: c(0xfff4e8), keyI: 2.3, env: 0.65, pool: 1, sheen: 1, mirror: 1,
  },
  night: {
    bg: c(0x040405), spot: c(0xc9d4ff), spotI: 0.3, cone: 0.09, led: 2.3,
    halo: c(0xb8c6ff), haloI: 0.45, cove: c(0xff6a2a), coveI: 1, panel: 0.05,
    sky: c(0x8ea0d0), ground: c(0x0a0a10), hemiI: 0.28, key: c(0xb8c8ff), keyI: 0.45, env: 0.1, pool: 1, sheen: 1, mirror: 1,
  },
  sunset: {
    bg: c(0x120a06), spot: c(0xffb070), spotI: 0.85, cone: 0.15, led: 1,
    halo: c(0xffc58a), haloI: 0.8, cove: c(0xff9a52), coveI: 0.9, panel: 0.12,
    sky: c(0xffcf9e), ground: c(0x2a160c), hemiI: 0.85, key: c(0xff9a50), keyI: 2, env: 0.18, pool: 1, sheen: 1, mirror: 1,
  },
  // Lights off: every lamp and glow out and no reflections; only soft,
  // neutral daylight (sky and one sun) lights the car. The orange stage ring stays.
  off: {
    bg: c(0x0a0908), spot: c(0xffffff), spotI: 0, cone: 0, led: 0.8,
    halo: c(0xffffff), haloI: 0, cove: c(0xffffff), coveI: 0, panel: 0,
    sky: c(0xffffff), ground: c(0x2a2724), hemiI: 1.7, key: c(0xffffff), keyI: 2.4, env: 0, pool: 0, sheen: 0, mirror: 0,
  },
};
const SPOT_BASE = 140; // candela; tuned with the paint sampling

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const radial = (stops: [number, string][]) =>
  canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (const [at, col] of stops) g.addColorStop(at, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });

// A soft light-cone shell: bright near the lamp, fading to the floor and at
// its silhouette edges, added on top of the scene.
function coneMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uOpacity: { value: 0.1 } },
    vertexShader: /* glsl */ `
      varying float vAlong; varying float vFacing;
      void main() {
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAlong; varying float vFacing;
      void main() {
        float a = uOpacity * pow(vAlong, 1.4) * pow(vFacing, 1.6);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Reflections for the paint: a dark room whose only bright things are the
// halo ring overhead and a faint horizon, so the body shows one clean
// circular highlight instead of white glare.
function showroomEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x050505);
  const add = (geo: THREE.BufferGeometry, intensity: number, pos: [number, number, number], rotX = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.x = rotX;
    room.add(m);
  };
  add(new THREE.TorusGeometry(3.6, 0.35, 12, 96), 2.2, [0, 5, 0], Math.PI / 2); // halo ring
  add(new THREE.PlaneGeometry(4, 4), 0.5, [0, 6.5, 0], Math.PI / 2); // soft fill above
  add(new THREE.CylinderGeometry(14, 14, 0.5, 64, 1, true), 0.25, [0, 0.6, 0]); // horizon glow
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  room.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  return tex;
}

export type Showroom = {
  stage: THREE.Group;
  carHolder: THREE.Group;
  /** Mirrored space under the stage top for the car's reflection (null on weaker devices). */
  mirrorHolder: THREE.Group | null;
  setPreset: (p: LightPreset) => void;
  update: (dt: number, t: number) => void;
  dispose: () => void;
};

export function buildShowroom(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  lights: { hemi: THREE.HemisphereLight; key: THREE.DirectionalLight },
  opts: { low: boolean },
): Showroom {
  const rich = !opts.low;
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
  const root = new THREE.Group();
  scene.add(root);

  // ---------- Hall ----------
  const bg = new THREE.Color(0x0a0908);
  scene.background = bg;
  if (rich) scene.fog = new THREE.Fog(bg.clone(), 14, 34);
  const env = showroomEnvironment(renderer);
  scene.environment = env;

  // Polished concrete floor laid in large tiles.
  const tileTex = keep(
    canvasTexture(256, 256, (ctx) => {
      ctx.fillStyle = "#0f0e0d";
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "rgba(255,240,225,0.05)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 254, 254);
    }),
  );
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(26, 26); // 3 m tiles
  tileTex.anisotropy = 8;
  // A ring, open under the stage, so the reflection well below it shows through.
  const floor = new THREE.Mesh(keep(new THREE.RingGeometry(STAGE_R + 0.05, 40, 128, 4)), keep(new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.42, metalness: 0.12 })));
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  // The pool of light the spots throw on the floor round the stage.
  const poolMat = keep(new THREE.MeshBasicMaterial({ map: keep(radial([[0, "rgba(255,236,214,0.55)"], [0.45, "rgba(255,236,214,0.18)"], [1, "rgba(255,236,214,0)"]])), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const pool = new THREE.Mesh(keep(new THREE.CircleGeometry(8, 64)), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.006;
  root.add(pool);

  // Cyclorama: a curved wall that fades up into darkness.
  const wallTex = keep(
    canvasTexture(8, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#020202");
      g.addColorStop(0.6, "#0b0a09");
      g.addColorStop(0.92, "#16120f");
      g.addColorStop(1, "#1d1713");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 256);
    }),
  );
  const wall = new THREE.Mesh(keep(new THREE.CylinderGeometry(WALL_R, WALL_R, 16, 128, 1, true)), keep(new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide })));
  wall.position.y = 8;
  root.add(wall);

  // Cove light: one thin glowing line wrapping the hall at floor level.
  const coveMat = keep(new THREE.MeshBasicMaterial({ color: 0xffe2c4, toneMapped: false }));
  const cove = new THREE.Mesh(keep(new THREE.TorusGeometry(WALL_R - 0.25, 0.035, 6, 256)), coveMat);
  cove.rotation.x = Math.PI / 2;
  cove.position.y = 0.1;
  root.add(cove);
  const coveGlowMat = keep(
    new THREE.MeshBasicMaterial({
      map: keep(
        canvasTexture(4, 64, (ctx) => {
          const g = ctx.createLinearGradient(0, 0, 0, 64);
          g.addColorStop(0, "rgba(255,226,196,0)");
          g.addColorStop(1, "rgba(255,226,196,0.6)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 4, 64);
        }),
      ),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    }),
  );
  const coveGlow = new THREE.Mesh(keep(new THREE.CylinderGeometry(WALL_R - 0.3, WALL_R - 0.3, 1.4, 128, 1, true)), coveGlowMat);
  coveGlow.position.y = 0.75;
  root.add(coveGlow);

  // Soft light panels round the wall, like a gallery's light boxes.
  const panelTex = keep(
    canvasTexture(64, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, "rgba(255,240,224,0)");
      g.addColorStop(0.5, "rgba(255,240,224,1)");
      g.addColorStop(1, "rgba(255,240,224,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 256);
      const v = ctx.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, "rgba(0,0,0,1)");
      v.addColorStop(0.18, "rgba(0,0,0,0)");
      v.addColorStop(0.82, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,1)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, 64, 256);
    }),
  );
  const panelMat = keep(new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const panelGeo = keep(new THREE.PlaneGeometry(1.8, 7));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const p = new THREE.Mesh(panelGeo, panelMat);
    p.position.set(Math.cos(a) * (WALL_R - 0.4), 4.2, Math.sin(a) * (WALL_R - 0.4));
    p.lookAt(0, 4.2, 0);
    root.add(p);
  }

  // Halo ring light hovering over the stage.
  const haloMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff3e4, toneMapped: false }));
  const halo = new THREE.Mesh(keep(new THREE.TorusGeometry(4.1, 0.05, 12, 192)), haloMat);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 4.8;
  root.add(halo);
  const haloGlowMat = keep(
    new THREE.MeshBasicMaterial({
      map: keep(radial([[0.82, "rgba(255,243,228,0)"], [0.9, "rgba(255,243,228,0.7)"], [1, "rgba(255,243,228,0)"]])),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  const haloGlow = new THREE.Mesh(keep(new THREE.CircleGeometry(4.55, 96)), haloGlowMat);
  haloGlow.rotation.x = Math.PI / 2;
  haloGlow.position.y = 4.8;
  root.add(haloGlow);

  // ---------- Spotlights ----------
  const target = new THREE.Object3D();
  target.position.set(0, 0.7, 0);
  root.add(target);
  const spots: THREE.SpotLight[] = [];
  const cones: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  const beamAngles = rich ? [-0.7, 1.25, 3.4] : [-0.7];
  beamAngles.forEach((a, i) => {
    const from = new THREE.Vector3(Math.cos(a) * 6.4, 9.6, Math.sin(a) * 6.4);
    if (i === 0) {
      // No real-time shadow: it costs a shader set of its own; the soft
      // contact shadow under the car does the grounding.
      const spot = new THREE.SpotLight(0xffffff, SPOT_BASE, 0, 0.4, 0.75, 2);
      spot.position.copy(from);
      spot.target = target;
      root.add(spot);
      spots.push(spot);
    }
    if (rich) {
      const len = from.distanceTo(target.position) + 1.2;
      const geo = keep(new THREE.ConeGeometry(Math.tan(0.4) * len, len, 48, 1, true));
      geo.translate(0, -len / 2, 0); // apex at the lamp
      const cone = new THREE.Mesh(geo, keep(coneMaterial(new THREE.Color(0xfff0de))));
      cone.position.copy(from);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.position.clone().sub(from).normalize());
      cone.renderOrder = 10;
      root.add(cone);
      cones.push(cone);
    }
  });
  lights.key.castShadow = false;

  // ---------- Stage (turntable) ----------
  const stage = new THREE.Group();
  root.add(stage);
  const R = STAGE_R;
  // Open-topped, so the reflection inside shows through the gloss.
  const base = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(R, R + 0.09, STAGE_TOP, 128, 1, true)),
    keep(new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.28, metalness: 0.3 })),
  );
  base.position.y = STAGE_TOP / 2;
  stage.add(base);
  const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(R + 0.014, R + 0.04, 0.05, 128, 1, true)), keep(new THREE.MeshStandardMaterial({ color: 0xbdb6ae, metalness: 1, roughness: 0.3 })));
  band.position.y = STAGE_TOP - 0.035;
  stage.add(band);

  // The reflection: a dark well under the stage top, holding an upside-down
  // copy of the car (added by the garage), seen faintly through the gloss.
  let mirrorHolder: THREE.Group | null = null;
  if (rich) {
    const wellMat = keep(new THREE.MeshBasicMaterial({ color: 0x060505, side: THREE.BackSide }));
    const well = new THREE.Mesh(keep(new THREE.CylinderGeometry(R - 0.01, R - 0.01, 2.6, 96, 1, false)), wellMat);
    well.position.y = STAGE_TOP - 1.3;
    stage.add(well);
    mirrorHolder = new THREE.Group();
    mirrorHolder.position.y = STAGE_TOP;
    mirrorHolder.scale.y = -1;
    stage.add(mirrorHolder);
  }
  const glossMat = keep(new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 0.16, metalness: 0.1, transparent: rich, opacity: rich ? 0.8 : 1 }));
  const gloss = new THREE.Mesh(keep(new THREE.CircleGeometry(R - 0.02, 96)), glossMat);
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.y = STAGE_TOP + 0.003;
  stage.add(gloss);

  // Inset LED ring in IJEOMA orange, with a soft glow.
  const orange = new THREE.Color(IJEOMA_ORANGE);
  const ledMat = keep(new THREE.MeshBasicMaterial({ color: orange.clone(), toneMapped: false }));
  const led = new THREE.Mesh(keep(new THREE.RingGeometry(R - 0.36, R - 0.32, 192)), ledMat);
  led.rotation.x = -Math.PI / 2;
  led.position.y = STAGE_TOP + 0.005;
  stage.add(led);
  const ledGlowMat = keep(
    new THREE.MeshBasicMaterial({
      map: keep(radial([[(R - 0.6) / (R - 0.05), "rgba(255,90,30,0)"], [(R - 0.34) / (R - 0.05), "rgba(255,110,40,0.9)"], [1, "rgba(255,90,30,0)"]])),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  const ledGlow = new THREE.Mesh(keep(new THREE.CircleGeometry(R - 0.05, 96)), ledGlowMat);
  ledGlow.rotation.x = -Math.PI / 2;
  ledGlow.position.y = STAGE_TOP + 0.006;
  stage.add(ledGlow);

  // Engraved ticks every 5 degrees, longer and orange every 45.
  const ticks = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.014, 0.004, 1)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), 72);
  const m4 = new THREE.Matrix4();
  const grey = new THREE.Color(0x6f675f);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const major = i % 9 === 0;
    const r = R - 0.16;
    m4.compose(
      new THREE.Vector3(Math.cos(a) * r, STAGE_TOP + 0.004, Math.sin(a) * r),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2),
      new THREE.Vector3(1, 1, major ? 0.17 : 0.08),
    );
    ticks.setMatrixAt(i, m4);
    ticks.setColorAt(i, major ? orange : grey);
  }
  stage.add(ticks);

  // A highlight gliding round the rim (not tied to the stage's turn).
  const sheenMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const sheen = new THREE.Mesh(keep(new THREE.RingGeometry(R - 0.07, R + 0.005, 48, 1, 0, 0.55)), sheenMat);
  sheen.rotation.x = -Math.PI / 2;
  const sheenPivot = new THREE.Group();
  sheenPivot.position.y = STAGE_TOP + 0.007;
  sheenPivot.add(sheen);
  root.add(sheenPivot);

  // Where the car stands, with a soft contact shadow under it.
  const carHolder = new THREE.Group();
  carHolder.position.y = STAGE_TOP;
  stage.add(carHolder);
  const contact = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(6, 2.9)),
    keep(new THREE.MeshBasicMaterial({ map: keep(radial([[0, "rgba(0,0,0,0.85)"], [1, "rgba(0,0,0,0)"]])), transparent: true, depthWrite: false })),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.008;
  carHolder.add(contact);

  // ---------- Presets and animation ----------
  const now: Look = cloneLook(LOOKS.showroom);
  let goal: Look = LOOKS.showroom;

  const apply = (t: number) => {
    bg.copy(now.bg);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(now.bg);
    scene.environmentIntensity = now.env;
    lights.hemi.color.copy(now.sky);
    lights.hemi.groundColor.copy(now.ground);
    lights.hemi.intensity = now.hemiI;
    lights.key.color.copy(now.key);
    lights.key.intensity = now.keyI;
    spots.forEach((s) => {
      s.color.copy(now.spot);
      s.intensity = SPOT_BASE * now.spotI;
    });
    cones.forEach((cn, i) => {
      cn.material.uniforms.uColor.value.copy(now.spot);
      // The beams breathe very gently.
      cn.material.uniforms.uOpacity.value = now.cone * (0.85 + 0.15 * Math.sin(t * 0.6 + i * 2.1));
    });
    ledMat.color.copy(orange).multiplyScalar(now.led);
    ledGlowMat.opacity = 0.42 * Math.min(1.6, now.led);
    haloMat.color.copy(now.halo).multiplyScalar(now.haloI);
    haloGlowMat.opacity = 0.35 * now.haloI;
    coveMat.color.copy(now.cove).multiplyScalar(now.coveI);
    coveGlowMat.opacity = 0.5 * now.coveI;
    coveGlowMat.color.copy(now.cove);
    panelMat.opacity = now.panel;
    poolMat.opacity = now.pool;
    sheenMat.opacity = 0.16 * now.sheen;
    // The gloss turns opaque, hiding the car's reflection underneath it.
    glossMat.opacity = 1 - 0.2 * now.mirror;
    if (mirrorHolder) mirrorHolder.visible = now.mirror > 0.01;
  };
  apply(0);

  return {
    stage,
    carHolder,
    mirrorHolder,
    setPreset(p) {
      goal = LOOKS[p];
    },
    update(dt, t) {
      // About 600 ms to settle on a new preset.
      lerpLook(now, goal, 1 - Math.exp(-dt / 0.2));
      sheenPivot.rotation.y -= dt * 0.35;
      apply(t);
    },
    dispose() {
      scene.remove(root);
      ticks.dispose();
      env.dispose();
      disposables.forEach((d) => d.dispose());
      spots.forEach((s) => s.dispose());
      scene.fog = null;
      scene.background = null;
    },
  };
}

function cloneLook(l: Look): Look {
  const out = { ...l } as Look;
  for (const k of Object.keys(l) as (keyof Look)[]) {
    const v = l[k];
    if (v instanceof THREE.Color) (out[k] as THREE.Color) = v.clone();
  }
  return out;
}

function lerpLook(now: Look, goal: Look, k: number) {
  for (const key of Object.keys(goal) as (keyof Look)[]) {
    const g = goal[key];
    if (g instanceof THREE.Color) (now[key] as THREE.Color).lerp(g, k);
    else (now[key] as number) += ((g as number) - (now[key] as number)) * k;
  }
}
