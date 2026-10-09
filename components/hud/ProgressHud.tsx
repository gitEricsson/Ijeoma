"use client";

import Image from "next/image";
import type { Country, Raised, SiteState, Stats } from "@/lib/types";
import { fmtUsd } from "@/lib/format";
import { BUILDER_URL, INSTAGRAM_URL } from "@/lib/site";
import WavingFlag from "@/components/WavingFlag";
import FireRing from "./FireRing";
import { useCountUp } from "./useCountUp";

type Props = {
  stats: Stats;
  site: SiteState;
  raised: Raised;
  current: Country | null;
  onCountry: (iso2: string) => void;
  /** ms until the HUD is on screen, so the numbers count up where you can see them. */
  countDelay?: number;
};

const STATUS = { on_the_road: "On the road in", at_base: "At base in", paused: "Paused in" } as const;

export default function ProgressHud({ stats, site, raised, current, onCountry, countDelay = 0 }: Props) {
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

      {current && (
        <div className="mt-3 text-sm">
          <button onClick={() => onCountry(current.iso2)} className="flex min-w-0 max-w-full items-center gap-2 text-left">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange" />
            </span>
            <span className="truncate">
              {STATUS[site.status]} <WavingFlag iso={current.iso2} className="mx-0.5" /> {current.name}
            </span>
          </button>
        </div>
      )}

      <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">
        Designed and built by{" "}
        <a href={BUILDER_URL} target="_blank" rel="noopener noreferrer" className="text-text transition-colors hover:text-orange">
          Ericsson Raphael
        </a>
      </p>
    </header>
  );
}
