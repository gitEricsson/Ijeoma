"use client";

/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Sponsor } from "@/lib/types";
import type { LightPreset } from "@/lib/three/showroom";
import { ShowroomControls } from "./ShowroomControls";
import { INSTAGRAM_DM, SECTIONS, SPOTS, type SectionId } from "@/lib/site";
import { MODEL_CREDIT } from "@/lib/three/ijeoma";
import { hasSticker, sponsorsBySection } from "@/lib/sponsors";

const GarageViewer = dynamic(() => import("./GarageViewer"), { ssr: false, loading: () => <div className="label grid h-full place-items-center">Bringing IJEOMA out…</div> });

type Props = { open: boolean; onClose: () => void; sponsors: Sponsor[]; low: boolean };

// Sponsors by side of the car. Pick a side to fly to it; pick a sponsor to
// zoom onto their sticker, and again to zoom back out. A side can carry
// many sponsors, so nothing here claims how much space is left.
export default function Garage({ open, onClose, sponsors, low }: Props) {
  const reduce = useReducedMotion() ?? false;
  const [section, setSection] = useState<SectionId | null>(null);
  // The sponsor (row id) whose sticker is zoomed into.
  const [zoomed, setZoomed] = useState<string | null>(null);
  const bySection = useMemo(() => sponsorsBySection(sponsors), [sponsors]);
  // Brands, not stickers: a sponsor on two spots (JEFFFOREX, Solsync) counts once.
  const brandCount = useMemo(() => new Set(sponsors.filter((s) => s.active).map((s) => s.name.trim().toLowerCase())).size, [sponsors]);
  const onSide = section ? (bySection.get(section) ?? []) : [];
  const zoomSpot = sponsors.find((s) => s.id === zoomed)?.panel ?? null;
  const label = SECTIONS.find((s) => s.id === section)?.label;

  const pickSection = (id: SectionId) => {
    setZoomed(null);
    setSection((cur) => (cur === id ? null : id));
  };
  const toggleZoom = (s: Sponsor) => setZoomed((cur) => (cur === s.id ? null : s.id));
  // A sticker tapped on the car: its side, zoomed in (or out, if it already is).
  const pickSticker = (spot: string) => {
    const first = bySection.get(SPOTS[spot])?.find((s) => s.panel === spot);
    if (!first) return;
    setSection(SPOTS[spot]);
    setZoomed((cur) => (cur && sponsors.find((s) => s.id === cur)?.panel === spot ? null : first.id));
  };
  const reset = () => {
    setZoomed(null);
    setSection(null);
  };
  // Showroom: lighting, turntable on or off, and 45 degree nudges.
  const [preset, setPreset] = useState<LightPreset>("showroom");
  // Lights off: daylight only, no lamps or reflections. Picking a preset turns them back on.
  const [lightsOff, setLightsOff] = useState(false);
  const [turning, setTurning] = useState(true);
  const [nudge, setNudge] = useState<{ dir: -1 | 1; id: number } | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="dialog"
          aria-label="IJEOMA garage"
          className="pointer-events-auto fixed inset-0 z-40 thin-scroll flex flex-col overflow-y-auto bg-ink"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <header className="flex items-start justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <div>
              <h2 className="font-display text-3xl uppercase leading-none">IJEOMA</h2>
              <p className="mt-1.5 text-sm text-muted">
                {brandCount} {brandCount === 1 ? "sponsor" : "sponsors"}
              </p>
            </div>
            <button onClick={onClose} className="-mr-2 grid h-10 w-10 place-items-center text-muted hover:text-text" aria-label="Close garage">
              <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </header>

          <div className="relative min-h-[260px] flex-1">
            <GarageViewer
              sponsors={sponsors}
              section={section}
              zoomSpot={zoomSpot}
              onPickSticker={pickSticker}
              low={low}
              reduced={reduce}
              preset={lightsOff ? "off" : preset}
              turning={turning}
              nudge={nudge}
            />
            <ShowroomControls
              turning={turning}
              onToggle={() => setTurning((v) => !v)}
              onNudge={(dir) => setNudge({ dir, id: performance.now() })}
              preset={preset}
              onPreset={(p) => {
                setPreset(p);
                setLightsOff(false);
              }}
              lightsOff={lightsOff}
              onLights={() => setLightsOff((v) => !v)}
            />
            {section && (
              <button onClick={reset} className="chip absolute left-3 top-3" aria-label="Back to the full view of the car">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M8.5 3L4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Full view
              </button>
            )}
            <a href={MODEL_CREDIT.url} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-3 text-[10px] text-muted/70 hover:text-muted">
              {MODEL_CREDIT.text}
            </a>
          </div>

          <div className="border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {/* The sides of the car. Picking the side in view again goes back to the whole car. */}
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
              {SECTIONS.map(({ id, label }) => {
                const n = bySection.get(id)?.length ?? 0;
                return (
                  <button
                    key={id}
                    onClick={() => pickSection(id)}
                    aria-pressed={section === id}
                    className={`flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-sm ${section === id ? "border-orange text-orange" : n ? "border-line-strong text-text" : "border-line text-muted"}`}
                  >
                    {label}
                    {n > 0 && <span className={section === id ? "text-orange/70" : "text-muted"}>{n}</span>}
                  </button>
                );
              })}
            </div>
            <div className="min-h-[92px] border border-line bg-panel-solid p-4">
              {!section && <p className="text-sm text-muted">Pick a side of the car to see its sponsors, or tap a sticker on her.</p>}
              {section && onSide.length > 0 && (
                <>
                  <div className="text-sm text-muted">
                    {label} · {onSide.length} {onSide.length === 1 ? "sponsor" : "sponsors"}
                  </div>
                  <ul className="mt-1 flex flex-col divide-y divide-line">
                    {onSide.map((s) => {
                      const active = zoomed === s.id;
                      const body = (
                        <>
                          {s.logo_url && <img src={s.logo_url} alt="" className="h-9 w-14 shrink-0 object-contain sm:h-10 sm:w-20" />}
                          <span className="font-display min-w-0 flex-1 text-lg leading-tight [overflow-wrap:anywhere] sm:text-2xl">{s.name}</span>
                        </>
                      );
                      return (
                        <li key={s.id} className="flex items-center gap-3 py-2">
                          {hasSticker(s) ? (
                            // Zooms onto the sponsor's sticker; again zooms back out.
                            <button
                              onClick={() => toggleZoom(s)}
                              aria-pressed={active}
                              aria-label={`${s.name}: ${active ? "zoom out" : "zoom in on their sticker"}`}
                              className={`-my-1 -ml-2 flex min-w-0 flex-1 items-center gap-3 border px-2 py-1 text-left transition-colors sm:gap-4 ${active ? "border-orange" : "border-transparent hover:border-line-strong"}`}
                            >
                              {body}
                              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={`shrink-0 ${active ? "text-orange" : "text-muted"}`}>
                                <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M11.5 11.5L16 16M5 7.5h5" stroke="currentColor" strokeWidth="1.5" />
                                {!active && <path d="M7.5 5v5" stroke="currentColor" strokeWidth="1.5" />}
                              </svg>
                            </button>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">{body}</div>
                          )}
                          {s.link && (
                            <a href={s.link} target="_blank" rel="noopener noreferrer sponsored" className="btn shrink-0">
                              Visit
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <a href={INSTAGRAM_DM} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-muted underline-offset-4 hover:text-text hover:underline">
                    Put your brand on this side too
                  </a>
                </>
              )}
              {section && onSide.length === 0 && (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-muted">{label}</div>
                    <div className="mt-0.5">No sponsors here yet.</div>
                  </div>
                  <a href={INSTAGRAM_DM} target="_blank" rel="noopener noreferrer" className="btn-primary shrink-0">
                    Sponsor this side
                  </a>
                </div>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
