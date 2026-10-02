"use client";

import { DONATE_URL } from "@/lib/site";
import { track } from "@/lib/track";

// The Donate plate: IJEOMA orange with a highlight that passes every few seconds.
export default function DonateButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("donate")}
      className={`donate relative flex min-h-[56px] items-center justify-center overflow-hidden bg-orange-fill px-4 text-on-orange transition active:scale-[0.98] ${className}`}
      aria-label="Donate to the cancer awareness campaign"
    >
      <span className="donate-sheen pointer-events-none absolute inset-y-0 left-0 w-10" aria-hidden />
      <span className="font-display relative text-lg uppercase sm:text-xl">Donate</span>
    </a>
  );
}
