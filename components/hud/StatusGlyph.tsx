import { useId } from "react";
import type { SiteState } from "@/lib/types";

// The mark beside "On the road in …": what IJEOMA is doing, at a glance.
// Driving: a short stretch of road whose centre line runs back under her
// (an orange arrowhead holding its place, as if seen from a chase car).
// At base: a still pin. Paused: two dim bars. Only the driving mark moves.
export default function StatusGlyph({ status }: { status: SiteState["status"] }) {
  // The HUD can be on the page twice; each copy needs its own mask ids.
  const id = `road${useId().replace(/[^\w-]/g, "")}`;
  if (status === "at_base") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--orange)" strokeOpacity="0.35" />
        <circle cx="7" cy="7" r="3" fill="var(--orange)" />
      </svg>
    );
  }
  if (status === "paused") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-muted">
        <rect x="3.5" y="3" width="2.2" height="8" rx="0.6" fill="currentColor" />
        <rect x="8.3" y="3" width="2.2" height="8" rx="0.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        {/* The road fades out at both ends, so it reads as a stretch of a longer one. */}
        <linearGradient id={`${id}fade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff" />
          <stop offset="0.85" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}mask`}>
          <rect width="26" height="12" fill={`url(#${id}fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}mask)`}>
        {/* Kerbs, then the centre line running back. */}
        <path d="M0 1.5H26M0 10.5H26" stroke="var(--line-strong)" strokeWidth="1" />
        <path className="road-run" d="M-6 6H32" stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 3" />
      </g>
      {/* IJEOMA, heading east along the road. */}
      <path d="M15.5 3.2L21.5 6L15.5 8.8L17 6Z" fill="var(--orange)" />
    </svg>
  );
}
