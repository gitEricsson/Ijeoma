"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { Journey } from "@/lib/types";
import { fmtRange } from "@/lib/format";
import { photoFor } from "@/lib/photos";
import WavingFlag from "@/components/WavingFlag";
import type { TrailPick } from "./Globe";

const W = 220;
const IMG_H = 160;

// The picture card for a spot on the trail. Follows the pointer on desktop;
// on phones it's pinned where you tapped, with a button to open the stop.
export default function TrailPreview({ journey, pick, onOpen, onClose }: { journey: Journey; pick: TrailPick | null; onOpen: (stopId: string) => void; onClose: () => void }) {
  const [vw, setVw] = useState({ w: 1024, h: 768 });
  useEffect(() => {
    const update = () => setVw({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!pick) return null;
  const stop = journey.stops.find((s) => s.id === pick.stopId);
  const country = journey.countries.find((c) => c.iso2 === pick.iso2);
  // On a stretch of road, the stop's own photo would be of somewhere else.
  const photo = photoFor(journey, pick.iso2, pick.onRoad ? null : pick.stopId);
  const height = (photo ? IMG_H : 0) + (pick.pinned ? 92 : 54);

  // Above the pointer when there's room, otherwise below; always on screen.
  const left = Math.min(Math.max(12, pick.x - W / 2), vw.w - W - 12);
  const above = pick.y - height - 18 > 8;
  const top = above ? pick.y - height - 18 : Math.min(pick.y + 18, vw.h - height - 8);

  return (
    <div
      className={`absolute z-30 overflow-hidden border border-line-strong bg-panel-solid shadow-[0_12px_32px_rgba(0,0,0,0.45)] ${pick.pinned ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{ left, top, width: W }}
      role={pick.pinned ? "dialog" : "tooltip"}
      aria-label={country?.name ?? "Trail"}
    >
      {/* Story frames are portrait: bias the crop low, where people and roads usually are. */}
      {photo && <img src={photo} alt="" className="block w-full object-cover" style={{ height: IMG_H, objectPosition: "50% 72%" }} />}
      <div className="p-2.5">
        <div className="flex items-center gap-1.5 text-[13px] font-medium">
          {country && <WavingFlag iso={country.iso2} height={13} />}
          <span className="truncate">{country?.name ?? "On the road"}</span>
        </div>
        {stop && (
          <div className="mt-0.5 truncate text-xs text-muted">
            {pick.onRoad ? `On the road to ${stop.city}` : `${stop.city}, ${fmtRange(stop.arrived_on, stop.left_on)}`}
          </div>
        )}
        {pick.pinned && stop && (
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => onOpen(stop.id)} className="btn-primary flex-1 py-1.5! text-[13px]!">
              Open {stop.city}
            </button>
            <button onClick={onClose} className="chip py-1.5! text-xs!" aria-label="Close preview">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
