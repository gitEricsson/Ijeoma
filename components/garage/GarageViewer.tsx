"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { panelTexture } from "@/lib/three/car";
import { addPanelDecals, applyCarLook, loadIjeoma, PANEL_SPECS } from "@/lib/three/ijeoma";
import { sponsorsByPanel } from "@/lib/sponsors";
import type { Sponsor } from "@/lib/types";

type Props = {
  sponsors: Sponsor[];
  selected: string | null;
  onSelect: (panel: string) => void;
  low: boolean;
  reduced: boolean;
};

// Where the camera looks from for each panel: a direction away from the
// panel's centre (car space: front +x, right +z, up +y).
const PANEL_VIEW: Record<string, [number, number, number]> = {
  bonnet: [1, 1.1, 0.35],
  roof: [0.35, 1.5, 0.55],
  "left front door": [0.3, 0.3, -1],
  "left rear door": [-0.3, 0.3, -1],
  "right front door": [0.3, 0.3, 1],
  "right rear door": [-0.3, 0.3, 1],
  tailgate: [-1, 0.3, 0.2],
  "rear window": [-1, 0.45, 0.2],
};
const HOME_DIR = new THREE.Vector3(7.2, 1.9, 6.2).normalize();
const HOME_TARGET = new THREE.Vector3(0, 0.75, 0);
const FLY_MS = 900;
const MIN_DIST = 5;

// IJEOMA in the garage: orbit the car, tap a panel to see who owns it.
export default function GarageViewer({ sponsors, selected, onSelect, low, reduced }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const api = useRef<{ highlight: (p: string | null) => void; focus: (p: string | null) => void } | null>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true });
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !low;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    applyCarLook(renderer, scene, { shadows: !low });
    let disposed = false;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.copy(HOME_DIR).multiplyScalar(8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(HOME_TARGET);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = MIN_DIST;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.8;


    // Floor: dark disc with a thin orange ring and a grid, HUD-style.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1, envMapIntensity: 0 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.63, 96), new THREE.MeshBasicMaterial({ color: 0xff6a13, transparent: true, opacity: 0.6 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);
    const grid = new THREE.GridHelper(12, 24, 0x2a2a2a, 0x1a1a1a);
    grid.position.y = 0.002;
    scene.add(grid);

    // Panels are decals on the real W166, added once the model has loaded.
    let panels = new Map<string, THREE.Mesh>();
    const namesOn = sponsorsByPanel(sponsors);
    const names = (panel: string) => (namesOn.get(panel) ?? []).map((s) => s.name);
    const textures: THREE.Texture[] = [];

    const highlight = (panel: string | null) => {
      for (const [name, mesh] of panels) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const sold = names(name).length > 0;
        mat.color.set(name === panel ? (sold ? 0xfff0e0 : 0xffa060) : 0xffffff);
        // Empty panels stay invisible (but tappable) until selected.
        mat.opacity = name === panel ? 1 : sold ? 0.95 : 0;
      }
    };
    // Camera flights: to a panel, or back to the full car. The camera swings
    // round the car (spherical interpolation) rather than cutting through it.
    let fit = 8; // full-car distance for the current viewport (see resize)
    let focused: string | null = null;
    let flight: { from: { target: THREE.Vector3; sph: THREE.Spherical }; to: { target: THREE.Vector3; sph: THREE.Spherical }; start: number; home: boolean } | null = null;
    const viewFor = (panel: string | null) => {
      const spec = panel ? PANEL_SPECS[panel] : null;
      const dirArr = panel ? PANEL_VIEW[panel] : null;
      if (!spec || !dirArr) return { target: HOME_TARGET.clone(), offset: HOME_DIR.clone().multiplyScalar(fit) };
      // Keep about 2.4 m of car in frame (its narrower side), so the panel fills the view with context around it.
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const dist = Math.max(2.6, 1.2 / (halfH * Math.min(1, camera.aspect)));
      return { target: new THREE.Vector3(...spec.pos), offset: new THREE.Vector3(...dirArr).normalize().multiplyScalar(dist) };
    };
    const focus = (panel: string | null) => {
      focused = panel;
      const { target, offset } = viewFor(panel);
      if (panel) {
        controls.autoRotate = false;
        controls.minDistance = 2;
      }
      const to = { target, sph: new THREE.Spherical().setFromVector3(offset) };
      if (reduced) {
        controls.target.copy(to.target);
        camera.position.setFromSpherical(to.sph).add(to.target);
        if (!panel) controls.minDistance = MIN_DIST;
        flight = null;
        return;
      }
      const from = { target: controls.target.clone(), sph: new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)) };
      // Shortest way round the car.
      let dTheta = to.sph.theta - from.sph.theta;
      dTheta = ((dTheta + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      to.sph.theta = from.sph.theta + dTheta;
      flight = { from, to, start: performance.now(), home: !panel };
    };
    const fly = (now: number) => {
      if (!flight) return;
      const t = Math.min(1, (now - flight.start) / FLY_MS);
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
        if (flight.home) {
          controls.minDistance = MIN_DIST;
          controls.autoRotate = !reduced;
        }
        flight = null;
      }
    };
    // A drag takes over from a flight in progress.
    controls.addEventListener("start", () => {
      if (flight?.home) controls.minDistance = MIN_DIST;
      flight = null;
    });
    api.current = { highlight, focus };

    loadIjeoma()
      .then((template) => {
        if (disposed) return;
        const real = template.clone(true);
        panels = addPanelDecals(real, (name, aspect) => {
          const tex = panelTexture(names(name), aspect);
          textures.push(tex);
          return tex;
        });
        scene.add(real);
        highlight(selectedRef.current);
        setStatus("ready");
      })
      .catch(() => !disposed && setStatus("error"));

    // Tap/click a panel (ignore drags).
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects([...panels.values()], false)[0];
      if (hit) {
        controls.autoRotate = false;
        onSelectRef.current(hit.object.name);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Fit the whole car (about 6.5 m with margin) across narrow portrait screens.
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      fit = Math.max(7.6, 3.3 / (halfH * Math.min(1, camera.aspect)));
      controls.maxDistance = fit * 1.6;
      if (focused) {
        // Re-frame the panel for the new size, without a flight.
        const { target, offset } = viewFor(focused);
        controls.target.copy(target);
        camera.position.copy(target).add(offset);
      } else camera.position.sub(controls.target).setLength(fit).add(controls.target);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    const loop = (now: number) => {
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
      panels.forEach((d) => {
        d.geometry.dispose();
        (d.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [sponsors, low, reduced]);

  useEffect(() => {
    const first = selectedRef.current === selected;
    selectedRef.current = selected;
    api.current?.highlight(selected);
    // Bring the chosen panel into view; back to the whole car when cleared.
    if (!first) api.current?.focus(selected);
  }, [selected]);

  return (
    <div ref={el} className="relative h-full w-full" aria-label="3D model of IJEOMA, the orange Mercedes-Benz ML350. Tap a panel to see its sponsor." role="img">
      {status !== "ready" && (
        <div className="label pointer-events-none absolute inset-0 grid place-items-center">{status === "error" ? "IJEOMA couldn't be loaded. Check your connection and reopen the garage." : "Bringing IJEOMA out…"}</div>
      )}
    </div>
  );
}
