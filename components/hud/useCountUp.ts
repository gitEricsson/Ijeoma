"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `target` once `delay` ms have passed (time it to when the
 * number comes into view). Later changes count on from the current value.
 * Reduced motion shows the number straight away.
 */
export function useCountUp(target: number, { delay = 0, ms = 1800 }: { delay?: number; ms?: number } = {}) {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = shown.current;
    const start = performance.now() + (reduced ? 0 : delay);
    const duration = reduced ? 0 : ms;
    let raf = 0;
    const step = (now: number) => {
      const t = duration ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
      // ease-out-expo: quick off the mark, then settles onto the number.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      shown.current = from + (target - from) * eased;
      setValue(Math.round(shown.current));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, ms]);
  return value;
}
