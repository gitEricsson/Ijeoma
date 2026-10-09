"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// A ring of fire round Michael's photo. On hover (or keyboard focus) the
// flame catches at the top and burns its way round once, like a progress
// ring filling. When the circle is complete it simply keeps burning: flame
// particles rising and cooling from yellow-white to red, never spinning.
// It burns down when the pointer leaves. The canvas sits behind the photo,
// so flames show round its edge and above it.

const PHOTO = 34;
const PAD = 18; // room for flames to rise outside the photo
const SIZE = PHOTO + PAD * 2;
const C = SIZE / 2;
const R = PHOTO / 2 + 1.5; // the burning line, just outside the photo
const IGNITE_MS = 950;
const START = -Math.PI / 2; // top

type P = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; wob: number };

// Soft round sprites, one per stage of a flame's life (hot core to embers).
function sprites(dpr: number) {
  const make = (inner: string, outer: string) => {
    const s = Math.ceil(16 * dpr);
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const ctx = cv.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return cv;
  };
  return [
    make("rgba(255,250,220,1)", "rgba(255,214,110,0.55)"), // hot core
    make("rgba(255,214,90,1)", "rgba(255,150,40,0.55)"),
    make("rgba(255,140,40,1)", "rgba(240,80,20,0.5)"),
    make("rgba(220,60,15,0.9)", "rgba(150,25,8,0.4)"), // cooling red
  ];
}

export default function FireRing({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hot = useRef(false); // pointer is on it
  const sim = useRef({ progress: 0, glow: 0, parts: [] as P[], last: 0, raf: 0 });

  const ignite = useCallback(() => {
    hot.current = true;
    setMounted(true);
  }, []);
  const douse = useCallback(() => {
    hot.current = false;
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const cv = canvas.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = Math.round(SIZE * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const tex = sprites(dpr);
    const s = sim.current;
    s.last = performance.now();

    const emit = (count: number, from: number, to: number) => {
      for (let i = 0; i < count; i++) {
        const a = from + Math.random() * (to - from);
        const ox = Math.cos(a);
        const oy = Math.sin(a);
        const r = R + (Math.random() - 0.5) * 2.2;
        s.parts.push({
          x: C + ox * r,
          y: C + oy * r,
          // Out from the ring, and up: flames rise whichever side they're on.
          vx: ox * (5 + Math.random() * 9),
          vy: oy * (5 + Math.random() * 9) - (12 + Math.random() * 22),
          age: 0,
          life: 0.35 + Math.random() * 0.45,
          size: 4 + Math.random() * 3.5,
          wob: Math.random() * Math.PI * 2,
        });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      // Burn round once on the way in; burn down on the way out.
      if (hot.current) s.progress = Math.min(1, s.progress + (dt * 1000) / IGNITE_MS);
      s.glow += ((hot.current ? 1 : 0) - s.glow) * (1 - Math.exp(-dt / 0.15));
      const end = START + s.progress * Math.PI * 2;

      if (hot.current && s.progress > 0) {
        // Along the lit arc, with a bright burst at the advancing front.
        emit(Math.round(s.progress * 9), START, end);
        if (s.progress < 1) emit(4, end - 0.25, end);
      }

      for (const p of s.parts) {
        p.age += dt;
        p.wob += dt * 9;
        p.vy -= 26 * dt; // heat lifts it faster as it goes
        p.x += (p.vx + Math.sin(p.wob) * 6) * dt;
        p.y += p.vy * dt;
      }
      s.parts = s.parts.filter((p) => p.age < p.life);

      ctx.clearRect(0, 0, SIZE, SIZE);
      // The fuel line: a glowing arc under the flames.
      if (s.progress > 0 && s.glow > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.75 * s.glow;
        ctx.strokeStyle = "rgb(255,120,30)";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.shadowColor = "rgba(255,90,20,0.9)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(C, C, R, START, end);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalCompositeOperation = "lighter";
      for (const p of s.parts) {
        const t = p.age / p.life;
        const img = tex[Math.min(3, Math.floor(t * 4))];
        const size = p.size * (1 - t * 0.7);
        ctx.globalAlpha = Math.max(0, 1 - t) * 0.85;
        ctx.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      // Out and nothing left burning: stop until the next hover.
      if (!hot.current && s.glow < 0.02 && !s.parts.length) {
        s.progress = 0;
        s.glow = 0;
        setMounted(false);
        return;
      }
      s.raf = requestAnimationFrame(frame);
    };
    s.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(s.raf);
  }, [mounted]);

  return (
    <span className="relative block shrink-0" onMouseEnter={ignite} onMouseLeave={douse} onFocus={ignite} onBlur={douse}>
      {mounted && (
        <canvas
          ref={canvas}
          className="pointer-events-none absolute"
          style={{ left: -PAD, top: -PAD, width: SIZE, height: SIZE }}
          aria-hidden
        />
      )}
      <span className="relative z-10 block">{children}</span>
    </span>
  );
}
