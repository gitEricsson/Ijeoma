"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate } from "@/lib/format";

type Label = { date: string | null; from: string; to: string };

type Props = {
  /** Moves the map; returns the label for that progress. */
  seek: (p: number) => Label;
  onClose: () => void;
  reduced: boolean;
};

const PLAY_MS = 22_000; // the whole journey, start to today

// Drag the timeline and IJEOMA drives every leg in order.
export default function ReplayBar({ seek, onClose, reduced }: Props) {
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [label, setLabel] = useState<Label>({ date: null, from: "", to: "" });
  const pRef = useRef(0);
  const seekRef = useRef(seek);
  useEffect(() => {
    seekRef.current = seek;
  });

  const go = (v: number) => {
    pRef.current = v;
    setP(v);
    setLabel(seekRef.current(v));
  };

  // Start from the beginning when opened.
  useEffect(() => {
    const id = requestAnimationFrame(() => go(0));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const next = Math.min(1, pRef.current + (now - last) / PLAY_MS);
      last = now;
      go(next);
      if (next >= 1) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div data-map-cover="replay" className="pointer-events-auto absolute border border-line bg-panel-solid inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4rem)] z-20 p-3 md:inset-x-auto md:bottom-24 md:right-5 md:w-[460px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted">Replay</div>
          <div className="font-display truncate text-lg">
            {label.from ? (
              <>
                {label.from} to {label.to}
              </>
            ) : (
              "No roads yet"
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm">{fmtDate(label.date)}</div>
          <button onClick={onClose} className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">
            Back to today
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            if (pRef.current >= 1) go(0);
            setPlaying((v) => !v);
          }}
          className="grid h-10 w-10 shrink-0 place-items-center bg-orange-fill text-on-orange"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect x="1" y="1" width="3.5" height="10" fill="currentColor" />
              <rect x="7.5" y="1" width="3.5" height="10" fill="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 1l9 5-9 5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(p * 1000)}
          onChange={(e) => {
            setPlaying(false);
            go(Number(e.target.value) / 1000);
          }}
          className="replay-range w-full"
          aria-label="Journey timeline"
        />
      </div>
    </div>
  );
}
