"use client";

import { useEffect } from "react";

const HOLD_MS = 2200;

// The opening shot: the globe turns in space for a moment, then the camera
// flies in (Globe handles the flight once `onDone` fires). Only a skip button
// sits on top; the map is the show.
export default function Intro({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(id);
  }, [ready, onDone]);

  return (
    <button onClick={onDone} className="chip pointer-events-auto absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30">
      Skip intro
    </button>
  );
}
