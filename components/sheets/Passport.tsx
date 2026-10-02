"use client";

/* eslint-disable @next/next/no-img-element */
import { useLayoutEffect, useRef, useState } from "react";
import type { Country } from "@/lib/types";

type Props = { countries: Country[]; countHome: boolean; onCountry: (iso2: string) => void };

// Stable small rotation per country, so ink stamps look hand-pressed but don't jump around.
function tilt(iso: string) {
  const h = iso.charCodeAt(0) * 31 + iso.charCodeAt(1) * 17;
  return (h % 17) - 8;
}

function stampDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y.slice(2)}`;
}

type Geo = { w: number; h: number; centres: Map<string, { x: number; y: number }> };

export default function Passport({ countries, countHome, onCountry }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);

  // Measure tile centres so the web and the silk thread line up with the grid.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const centres = new Map<string, { x: number; y: number }>();
      el.querySelectorAll<HTMLElement>("[data-iso]").forEach((t) => {
        const b = t.getBoundingClientRect();
        centres.set(t.dataset.iso!, { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 });
      });
      setGeo({ w: r.width, h: r.height, centres });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [countries]);

  const hub = countries.find((c) => c.status === "current") ?? countries.find((c) => c.is_home);

  return (
    <div ref={box} className="relative">
      <div className="relative grid grid-cols-4 gap-2.5 sm:grid-cols-6">
        {countries.map((c) => {
          const home = c.is_home && !countHome;
          const stamped = c.status !== "upcoming" && !home;
          const current = c.status === "current";
          return (
            <button
              key={c.iso2}
              data-iso={c.iso2}
              onClick={() => onCountry(c.iso2)}
              className={`group relative aspect-square overflow-hidden border ${current ? "border-orange" : stamped || home ? "border-line-strong" : "border-dashed border-line"}`}
              aria-label={`${c.name}: ${home ? "home base" : stamped ? "visited" : "not yet"}`}
            >
              <img src={`/flags/${c.iso2.toLowerCase()}.svg`} alt="" className={`absolute inset-0 h-full w-full object-cover transition ${stamped || home ? "" : "opacity-[0.16] grayscale group-hover:opacity-40"}`} />
              {(stamped || home) && (
                <span
                  className={`absolute inset-[14%] flex flex-col items-center justify-center rounded-full border-2 bg-ink/75 ${home ? "border-text/80 text-text" : "border-orange text-orange"}`}
                  style={{ transform: `rotate(${tilt(c.iso2)}deg)` }}
                >
                  <span className="font-display text-lg font-bold leading-none">{c.iso2}</span>
                  <span className="mt-1 text-[10px] font-semibold leading-none">{home ? "HOME" : stampDate(c.first_entered_on)}</span>
                </span>
              )}
              {current && <span className="absolute right-1 top-1 h-2 w-2 animate-ping rounded-full bg-orange" />}
              <span className="sr-only">{c.name}</span>
            </button>
          );
        })}
      </div>
      {geo && <Web geo={geo} hub={hub?.iso2} />}
    </div>
  );
}

// A spider web anchored on the current country's stamp.
function Web({ geo, hub }: { geo: Geo; hub?: string }) {
  const c = (hub && geo.centres.get(hub)) || { x: geo.w / 2, y: geo.h / 2 };
  const reach = Math.hypot(Math.max(c.x, geo.w - c.x), Math.max(c.y, geo.h - c.y));
  const SPOKES = 18;
  const angles = Array.from({ length: SPOKES }, (_, i) => (i / SPOKES) * Math.PI * 2 + (i % 3) * 0.04);
  const rings = Array.from({ length: 11 }, (_, i) => 26 + i * i * 7.5 + i * 18).filter((r) => r < reach);
  const pt = (a: number, r: number) => `${(c.x + Math.cos(a) * r).toFixed(1)},${(c.y + Math.sin(a) * r).toFixed(1)}`;

  return (
    <svg className="pointer-events-none absolute inset-0" width={geo.w} height={geo.h} aria-hidden>
      <g stroke="var(--text)" strokeOpacity="0.2" fill="none" strokeWidth="0.75">
        {angles.map((a, i) => (
          <line key={i} x1={c.x} y1={c.y} x2={c.x + Math.cos(a) * reach} y2={c.y + Math.sin(a) * reach} />
        ))}
        {rings.map((r, i) => (
          // Real webs sag between spokes: a slightly smaller radius at each midpoint.
          <polygon key={i} points={angles.flatMap((a, j) => [pt(a, r), pt(a + Math.PI / SPOKES, r * 0.94 - (j % 2))]).join(" ")} />
        ))}
      </g>
    </svg>
  );
}
