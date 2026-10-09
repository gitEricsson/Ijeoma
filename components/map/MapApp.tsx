"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Journey, Raised } from "@/lib/types";
import { fmtRange } from "@/lib/format";
import { buildPath, replayLabel } from "@/lib/map/path";
import { hasWebGL, isLowEnd, prefersReducedMotion } from "@/lib/device";
import ProgressHud from "@/components/hud/ProgressHud";
import Flag from "@/components/Flag";
import type { SheetState } from "@/components/sheets/Sheets";
import Intro from "./Intro";
import ReplayBar from "./ReplayBar";
import TrailPreview from "./TrailPreview";
import CheckpointPreview from "./CheckpointPreview";
import { photoFor } from "@/lib/photos";
import DonateButton from "@/components/hud/DonateButton";
import { track } from "@/lib/track";
import type { GlobeHandle, TrailPick } from "./Globe";

const Globe = dynamic(() => import("./Globe"), { ssr: false });
const Garage = dynamic(() => import("@/components/garage/Garage"), { ssr: false });
// Sheets bring framer-motion and the feed; they load once the map is up (or a deep link needs one).
const Sheets = dynamic(() => import("@/components/sheets/Sheets"), { ssr: false });

const INTRO_KEY = "spydey-intro-seen";

// Start fetching the full garage model as soon as someone reaches for the
// IJEOMA button, so it's (nearly) there when the garage opens.
const warmGarage = () => void import("@/lib/three/ijeoma").then((m) => m.loadIjeoma()).catch(() => {});

type Env = { ready: boolean; low: boolean; reduced: boolean; webgl: boolean; intro: boolean };

function NavButton({ label, onClick, children, active, onIntent }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; onIntent?: () => void }) {
  return (
    <button
      onClick={onClick}
      onPointerEnter={onIntent}
      onPointerDown={onIntent}
      onFocus={onIntent}
      className={`flex w-[54px] shrink-0 flex-col items-center justify-center gap-1 border border-line bg-panel-solid py-2 text-[11px] sm:w-16 sm:text-xs ${active ? "text-orange" : "text-text"}`}
    >
      {children}
      {label}
    </button>
  );
}

const icon = { width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.4, "aria-hidden": true } as const;

