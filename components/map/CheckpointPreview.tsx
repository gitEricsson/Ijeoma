"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Journey } from "@/lib/types";
import TrailPreview from "./TrailPreview";
import type { GlobeHandle, TrailPick } from "./Globe";

const SHOW_MS = 2200;
const FADE_MS = 500;

// During replay: the photo card for the checkpoint IJEOMA just reached. It
// stays pinned to the stop on screen while the camera follows the car, then
// fades as she drives on. It repositions itself each frame, so the rest of
// the page doesn't re-render.
export default function CheckpointPreview({ journey, stopId, globe, onDone }: { journey: Journey; stopId: string; globe: RefObject<GlobeHandle | null>; onDone: () => void }) {
  const stop = journey.stops.find((s) => s.id === stopId);
  const [pick, setPick] = useState<TrailPick | null>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!stop) return;
    let raf = 0;
    const place = () => {
      const p = globe.current?.screenPoint([stop.lng, stop.lat]);
      if (p) setPick({ x: p.x, y: p.y, iso2: stop.country_iso2, stopId: stop.id, pinned: false, onRoad: false });
      raf = requestAnimationFrame(place);
    };
    place();
    const fade = setTimeout(() => setFading(true), SHOW_MS);
    const done = setTimeout(onDone, SHOW_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [stop, globe, onDone]);

  return <TrailPreview journey={journey} pick={pick} onOpen={() => {}} onClose={onDone} fading={fading} />;
}
