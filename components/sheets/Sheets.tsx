"use client";

import { useEffect, useState } from "react";
import type { Journey, Post, Stop } from "@/lib/types";
import { fmtDate, fmtRange, MODE_LABEL } from "@/lib/format";
import { kmInCountry } from "@/lib/stats";
import PostCard from "@/components/ig/PostCard";
import BottomSheet from "./BottomSheet";
import ShareButton from "./ShareButton";
import Passport from "./Passport";
import { loadCancerFacts, randomFact, type CancerFact } from "@/lib/cancerFacts";

export type SheetState = { kind: "stop"; id: string } | { kind: "country"; iso2: string } | { kind: "passport" } | { kind: "feed" } | null;

type Props = {
  journey: Journey;
  sheet: SheetState;
  setSheet: (s: SheetState) => void;
};

function Posts({ posts }: { posts: Post[] }) {
  if (!posts.length) return <p className="py-4 text-sm text-muted">No posts from here yet.</p>;
  return (
    <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
      {posts.map((p) => (
        <div key={p.id} className="w-[86%] max-w-[360px] shrink-0 snap-center">
          <PostCard post={p} />
        </div>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default function Sheets({ journey, sheet, setSheet }: Props) {
  const close = () => setSheet(null);
  const countryBy = new Map(journey.countries.map((c) => [c.iso2, c]));

  if (sheet?.kind === "stop") {
    const i = journey.stops.findIndex((s) => s.id === sheet.id);
    const stop = journey.stops[i];
    if (!stop) return null;
    const country = countryBy.get(stop.country_iso2);
    const legIn = journey.legs.find((l) => l.to_stop_id === stop.id);
    const prev: Stop | undefined = journey.stops[i - 1];
    const next: Stop | undefined = journey.stops[i + 1];
    const posts = journey.posts.filter((p) => p.stop_id === stop.id);
    return (
      <BottomSheet open onClose={close} title={stop.city} flagIso={stop.country_iso2} eyebrow={`${country?.name ?? stop.country_iso2}, stop ${i + 1} of ${journey.stops.length}`}>
        {stop.caption && <p className="mb-3 leading-relaxed">{stop.caption}</p>}
        <Row label="Dates">{fmtRange(stop.arrived_on, stop.left_on)}</Row>
        {legIn && prev && (
          <Row label={`${MODE_LABEL[legIn.mode]} from ${prev.city}`}>
            {Math.round(legIn.distance_km).toLocaleString("en-US")} km{stop.is_reconstructed ? ", approximate" : ""}
          </Row>
        )}
        <div className="mt-4">
          <ShareButton kind="stop" id={stop.id} title={`${stop.city}, ${country?.name ?? ""}`} />
        </div>
        <h3 className="mb-3 mt-6 font-semibold">On Instagram</h3>
        <Posts posts={posts} />
        <div className="mt-6 grid grid-cols-3 gap-2 text-sm">
          <button disabled={!prev} onClick={() => prev && setSheet({ kind: "stop", id: prev.id })} className="chip justify-start disabled:opacity-30">
            {prev ? `Back to ${prev.city}` : "First stop"}
          </button>
          <button onClick={() => setSheet({ kind: "country", iso2: stop.country_iso2 })} className="chip justify-center">
            {country?.name ?? "Country"}
          </button>
          <button disabled={!next} onClick={() => next && setSheet({ kind: "stop", id: next.id })} className="chip justify-end disabled:opacity-30">
            {next ? `On to ${next.city}` : "Latest stop"}
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (sheet?.kind === "country") {
    const c = countryBy.get(sheet.iso2);
    if (!c) return null;
    const stops = journey.stops.filter((s) => s.country_iso2 === c.iso2);
    const stopIds = new Set(stops.map((s) => s.id));
    const posts = journey.posts.filter((p) => p.country_iso2 === c.iso2 || (p.stop_id && stopIds.has(p.stop_id)));
    const status = c.is_home ? "Home base" : c.status === "current" ? "IJEOMA is here" : c.status === "visited" ? "Visited" : "Not reached yet";
    return (
      <BottomSheet open onClose={close} title={c.name} flagIso={c.iso2} eyebrow={status}>
        <Row label="First entered">{fmtDate(c.first_entered_on)}</Row>
        <Row label="Road driven here">{kmInCountry(c.iso2, journey.stops, journey.legs).toLocaleString("en-US")} km</Row>
        <Row label="Stops">{stops.length}</Row>
        {stops.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stops.map((s) => (
              <button key={s.id} onClick={() => setSheet({ kind: "stop", id: s.id })} className="chip">
                {s.city} <span className="text-muted">{fmtDate(s.arrived_on)}</span>
              </button>
            ))}
          </div>
        )}
        {c.status !== "upcoming" && (
          <div className="mt-4">
            <ShareButton kind="country" id={c.iso2} title={c.name} />
          </div>
        )}
        <CancerFactBox key={c.iso2} iso2={c.iso2} name={c.name} adminFact={c.cancer_fact} />
        {c.ig_highlight_url && (
          <a href={c.ig_highlight_url} target="_blank" rel="noopener noreferrer" className="chip mt-4">
            {c.name} story highlight on Instagram
          </a>
        )}
        {posts.length > 0 && (
          <>
            <h3 className="mb-3 mt-6 font-semibold">On Instagram</h3>
            <Posts posts={posts} />
          </>
        )}
      </BottomSheet>
    );
  }

  if (sheet?.kind === "passport") {
    const { countriesVisited, totalCountries } = journey.stats;
    return (
      <BottomSheet open onClose={close} title="Passport" eyebrow={`${countriesVisited} of ${totalCountries} stamped`}>
        <Passport countries={journey.countries} countHome={journey.site.count_home} onCountry={(iso2) => setSheet({ kind: "country", iso2 })} />
      </BottomSheet>
    );
  }

  if (sheet?.kind === "feed") {
    // Every post, newest first (stop sheets show each stop's own).
    const posts = [...journey.posts].sort((a, b) => (b.posted_on ?? "").localeCompare(a.posted_on ?? "") || b.sort - a.sort);
    return (
      <BottomSheet open onClose={close} title="Feed" eyebrow="Latest from Instagram">
        <div className="flex flex-col gap-6">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </BottomSheet>
    );
  }

  return null;
}

// A random cancer fact for the country (GLOBOCAN, or the admin's own), with
// another on tap. Phones can't hover the map, so this is where they see them.
function CancerFactBox({ iso2, name, adminFact }: { iso2: string; name: string; adminFact: string | null }) {
  const [fact, setFact] = useState<CancerFact | null>(adminFact ? { text: adminFact, source: "" } : null);
  useEffect(() => {
    let live = true;
    loadCancerFacts().then(() => live && setFact((f) => randomFact(iso2, adminFact, f?.text) ?? f));
    return () => {
      live = false;
    };
  }, [iso2, adminFact]);
  if (!fact) return null;
  return (
    <div className="mt-6 bg-orange-soft p-3.5">
      <h3 className="text-sm font-semibold text-orange">Cancer in {name}</h3>
      <p className="mt-1 text-sm leading-relaxed">{fact.text}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{fact.source}</span>
        <button onClick={() => setFact((f) => randomFact(iso2, adminFact, f?.text) ?? f)} className="shrink-0 underline-offset-4 hover:text-text hover:underline">
          Another fact
        </button>
      </div>
    </div>
  );
}
