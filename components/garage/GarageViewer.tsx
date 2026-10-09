"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { logoTexture, panelTexture } from "@/lib/three/car";
import { addStickers, applyCarLook, loadIjeoma, STICKER_SPOTS, stickerFrame } from "@/lib/three/ijeoma";
import { buildShowroom, STAGE_TOP, type LightPreset } from "@/lib/three/showroom";
import type { SectionId } from "@/lib/site";
import { sponsorsByPanel } from "@/lib/sponsors";
import type { Sponsor } from "@/lib/types";

type Props = {
  sponsors: Sponsor[];
  /** The side of the car in view, or null for the whole car. */
  section: SectionId | null;
  /** The sticker spot zoomed into, or null. */
  zoomSpot: string | null;
  /** A sticker on the car was tapped. */
  onPickSticker: (spot: string) => void;
  low: boolean;
  reduced: boolean;
  preset: LightPreset;
  /** The turntable turns (the play/pause control). */
  turning: boolean;
  /** Turn the stage 45 degrees left (-1) or right (1); `id` changes on each press. */
  nudge: { dir: -1 | 1; id: number } | null;
};

type Vec = [number, number, number];
// How the camera shows each side (car space: front +x, right +z, up +y):
// what it looks at (on that side's surface, so the distance frames the
// panels themselves), the direction it looks from, and the half-width and
// half-height (m) that must fit in the frame.
const SECTION_VIEW: Record<SectionId, { target: Vec; dir: Vec; frame: [number, number] }> = {
  front: { target: [2.2, 0.95, 0], dir: [1, 0.42, 0.3], frame: [1.3, 0.85] },
  right: { target: [0, 0.98, 0.9], dir: [0.06, 0.2, 1], frame: [2.75, 0.95] },
  left: { target: [0, 0.98, -0.9], dir: [0.06, 0.2, -1], frame: [2.75, 0.95] },
  rear: { target: [-2.25, 1.1, 0], dir: [-1, 0.32, 0.12], frame: [1.3, 0.85] },
  roof: { target: [-0.2, 1.75, 0], dir: [0.45, 1.5, 0.6], frame: [2.6, 1.3] },
};
// Roughly eye level, three-quarter front, more side than nose: how a
// showroom shows a car (matched to the reference framing, 60° round, 10° up).
const HOME_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 10.3), THREE.MathUtils.degToRad(90 - 60.4));
const HOME_TARGET = new THREE.Vector3(0, 0.67 + STAGE_TOP, 0);
// How close you can orbit: the whole car, a side, a sticker.
const MIN_DIST = { home: 3.6, section: 1.2, zoom: 0.25 };
const TURN_SPEED = 0.16; // rad/s: one turn in about 40 s

type View = { kind: "home" } | { kind: "section"; section: SectionId } | { kind: "zoom"; spot: string };
const viewOf = (section: SectionId | null, zoomSpot: string | null): View =>
  zoomSpot && STICKER_SPOTS[zoomSpot] ? { kind: "zoom", spot: zoomSpot } : section ? { kind: "section", section } : { kind: "home" };

