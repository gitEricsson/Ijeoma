"use client";

/* eslint-disable @next/next/no-img-element */
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Sponsor } from "@/lib/types";
import { INSTAGRAM_DM, PANELS } from "@/lib/site";
import { MODEL_CREDIT } from "@/lib/three/ijeoma";
import { sponsorsByPanel } from "@/lib/sponsors";

const GarageViewer = dynamic(() => import("./GarageViewer"), { ssr: false, loading: () => <div className="label grid h-full place-items-center">Bringing IJEOMA out…</div> });

type Props = { open: boolean; onClose: () => void; sponsors: Sponsor[]; low: boolean };

// A panel can carry several sponsors, so nothing here claims how much space is left.
export default function Garage({ open, onClose, sponsors, low }: Props) {
  const reduce = useReducedMotion() ?? false;
  const [selected, setSelected] = useState<string | null>(null);
  const byPanel = useMemo(() => sponsorsByPanel(sponsors), [sponsors]);
  const onPanel = selected ? (byPanel.get(selected) ?? []) : [];
  const total = sponsors.filter((s) => s.active).length;

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
              <p className="mt-1 text-sm text-muted">
                Mercedes-Benz ML350{total > 0 ? `, carrying ${total} ${total === 1 ? "sponsor" : "sponsors"}` : ""}.
              </p>
            </div>
            <button onClick={onClose} className="-mr-2 grid h-10 w-10 place-items-center text-muted hover:text-text" aria-label="Close garage">
              <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </header>

          <div className="relative min-h-[260px] flex-1">
            <GarageViewer sponsors={sponsors} selected={selected} onSelect={setSelected} low={low} reduced={reduce} />
            {selected && (
              <button onClick={() => setSelected(null)} className="chip absolute left-3 top-3" aria-label="Back to the full view of the car">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M8.5 3L4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Full view
              </button>
            )}
            <a href={MODEL_CREDIT.url} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-3 text-[11px] text-muted/70 hover:text-muted">
              Model: {MODEL_CREDIT.text}
            </a>
          </div>

          <div className="border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {/* Tap equivalent of the 3D panels. */}
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
              {PANELS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelected(p)}
                  className={`shrink-0 border px-2.5 py-1.5 text-sm capitalize ${selected === p ? "border-orange text-orange" : byPanel.has(p) ? "border-line-strong text-text" : "border-line text-muted"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="min-h-[92px] border border-line bg-panel-solid p-4">
              {!selected && <p className="text-sm text-muted">Tap a panel on the car, or pick one above.</p>}
              {selected && onPanel.length > 0 && (
                <>
                  <div className="text-sm capitalize text-muted">{selected}</div>
                  <ul className="mt-1 flex flex-col divide-y divide-line">
                    {onPanel.map((s) => (
                      <li key={s.id} className="flex items-center gap-4 py-2">
                        {s.logo_url && <img src={s.logo_url} alt="" className="h-10 w-10 shrink-0 object-contain" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-display truncate text-2xl">{s.name}</div>
                          <div className="text-sm text-muted">{s.tier}</div>
                        </div>
                        {s.link && (
                          <a href={s.link} target="_blank" rel="noopener noreferrer sponsored" className="btn shrink-0">
                            Visit
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                  <a href={INSTAGRAM_DM} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-muted underline-offset-4 hover:text-text hover:underline">
                    Put your brand here too
                  </a>
                </>
              )}
              {selected && onPanel.length === 0 && (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm capitalize text-muted">{selected}</div>
                    <div className="mt-0.5">No sponsor here yet.</div>
                  </div>
                  <a href={INSTAGRAM_DM} target="_blank" rel="noopener noreferrer" className="btn-primary shrink-0">
                    Sponsor this panel
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
