import * as THREE from "three";
import type { Map as MLMap } from "maplibre-gl";
import type { LngLat } from "@/lib/routing";
import { haversineKm } from "@/lib/routing";
import { IJEOMA_ORANGE } from "./car";
import { applyCarLook, BODY_NAME, loadIjeoma, WHEEL_NAMES } from "./ijeoma";

// IJEOMA on the map: a three.js render in a small transparent canvas that
// follows a point on the trail every map frame. MapLibre v6's globe has no
// model-matrix helper for custom layers, so an overlay is the dependable way
// to put a 3D model on the globe.
//
// Motion is eased in screen space: the heading turns towards its target with
// frame-time damping (shortest way round) and the position is lightly smoothed,
// so corners and speed changes never snap, whatever the frame rate.
//
// While she drives, the wheels roll with her real on-screen travel and the
// body rides on a little suspension: three out-of-step waves plus the odd
// pothole on a damped spring, scaled by speed, so she's still when parked.

const SIZE = 180; // css px of the overlay canvas
const YAW_TAU = 0.16; // seconds
const POS_TAU = 0.06;
const PX_PER_UNIT = SIZE / 6.8; // the camera frames 6.8 m across the canvas
const WHEEL_R = 0.37; // metres
const MAX_REV_PER_S = 2; // faster and the five spokes strobe backwards
const SPEED_TAU = 0.25;

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
  // Driving: wheels, suspension and how fast she's going (screen px/s).
  private sprung: THREE.Object3D | null = null;
  private wheels: THREE.Object3D[] = [];
  private readonly bumpy: boolean;
  private prevPos: LngLat | null = null;
  private speed = 0;
  private spin = 0;
  private clock = 0;
  private bump = { y: 0, v: 0, next: 2 };

  constructor(parent: HTMLElement, opts: { low: boolean; reduced?: boolean; onClick: () => void }) {
    this.smooth = !opts.reduced;
    this.bumpy = !opts.reduced;
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
        this.sprung = this.body.getObjectByName(BODY_NAME) ?? null;
        this.wheels = WHEEL_NAMES.map((n) => this.body.getObjectByName(n)).filter((w): w is THREE.Object3D => !!w);
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
      this.prevPos = null;
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

    this.drive(map, pos, p, dt, scale);

    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(90 - map.getPitch(), 32, 62));
    this.camera.position.set(0, Math.sin(elev) * 20, Math.cos(elev) * 20);
    this.camera.lookAt(0, 0.6, 0);

    // The map repaints for its own animations (the glow, the ripple); the car
    // only needs drawing again when her heading, size, tilt, wheels or ride change.
    const sp = this.sprung;
    const ride = sp ? `${sp.position.y.toFixed(4)}|${sp.rotation.x.toFixed(4)}|${sp.rotation.z.toFixed(4)}` : "";
    const key = `${this.yaw.toFixed(4)}|${scale.toFixed(4)}|${elev.toFixed(4)}|${this.spin.toFixed(3)}|${ride}`;
    if (key !== this.drawn) {
      this.renderer.render(this.scene, this.camera);
      this.drawn = key;
    }

    // Keep drawing until the turn, position and suspension have settled.
    const settling =
      Math.abs(shortestAngle(this.yaw, target)) > 0.002 ||
      Math.hypot(p.x - this.screen.x, p.y - this.screen.y) > 0.3 ||
      this.speed > 0.5 ||
      Math.abs(this.bump.y) > 1e-4 ||
      Math.abs(this.bump.v) > 1e-3;
    if (settling) requestAnimationFrame(() => !this.disposed && map.triggerRepaint());
  }

  // Wheels and suspension from how far she moved this frame. Both ends are
  // projected with the current camera, so panning and zooming don't count.
  private drive(map: MLMap, pos: LngLat, p: { x: number; y: number }, dt: number, scale: number) {
    let moved = 0;
    if (this.prevPos && dt > 0) {
      const q = map.project(this.prevPos);
      moved = Math.hypot(p.x - q.x, p.y - q.y);
    }
    this.prevPos = pos;
    const target = dt > 0 ? Math.min(moved / dt, 2000) : 0;
    if (dt > 0) this.speed += (target - this.speed) * (1 - Math.exp(-dt / SPEED_TAU));

    // Rolling: arc length over radius, capped so the spokes don't strobe.
    const wheelPx = Math.max(1, WHEEL_R * scale * PX_PER_UNIT);
    this.spin -= Math.min(moved / wheelPx, MAX_REV_PER_S * 2 * Math.PI * dt);
    for (const w of this.wheels) w.rotation.z = this.spin;

    const sp = this.sprung;
    if (!sp || !this.bumpy || dt === 0) return;
    const m = Math.min(1, this.speed / 60); // 0 parked, 1 at cruising speed
    this.clock += dt;
    // The odd pothole: a kick to a damped spring every 2 to 5 seconds.
    if (m > 0.2 && this.clock > this.bump.next) {
      this.bump.v -= (0.35 + Math.random() * 0.35) * m;
      this.bump.next = this.clock + 2 + Math.random() * 3;
    }
    for (let left = dt; left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      this.bump.v += (-180 * this.bump.y - 11 * this.bump.v) * h;
      this.bump.y += this.bump.v * h;
    }
    const wave = (hz: number, phase: number) => Math.sin(2 * Math.PI * hz * this.clock + phase);
    const road = 0.55 * wave(1.3, 0) + 0.3 * wave(2.1, 1.3) + 0.15 * wave(3.7, 2.1);
    // Exaggerated a little: at map size a true 2 cm ride would be under a pixel.
    sp.position.y = m * 0.05 * road + this.bump.y;
    sp.rotation.z = m * 0.02 * wave(1.1, 0.7) + this.bump.y * 0.35; // pitch
    sp.rotation.x = m * 0.014 * wave(0.9, 2.4); // roll
  }

  dispose() {
    this.disposed = true;
    this.renderer.dispose();
    this.canvas.remove();
  }
}