// IJEOMA in the garage: a showroom turntable under spotlights. Orbit the car;
// pick a side to fly to it, and a sponsor (or tap a sticker) to zoom onto
// their sticker.
export default function GarageViewer({ sponsors, section, zoomSpot, onPickSticker, low, reduced, preset, turning, nudge }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const api = useRef<{
    show: (v: View) => void;
    preset: (p: LightPreset) => void;
    nudge: (dir: -1 | 1) => void;
  } | null>(null);
  const turningRef = useRef(turning);
  const presetRef = useRef(preset);
  const viewRef = useRef<View>(viewOf(section, zoomSpot));
  const onPickRef = useRef(onPickSticker);
  useEffect(() => {
    onPickRef.current = onPickSticker;
  });

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true });
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    // No shadow maps: each would add shaders to compile before IJEOMA can
    // appear; the stage's soft contact shadow grounds her instead.
    renderer.shadowMap.enabled = false;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    // Hidden until the car is on stage and its shaders are compiled, then
    // faded in: no half-lit or wrong-coloured frames on the way.
    Object.assign(renderer.domElement.style, { opacity: "0", transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)" });

    const scene = new THREE.Scene();
    // Exposure tuned so the paint measures close to IJEOMA's #e9401e under the showroom lights.
    const lights = applyCarLook(renderer, scene, { shadows: false, environment: false, exposure: 1.6 });
    const room = buildShowroom(renderer, scene, lights, { low });
    room.setPreset(presetRef.current);
    // Load-time marks (garage:open → garage:model → garage:ready), readable in DevTools.
    performance.mark("garage:open");
    // With Reduce motion on, everything still moves, just more gently.
    const flyMs = reduced ? 400 : 900;
    const turnSpeed = reduced ? TURN_SPEED / 2 : TURN_SPEED;
    let disposed = false;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
    // Measured from the target: resize() keeps this direction, only the distance changes.
    camera.position.copy(HOME_DIR).multiplyScalar(8).add(HOME_TARGET);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(HOME_TARGET);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = MIN_DIST.home;
    controls.maxPolarAngle = Math.PI / 2.05;
    // The stage turns the car; the camera stays put unless you drag it.
    controls.autoRotate = false;

    // Turntable: a steady turn, 45 degree nudges, paused while a side or sticker is in view.
    // It starts once she's revealed, so the first view is always the home view.
    let nudgeTo: number | null = null;
    let revealed = false;

    // Stickers are decals on the real W166, added once the model has loaded.
    let stickers = new Map<string, THREE.Mesh>();
    const onSpot = sponsorsByPanel(sponsors);
    const textures: THREE.Texture[] = [];

    // Camera flights: to the whole car, a side, or a sticker. The camera
    // swings round the car (spherical interpolation) rather than cutting through it.
    let fit = 8; // full-car distance for the current viewport (see resize)
    let current: View = viewRef.current;
    let flight: { from: { target: THREE.Vector3; sph: THREE.Spherical }; to: { target: THREE.Vector3; sph: THREE.Spherical }; start: number; min: number } | null = null;
    const halfH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Distance at which a half-width x half-height box fills the frame.
    const distFor = ([w, h]: [number, number]) => Math.max(w / (halfH() * camera.aspect), h / halfH());
    // Car-space places and directions to the world: the stage may have turned the car.
    const toWorld = (p: Vec) => {
      room.carHolder.updateWorldMatrix(true, false);
      return room.carHolder.localToWorld(new THREE.Vector3(...p));
    };
    const turned = (d: THREE.Vector3) => d.normalize().applyQuaternion(room.stage.quaternion);
    const viewFor = (v: View) => {
      if (v.kind === "section") {
        const s = SECTION_VIEW[v.section];
        return { target: toWorld(s.target), offset: turned(new THREE.Vector3(...s.dir)).multiplyScalar(distFor(s.frame)) };
      }
      if (v.kind === "zoom") {
        const spec = STICKER_SPOTS[v.spot];
        // Square on to the sticker, from a touch above; the logo fills about a third of the frame.
        const dir = stickerFrame(spec).normal.add(new THREE.Vector3(0, 0.18, 0));
        const dist = Math.max(0.55, distFor([Math.max(0.3, spec.size[0] * 1.5), Math.max(0.2, spec.size[1] * 3)]));
        return { target: toWorld(spec.pos), offset: turned(dir).multiplyScalar(dist) };
      }
      return { target: HOME_TARGET.clone(), offset: HOME_DIR.clone().multiplyScalar(fit) };
    };
    const show = (v: View) => {
      current = v;
      if (v.kind !== "home") nudgeTo = null;
      const min = MIN_DIST[v.kind];
      // Let the camera come in before it gets there; tighten the limit on arrival.
      controls.minDistance = Math.min(controls.minDistance, min);
      const { target, offset } = viewFor(v);
      const to = { target, sph: new THREE.Spherical().setFromVector3(offset) };
      const from = { target: controls.target.clone(), sph: new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)) };
      // Shortest way round the car.
      let dTheta = to.sph.theta - from.sph.theta;
      dTheta = ((dTheta + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      to.sph.theta = from.sph.theta + dTheta;
      flight = { from, to, start: performance.now(), min };
    };
    const fly = (now: number) => {
      if (!flight) return;
      const t = Math.min(1, (now - flight.start) / flyMs);
      const e = 1 - Math.pow(1 - t, 4); // ease-out-quart
      const { from, to } = flight;
      controls.target.lerpVectors(from.target, to.target, e);
      const sph = new THREE.Spherical(
        THREE.MathUtils.lerp(from.sph.radius, to.sph.radius, e),
        THREE.MathUtils.lerp(from.sph.phi, to.sph.phi, e),
        THREE.MathUtils.lerp(from.sph.theta, to.sph.theta, e),
      );
      camera.position.setFromSpherical(sph).add(controls.target);
      if (t === 1) {
        controls.minDistance = flight.min;
        flight = null;
      }
    };
    // A drag takes over from a flight in progress.
    controls.addEventListener("start", () => {
      if (flight) controls.minDistance = Math.min(flight.min, camera.position.distanceTo(controls.target));
      flight = null;
    });
    api.current = {
      show,
      preset: (p) => room.setPreset(p),
      nudge: (dir) => {
        const from = nudgeTo ?? room.stage.rotation.y;
        // Snap to the next 45 degree mark in that direction.
        const step = Math.PI / 4;
        nudgeTo = dir > 0 ? (Math.floor(from / step + 1e-3) + 1) * step : (Math.ceil(from / step - 1e-3) - 1) * step;
      },
    };

    // The hall's shaders compile while the car downloads, not after.
    const roomCompiled = renderer.compileAsync(scene, camera).catch(() => {});
    Promise.all([loadIjeoma(), roomCompiled])
      .then(([template]) => {
        if (disposed) return;
        performance.mark("garage:model");
        const real = template.clone(true);
        room.carHolder.add(real);
        // Her reflection in the stage: a mirrored copy sharing the same materials.
        const mirrored = template.clone(true);
        room.mirrorHolder?.add(mirrored);
        // Compile every shader before showing anything (parallel where the
        // GPU driver allows), so the first frames don't stall.
        return renderer.compileAsync(scene, camera).then(() => {
          if (disposed) return;
          renderer.render(scene, camera);
          renderer.domElement.style.opacity = "1";
          revealed = true;
          performance.mark("garage:ready");
          setStatus("ready");
          // Stickers are projected just after the reveal; it's the slowest
          // step and the car doesn't need to wait for it.
          setTimeout(() => {
            if (disposed) return;
            const keep = (tex: THREE.Texture) => (textures.push(tex), tex);
            const made = addStickers(
              real,
              [...onSpot.keys()],
              (spot, aspect) => keep(panelTexture(onSpot.get(spot) ?? [], aspect)),
              (url, aspect) => keep(logoTexture(url, aspect)),
            );
            stickers = made.stickers;
            // The stickers show in her reflection too (same geometry, in car space).
            if (room.mirrorHolder) for (const d of made.all) mirrored.add(d.clone());
          }, 60);
        });
      })
      .catch(() => !disposed && setStatus("error"));

    // Tap/click a sticker (ignore drags).
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects([...stickers.values()], false)[0];
      if (hit) onPickRef.current(hit.object.name);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Frame the whole stage (about 7 m across) on narrow portrait screens too.
      // The car centred with the whole stage around her: about 4.1 m
      // half-width and 2.55 m half-height, whichever needs more distance.
      fit = distFor([4.1, 2.55]);
      controls.maxDistance = fit * 1.8;
      if (current.kind !== "home") {
        // Re-frame the side or sticker for the new size, without a flight.
        const { target, offset } = viewFor(current);
        controls.target.copy(target);
        camera.position.copy(target).add(offset);
      } else camera.position.sub(controls.target).setLength(fit).add(controls.target);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (nudgeTo !== null) {
        const d = nudgeTo - room.stage.rotation.y;
        room.stage.rotation.y += d * (1 - Math.exp(-dt / (reduced ? 0.12 : 0.22)));
        if (Math.abs(d) < 1e-3) {
          room.stage.rotation.y = nudgeTo;
          nudgeTo = null;
        }
      } else if (turningRef.current && current.kind === "home" && revealed) room.stage.rotation.y += turnSpeed * dt;
      room.update(dt, now / 1000);
      fly(now);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      textures.forEach((t) => t.dispose());
      room.dispose();
      stickers.forEach((d) => {
        d.geometry.dispose();
        (d.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [sponsors, low, reduced]);

  // Fly to the side or sticker in view; back to the whole car when cleared.
  useEffect(() => {
    const v = viewOf(section, zoomSpot);
    const prev = viewRef.current;
    viewRef.current = v;
    if (JSON.stringify(prev) !== JSON.stringify(v)) api.current?.show(v);
  }, [section, zoomSpot]);

  useEffect(() => {
    presetRef.current = preset;
    api.current?.preset(preset);
  }, [preset]);

  useEffect(() => {
    turningRef.current = turning;
  }, [turning]);

  useEffect(() => {
    if (nudge) api.current?.nudge(nudge.dir);
  }, [nudge]);

  return (
    <div ref={el} className="relative h-full w-full" aria-label="3D model of IJEOMA, the orange Mercedes-Benz ML350, with her sponsors' stickers. Tap a sticker to zoom in." role="img">
      {status !== "ready" && (
        <div className="label pointer-events-none absolute inset-0 grid place-items-center">{status === "error" ? "IJEOMA couldn't be loaded. Check your connection and reopen the garage." : "Bringing IJEOMA out…"}</div>
      )}
    </div>
  );
}
