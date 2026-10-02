import * as THREE from "three";
import type { Map as MLMap } from "maplibre-gl";
import type { LngLat } from "@/lib/routing";
import { haversineKm } from "@/lib/routing";
import { IJEOMA_ORANGE } from "./car";
import { applyCarLook, loadIjeoma } from "./ijeoma";

// IJEOMA on the map: a three.js render in a small transparent canvas that
// follows a point on the trail every map frame. MapLibre v6's globe has no
// model-matrix helper for custom layers, so an overlay is the dependable way
// to put a 3D model on the globe.
//
// Motion is eased in screen space: the heading turns towards its target with
// frame-time damping (shortest way round) and the position is lightly smoothed,
// so corners and speed changes never snap, whatever the frame rate.

const SIZE = 180; // css px of the overlay canvas
const YAW_TAU = 0.16; // seconds
const POS_TAU = 0.06;

function shortestAngle(from: number, to: number) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export class CarMarker {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  // Empty until the model arrives; nothing is drawn before then.
  private body: THREE.Object3D = new THREE.Group();
  private ready = false;
  private glow: THREE.Mesh;
  private pos: LngLat | null = null;
  private ahead: LngLat | null = null;
  private yaw: number | null = null;
  private screen: { x: number; y: number } | null = null;
  private last = 0;
  private disposed = false;
  private readonly smooth: boolean;
  private map: MLMap | null = null;
  // What the last WebGL frame showed; skip the draw when nothing changed.
  private drawn = "";

  constructor(parent: HTMLElement, opts: { low: boolean; reduced?: boolean; onClick: () => void }) {
    this.smooth = !opts.reduced;
    this.canvas = document.createElement("canvas");
    Object.assign(this.canvas.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${SIZE}px`,
      height: `${SIZE}px`,
      pointerEvents: "none",
      zIndex: "5",
      display: "none",
      willChange: "transform",
    });
    this.canvas.setAttribute("aria-hidden", "true");
    parent.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: !opts.low });
    this.renderer.setPixelRatio(opts.low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(SIZE, SIZE, false);
    // Seen from above, the roof and bonnet face the lights: a little less exposure
    // keeps the orange matching the garage.
    applyCarLook(this.renderer, this.scene, { exposure: 1.12 });

    this.camera = new THREE.OrthographicCamera(-3.4, 3.4, 3.4, -3.4, 0.1, 100);

    // The real W166 (the light version, about 70 KB, so every device gets it).
    loadIjeoma("lite")
      .then((template) => {
        if (this.disposed) return;
        this.body = template.clone(true);
        this.scene.add(this.body);
        this.ready = true;
        this.map?.triggerRepaint();
      })
      .catch(() => {});

    // Orange ground glow under the car, the "you are here" of the trail.
    this.glow = new THREE.Mesh(
      new THREE.CircleGeometry(2.9, 48),
      new THREE.MeshBasicMaterial({ color: IJEOMA_ORANGE, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.01;
    this.scene.add(this.glow);

    this.onClick = opts.onClick;
  }

  readonly onClick: () => void;

  setPosition(pos: LngLat, ahead: LngLat | null) {
    this.pos = pos;
    this.ahead = ahead;
  }

  hitTest(map: MLMap, x: number, y: number) {
    if (!this.screen || this.canvas.style.display === "none") return false;
    return Math.hypot(this.screen.x - x, this.screen.y - y) < 34;
  }

  render(map: MLMap) {
    if (this.disposed) return;
    this.map = map;
    const pos = this.pos;
    const zoom = map.getZoom();
    const center = map.getCenter();
    // Hidden below continent zoom, and when the point is on the far side of the globe.
    if (!this.ready || !pos || zoom < 2.6 || haversineKm([center.lng, center.lat], pos) > 7000) {
      this.canvas.style.display = "none";
      this.screen = null;
      this.yaw = null;
      this.drawn = "";
      return;
    }
    this.canvas.style.display = "block";

    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;

    const p = map.project(pos);
    // When the map itself moves (pan, zoom, fly-in) the car follows exactly so
    // it never drifts off the road; only the car's own travel is smoothed.
    if (!this.screen || !this.smooth || dt === 0 || map.isMoving()) this.screen = { x: p.x, y: p.y };
    else {
      const k = 1 - Math.exp(-dt / POS_TAU);
      this.screen = { x: this.screen.x + (p.x - this.screen.x) * k, y: this.screen.y + (p.y - this.screen.y) * k };
    }
    this.canvas.style.transform = `translate(${this.screen.x - SIZE / 2}px, ${this.screen.y - SIZE / 2 - 10}px)`;

    let target = this.yaw ?? 0;
    if (this.ahead) {
      const q = map.project(this.ahead);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      if (Math.hypot(dx, dy) > 0.5) target = -Math.atan2(dy, dx);
    }
    if (this.yaw === null || !this.smooth || dt === 0) this.yaw = target;
    else this.yaw += shortestAngle(this.yaw, target) * (1 - Math.exp(-dt / YAW_TAU));
    this.body.rotation.y = this.yaw;

    const scale = THREE.MathUtils.clamp(0.36 + (zoom - 3) * 0.15, 0.36, 1.1);
    this.body.scale.setScalar(scale);
    this.glow.scale.setScalar(scale);

    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(90 - map.getPitch(), 32, 62));
    this.camera.position.set(0, Math.sin(elev) * 20, Math.cos(elev) * 20);
    this.camera.lookAt(0, 0.6, 0);

    // The map repaints for its own animations (the glow, the ripple); the car
    // only needs drawing again when her heading, size or tilt changes.
    const key = `${this.yaw.toFixed(4)}|${scale.toFixed(4)}|${elev.toFixed(4)}`;
    if (key !== this.drawn) {
      this.renderer.render(this.scene, this.camera);
      this.drawn = key;
    }

    // Keep drawing until the turn and position have settled.
    const settling = Math.abs(shortestAngle(this.yaw, target)) > 0.002 || Math.hypot(p.x - this.screen.x, p.y - this.screen.y) > 0.3;
    if (settling) requestAnimationFrame(() => !this.disposed && map.triggerRepaint());
  }

  dispose() {
    this.disposed = true;
    this.renderer.dispose();
    this.canvas.remove();
  }
}
