"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LIGHT_PRESETS, type LightPreset } from "@/lib/three/showroom";

const ic = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// One motion button, top right of the stage; its turntable arrow circles
// while the stage turns. Hover it (or focus it, or tap on a touch screen)
// and the controls flow out to its left: a track sweeps open from the
// button, then each control slides in one after another, nearest first.
// Leaving reverses the flow.
export function ShowroomControls({
  turning,
  onToggle,
  onNudge,
  preset,
  onPreset,
  lightsOff,
  onLights,
}: {
  turning: boolean;
  onToggle: () => void;
  onNudge: (dir: -1 | 1) => void;
  preset: LightPreset;
  onPreset: (p: LightPreset) => void;
  /** The showroom lights are off (daylight only, no reflections). */
  lightsOff: boolean;
  onLights: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const open = hovered || pinned;

  // A tap elsewhere closes controls opened by a tap.
  useEffect(() => {
    if (!pinned) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);

  // Items are listed nearest the button first; `i` sets their place in the flow.
  const items: ReactNode[] = [
    <IconButton key="right" label="Turn the stage 45 degrees right" title="Turn 45° right" onClick={() => onNudge(1)}>
      <path d="M12.5 6.5A5 5 0 1 0 13 9.5" />
      <path d="M12.5 2.5v4h-4" />
    </IconButton>,
    <IconButton key="play" label={turning ? "Pause the turntable" : "Turn the turntable"} title={turning ? "Pause" : "Turn"} onClick={onToggle} pressed={turning}>
      {turning ? <path d="M5.5 3.5v9M10.5 3.5v9" strokeWidth={2} /> : <path d="M5 3l8 5-8 5z" fill="currentColor" stroke="none" />}
    </IconButton>,
    <IconButton key="left" label="Turn the stage 45 degrees left" title="Turn 45° left" onClick={() => onNudge(-1)}>
      <path d="M3.5 6.5A5 5 0 1 1 3 9.5" />
      <path d="M3.5 2.5v4h4" />
    </IconButton>,
    // A light bulb, struck through while the lights are off.
    <IconButton key="lights" label={lightsOff ? "Turn the showroom lights on" : "Turn the showroom lights off"} title={lightsOff ? "Lights on" : "Lights off"} onClick={onLights} pressed={lightsOff}>
      <path d="M8 2a4 4 0 0 0-2.4 7.2c.5.4.9 1 .9 1.6V12h3v-1.2c0-.6.4-1.2.9-1.6A4 4 0 0 0 8 2z" />
      <path d="M6.5 14h3" />
      {lightsOff && <path d="M2.5 2.5l11 11" />}
    </IconButton>,
    <div key="light" className="mr-1 flex h-9 items-stretch border border-line text-xs" role="radiogroup" aria-label="Lighting">
      {LIGHT_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={!lightsOff && preset === p.id}
          tabIndex={open ? 0 : -1}
          onClick={() => onPreset(p.id)}
          className={`px-2.5 transition-colors ${!lightsOff && preset === p.id ? "bg-orange-fill text-on-orange" : "text-muted hover:text-text"}`}
        >
          {p.label}
        </button>
      ))}
    </div>,
  ];

  const flow = (i: number): CSSProperties => ({
    opacity: open ? 1 : 0,
    transform: open ? "translateX(0) scale(1)" : "translateX(14px) scale(0.9)",
    transition: `opacity 260ms ${EASE}, transform 360ms ${EASE}`,
    // Out: nearest first. Back in: farthest first.
    transitionDelay: `${open ? 70 + i * 55 : (items.length - 1 - i) * 40}ms`,
  });

  return (
    <div
      ref={wrap}
      className="absolute right-3 top-3 flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => !wrap.current?.contains(e.relatedTarget as Node) && setHovered(false)}
    >
      {/* The track sweeps open from the button, then the controls flow in over it. */}
      <div
        className="relative mr-2 flex flex-row-reverse items-center gap-1 border border-line bg-panel-solid/90 p-1"
        style={{
          clipPath: open ? "inset(0 0 0 0)" : "inset(0 0 0 100%)",
          transition: `clip-path ${open ? 420 : 300}ms ${EASE} ${open ? 0 : 160}ms`,
          pointerEvents: open ? "auto" : "none",
        }}
        aria-hidden={!open}
      >
        {items.map((node, i) => (
          <div key={i} style={flow(i)}>
            {node}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        aria-expanded={open}
        aria-label="Stage controls"
        title="Stage controls"
        className={`grid h-11 w-11 place-items-center border bg-panel-solid transition-colors duration-300 ${open ? "border-orange text-orange" : "border-line text-text"}`}
      >
        {/* Turntable: the stage disc, with an arrow running round it while it turns. */}
        <svg width="24" height="24" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden style={{ transform: open ? "rotate(-12deg)" : "none", transition: `transform 360ms ${EASE}` }}>
          <ellipse cx="11" cy="14" rx="8" ry="3" />
          <path d="M3 14v1.6c0 1.7 3.6 3 8 3s8-1.3 8-3V14" opacity={0.55} />
          <g transform="translate(11 7.5) scale(1 0.42)">
            <g className={turning ? "turntable-spin" : ""}>
              <path d="M-6.5 0A6.5 6.5 0 1 1 0 6.5" vectorEffect="non-scaling-stroke" />
              <path d="M2.6 4.2L0 6.5l2.4 2.6" vectorEffect="non-scaling-stroke" />
            </g>
          </g>
        </svg>
      </button>
    </div>
  );
}

function IconButton({ label, title, onClick, pressed, children }: { label: string; title: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      className="grid h-9 w-9 place-items-center border border-line bg-panel-solid text-text transition-colors hover:border-line-strong hover:text-orange"
    >
      <svg {...ic}>{children}</svg>
    </button>
  );
}