export default function MapApp({ journey, raised }: { journey: Journey; raised: Raised }) {
  const globe = useRef<GlobeHandle>(null);
  const [env, setEnv] = useState<Env>({ ready: false, low: false, reduced: false, webgl: true, intro: false });
  const [mapReady, setMapReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [sheet, setSheetState] = useState<SheetState>(null);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom: number } | null>(null);
  const [garageOpen, setGarageOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [preview, setPreview] = useState<TrailPick | null>(null);
  // Replay: the checkpoint IJEOMA just reached (its photo shows briefly).
  const [checkpoint, setCheckpoint] = useState<{ stopId: string; key: number } | null>(null);
  const lastSeek = useRef({ p: 0, leg: -1 });

  const path = useMemo(() => buildPath(journey.legs, journey.stops), [journey]);
  const current = journey.countries.find((c) => c.status === "current") ?? null;

  const setSheet = useCallback(
    (s: SheetState) => {
      setSheetState(s);
      if (s?.kind === "stop") {
        const stop = journey.stops.find((x) => x.id === s.id);
        if (stop) setFocus({ lng: stop.lng, lat: stop.lat, zoom: 7 });
      } else if (s?.kind === "country") {
        const c = journey.countries.find((x) => x.iso2 === s.iso2);
        if (c) setFocus({ lng: c.centroid_lng, lat: c.centroid_lat, zoom: 5 });
      }
    },
    [journey],
  );

  // One visit per page load (private analytics; see lib/track.ts).
  useEffect(() => track("visit"), []);

  // On a fast connection, fetch the full garage model quietly once the map
  // has settled, so the garage opens straight away. On slower or data-saver
  // connections it waits until someone reaches for the IJEOMA button.
  useEffect(() => {
    if (!mapReady) return;
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
    const fast = conn ? conn.effectiveType === "4g" && !conn.saveData : window.innerWidth >= 1024;
    if (!fast) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => warmGarage(), { timeout: 6000 });
    return () => cancel(id);
  }, [mapReady]);

  // Device checks, intro once per session, deep links (?stop=… / ?country=… / ?faq).
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {}
    const params = new URLSearchParams(location.search);
    const stop = params.get("stop");
    const country = params.get("country")?.toUpperCase();
    const faq = params.has("faq");
    const reduced = prefersReducedMotion();
    // A timeout, not rAF: rAF never fires in a background tab.
    const id = setTimeout(() => {
      const intro = !seen && !reduced && !stop && !country && !faq;
      setEnv({ ready: true, low: isLowEnd(), reduced, webgl: hasWebGL(), intro });
      if (!intro) setStarted(true);
      if (stop && journey.stops.some((s) => s.id === stop)) setSheet({ kind: "stop", id: stop });
      else if (country && journey.countries.some((c) => c.iso2 === country)) setSheet({ kind: "country", iso2: country });
      else if (faq) setSheet({ kind: "faq" });
    }, 0);
    return () => clearTimeout(id);
  }, [journey, setSheet]);

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
    setStarted(true);
  }, []);

  const seek = useCallback(
    (p: number) => {
      const pt = globe.current?.setReplay(p) ?? null;
      const prev = lastSeek.current;
      if (pt) {
        // Playing forwards (small steps, not a jump on the slider): crossing
        // into the next leg, or reaching the end, means a checkpoint.
        const driving = p > prev.p && p - prev.p < 0.02;
        let reached: string | null = null;
        if (driving && prev.leg >= 0 && pt.legIndex > prev.leg) reached = path.legs[pt.legIndex - 1].leg.to_stop_id;
        if (driving && p >= 1 && prev.p < 1) reached = path.legs[path.legs.length - 1]?.leg.to_stop_id ?? null;
        if (reached) {
          const stop = journey.stops.find((s) => s.id === reached);
          if (stop && photoFor(journey, stop.country_iso2, stop.id)) setCheckpoint({ stopId: stop.id, key: performance.now() });
        }
        lastSeek.current = { p, leg: pt.legIndex };
      }
      return replayLabel(path, pt);
    },
    [path, journey],
  );
  const clearCheckpoint = useCallback(() => setCheckpoint(null), []);

  if (env.ready && (!env.webgl || mapFailed)) {
    return <Fallback journey={journey} raised={raised} />;
  }

  const showChrome = env.ready && started;
  // When the HUD has faded in (after the intro titles, or straight away).
  const hudDelay = env.reduced ? 0 : env.intro ? 2600 : 200;
  // Sheets and the garage aren't needed for the first paint.
  const extrasReady = mapReady || !!sheet || garageOpen;

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink">
      {env.ready && (
        <Globe
          ref={globe}
          countries={journey.countries}
          stops={journey.stops}
          legs={journey.legs}
          focus={focus}
          started={started}
          low={env.low}
          reduced={env.reduced}
          paused={garageOpen}
          onStop={(id) => setSheet({ kind: "stop", id })}
          onCountry={(iso2) => setSheet({ kind: "country", iso2 })}
          onCar={() => setGarageOpen(true)}
          onPreview={setPreview}
          onReady={() => setMapReady(true)}
          onError={() => setMapFailed(true)}
        />
      )}

      {env.ready && env.intro && !started && <Intro ready={mapReady} onDone={finishIntro} />}

      {showChrome && (
        <div
          data-map-cover="top"
          style={{ animationDelay: `${hudDelay}ms` }}
          className="hud-in pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:inset-y-0 md:right-auto md:w-[440px] md:p-5 xl:w-[480px]"
        >
          <ProgressHud
            stats={journey.stats}
            site={journey.site}
            raised={raised}
            current={current}
            onCountry={(iso2) => setSheet({ kind: "country", iso2 })}
            onFaq={() => setSheet({ kind: "faq" })}
            countDelay={hudDelay + 300}
          />

          {journey.stats.countriesVisited >= journey.stats.totalCountries && (
            <div className="pointer-events-auto border border-orange bg-panel-solid p-3.5 text-sm">
              <p className="font-semibold">All {journey.stats.totalCountries} countries done.</p>
              <button onClick={() => setReplaying(true)} className="chip mt-2">
                Replay the whole drive
              </button>
            </div>
          )}
        </div>
      )}

      {showChrome && replaying && (
        <ReplayBar
          seek={seek}
          reduced={env.reduced}
          onClose={() => {
            setReplaying(false);
            globe.current?.setReplay(null);
          }}
        />
      )}

      {showChrome && replaying && checkpoint && (
        <CheckpointPreview key={checkpoint.key} journey={journey} stopId={checkpoint.stopId} globe={globe} onDone={clearCheckpoint} />
      )}

      {showChrome && (
        <nav data-map-cover="bottom" className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex items-stretch justify-center gap-1.5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:bottom-5 md:left-auto md:right-5 md:p-0">
          <NavButton label="Passport" onClick={() => setSheet({ kind: "passport" })} active={sheet?.kind === "passport"}>
            <svg {...icon} viewBox="0 0 18 18">
              <rect x="3.5" y="1.75" width="11" height="14.5" />
              <circle cx="9" cy="8" r="2.75" />
              <path d="M6.25 12.75h5.5" />
            </svg>
          </NavButton>
          <NavButton label="IJEOMA" onClick={() => setGarageOpen(true)} active={garageOpen} onIntent={warmGarage}>
            <svg {...icon} viewBox="0 0 18 18">
              <path d="M1.75 12V9.25L4 5.75h8.25L16.25 9v3z" />
              <circle cx="5" cy="12.5" r="1.5" />
              <circle cx="13" cy="12.5" r="1.5" />
            </svg>
          </NavButton>
          <DonateButton className="min-w-0 flex-1 md:w-60 md:flex-none" />
          <NavButton
            label="Replay"
            onClick={() => {
              if (replaying) globe.current?.setReplay(null);
              setReplaying((v) => !v);
            }}
            active={replaying}
          >
            <svg {...icon} viewBox="0 0 18 18">
              <path d="M3 9a6 6 0 1 0 1.75-4.25M3 2.75V5.5h2.75" />
              <path d="M7.75 6.25l3.5 2.75-3.5 2.75z" fill="currentColor" stroke="none" />
            </svg>
          </NavButton>
          <NavButton label="Feed" onClick={() => setSheet({ kind: "feed" })} active={sheet?.kind === "feed"}>
            <svg {...icon} viewBox="0 0 18 18">
              <rect x="2.25" y="2.25" width="13.5" height="13.5" rx="3.5" />
              <circle cx="12.75" cy="5.25" r="0.6" fill="currentColor" />
              <circle cx="9" cy="9" r="3" />
            </svg>
          </NavButton>
        </nav>
      )}

      {showChrome && !sheet && !garageOpen && (
        <TrailPreview
          journey={journey}
          pick={preview}
          onOpen={(stopId) => {
            setPreview(null);
            setSheet({ kind: "stop", id: stopId });
          }}
          onClose={() => setPreview(null)}
        />
      )}

      {extrasReady && <Sheets journey={journey} sheet={sheet} setSheet={setSheet} openGarage={() => setGarageOpen(true)} />}
      {extrasReady && <Garage open={garageOpen} onClose={() => setGarageOpen(false)} sponsors={journey.sponsors} low={env.low} />}
    </main>
  );
}

// No WebGL (or the map failed): a plain list of the road so far.
function Fallback({ journey, raised }: { journey: Journey; raised: Raised }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-6">
      <ProgressHud stats={journey.stats} site={journey.site} raised={raised} current={journey.countries.find((c) => c.status === "current") ?? null} onCountry={() => {}} />
      <p className="mt-4 text-sm text-muted">This browser can&apos;t draw the map, so here is the road so far.</p>
      <ol className="mt-4 flex flex-col divide-y divide-line border-y border-line">
        {journey.stops.map((s) => (
          <li key={s.id} className="flex justify-between gap-3 py-3 text-sm">
            <span>
              <Flag iso={s.country_iso2} /> {s.city}
            </span>
            <span className="text-muted">{fmtRange(s.arrived_on, s.left_on)}</span>
          </li>
        ))}
      </ol>
      <DonateButton className="mt-6" />
    </main>
  );
}
