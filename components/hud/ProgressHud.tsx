"use client";

import Image from "next/image";
import type { Country, Raised, SiteState, Stats } from "@/lib/types";
import { fmtUsd } from "@/lib/format";
import { BUILDER_URL, INSTAGRAM_URL, YOUTUBE_URL } from "@/lib/site";
import WavingFlag from "@/components/WavingFlag";
import FireRing from "./FireRing";
import StatusGlyph from "./StatusGlyph";
import { useCountUp } from "./useCountUp";

type Props = {
  stats: Stats;
  site: SiteState;
  raised: Raised;
  current: Country | null;
  onCountry: (iso2: string) => void;
  /** Opens the FAQ (left out where there's no sheet to open, e.g. the no-map fallback). */
  onFaq?: () => void;
  /** ms until the HUD is on screen, so the numbers count up where you can see them. */
  countDelay?: number;
};

const STATUS = { on_the_road: "On the road in", at_base: "At base in", paused: "Paused in" } as const;

export default function ProgressHud({ stats, site, raised, current, onCountry, onFaq, countDelay = 0 }: Props) {
  const countries = useCountUp(stats.countriesVisited, { delay: countDelay });
  const km = useCountUp(stats.approxKm, { delay: countDelay });
  const usd = useCountUp(raised.usd, { delay: countDelay });
  // The bar fills in step with the amount (a sliver stays visible from the first dollar).
  const pct = Math.max(Math.min(100, (raised.usd / raised.goalUsd) * 100), raised.usd > 0 ? 0.6 : 0);
  const fill = raised.usd > 0 ? (pct / 100) * (usd / raised.usd) : 0;

  return (
    <header className="pointer-events-auto hud w-full p-3.5 md:p-5">
      <div className="flex items-center gap-3">
        <FireRing>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="relative z-10 block rounded-full" aria-label="Michael Spyder on Instagram">
            <Image src="/spyder.jpg" alt="" width={34} height={34} className="block rounded-full" />
          </a>
        </FireRing>
        <div className="min-w-0">
          <span className="font-display block text-lg uppercase leading-none">Spydey Tracker</span>
          <p className="mt-1 text-xs leading-snug text-muted md:whitespace-nowrap">Driving all {stats.totalCountries} African countries for cancer awareness</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-display text-[2.6rem] leading-[0.9] md:text-5xl">
            {countries}
            <span className="text-muted">/{stats.totalCountries}</span>
          </div>
          <div className="mt-1 text-sm text-muted">countries driven</div>
        </div>
        <div className="pb-0.5 text-right text-sm leading-snug">
          <div>
            <span className="font-semibold">{km.toLocaleString("en-US")}</span> km of road
          </div>
          {stats.daysOnRoad > 0 && (
            <div>
              <span className="font-semibold">{stats.daysOnRoad}</span> days out
            </div>
          )}
          <div>
            <span className="font-semibold">{stats.expeditions}</span> {stats.expeditions === 1 ? "expedition" : "expeditions"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm">
          <span className="font-semibold text-orange">${usd.toLocaleString("en-US")}</span> raised for cancer awareness
        </p>
        <div className="mt-2 h-[3px] w-full bg-line" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Fundraising progress">
          <div className="h-full origin-left bg-orange" style={{ transform: `scaleX(${fill})` }} />
        </div>
        <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
          <span>Goal {fmtUsd(raised.goalUsd)}</span>
          {raised.donors != null && (
            <span>
              {raised.donors.toLocaleString("en-US")} {raised.donors === 1 ? "donor" : "donors"}
            </span>
          )}
        </div>
      </div>

      {/* Where she is on the left; watch him on YouTube (where the live
          streams are) and the FAQ on the right. */}
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        {current ? (
          <button onClick={() => onCountry(current.iso2)} className="flex min-w-0 items-center gap-2 text-left">
            <StatusGlyph status={site.status} />
            <span className="truncate">
              {STATUS[site.status]} <WavingFlag iso={current.iso2} className="mx-0.5" /> {current.name}
            </span>
          </button>
        ) : (
          <span />
        )}
        {/* Labels as room allows, so the country always shows in full: icons
            alone on phones, "Live" and "FAQ", then "Watch live" on wide screens. */}
        <div className="flex shrink-0 gap-1.5">
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="Watch live on YouTube" title="Watch live on YouTube" className="chip gap-1.5 px-2 transition-colors hover:border-orange hover:text-orange sm:px-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-orange">
              <rect x="1.25" y="3" width="13.5" height="10" rx="2.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6.6 5.9v4.2L10.2 8z" fill="currentColor" />
            </svg>
            <span className="hidden sm:inline xl:hidden">Live</span>
            <span className="hidden xl:inline">Watch live</span>
          </a>
          {onFaq && (
            <button onClick={onFaq} aria-label="FAQ" title="FAQ" className="chip gap-1.5 px-2 transition-colors hover:border-orange hover:text-orange sm:px-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-orange">
                <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.75c-.5.2-.8.6-.8 1.1v.35" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
              </svg>
              <span className="hidden sm:inline">FAQ</span>
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">
        Designed and built by{" "}
        <a href={BUILDER_URL} target="_blank" rel="noopener noreferrer" className="text-text transition-colors hover:text-orange">
          Ericsson Raphael
        </a>
      </p>
    </header>
  );
}
