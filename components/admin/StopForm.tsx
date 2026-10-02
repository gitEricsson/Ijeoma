"use client";

import dynamic from "next/dynamic";
import { useActionState, useEffect, useRef, useState } from "react";
import { previewRoute, saveStop, type Preview } from "@/app/admin/actions";
import type { Mode } from "@/lib/routing";
import { Field } from "./ActionForm";

const RoutePreview = dynamic(() => import("./RoutePreview"), { ssr: false });

type Defaults = Partial<{
  id: string;
  expedition_id: string;
  city: string;
  country_iso2: string;
  lat: number;
  lng: number;
  arrived_on: string;
  left_on: string | null;
  arrival_mode: Mode;
  caption: string | null;
  is_reconstructed: boolean;
}>;

type Props = {
  expeditions: { id: string; name: string; end_date: string | null }[];
  countries: { iso2: string; name: string }[];
  defaults: Defaults;
};

type Place = { name: string; detail: string; iso2: string; lat: number; lng: number };

const AFRICA_BBOX = "-26,-36,64,38";

async function searchPlaces(q: string, allowed: Set<string>, signal: AbortSignal): Promise<Place[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=en&bbox=${AFRICA_BBOX}`;
  const data = await fetch(url, { signal }).then((r) => r.json());
  const places: Place[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    const iso2 = String(p.countrycode ?? "").toUpperCase();
    if (!allowed.has(iso2) || !p.name) continue;
    const [lng, lat] = f.geometry.coordinates;
    places.push({ name: p.name, detail: [p.osm_value, p.state, p.country].filter(Boolean).join(" · "), iso2, lat, lng });
  }
  return places;
}

export default function StopForm({ expeditions, countries, defaults }: Props) {
  const [state, action, pending] = useActionState(saveStop, null);
  const allowed = useRef(new Set(countries.map((c) => c.iso2)));

  const [city, setCity] = useState(defaults.city ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(defaults.lat != null ? { lat: defaults.lat, lng: defaults.lng! } : null);
  const [country, setCountry] = useState(defaults.country_iso2 ?? "");
  const [expedition, setExpedition] = useState(defaults.expedition_id ?? expeditions[0]?.id ?? "");
  const [arrived, setArrived] = useState(defaults.arrived_on ?? new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<Mode>(defaults.arrival_mode ?? "drive");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(query.trim(), allowed.current, ctrl.signal)
        .then(setResults)
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function choose(p: Place) {
    setCity(p.name);
    setCountry(p.iso2);
    setPlace({ lat: p.lat, lng: p.lng });
    setQuery("");
    setResults([]);
    setPreview(null);
  }

  async function runPreview() {
    if (!place) return;
    setPreviewing(true);
    setPreview(await previewRoute({ stopId: defaults.id ?? null, expeditionId: expedition, lat: place.lat, lng: place.lng, arrivedOn: arrived, mode }));
    setPreviewing(false);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={defaults.id ?? ""} />
      <input type="hidden" name="lat" value={place?.lat ?? ""} />
      <input type="hidden" name="lng" value={place?.lng ?? ""} />

      <Field label="Find the city" hint="Search OpenStreetMap, then pick a result. Only the city centre is stored.">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            placeholder={city ? `${city} (search to change)` : "e.g. Kumasi"}
            className="field"
            autoComplete="off"
          />
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 max-h-72 overflow-y-auto border border-line bg-panel-solid">
              {results.map((r, i) => (
                <li key={i}>
                  <button type="button" onClick={() => choose(r)} className="w-full px-3 py-2.5 text-left hover:bg-orange-soft">
                    <div>{r.name}</div>
                    <div className="label">{r.detail}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="City name">
          <input name="city" required value={city} onChange={(e) => setCity(e.target.value)} className="field" />
        </Field>
        <Field label="Country">
          <select name="country_iso2" required value={country} onChange={(e) => setCountry(e.target.value)} className="field">
            <option value="">Choose</option>
            {countries.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {place && (
        <div className="label -mt-2">
          {place.lat.toFixed(3)}, {place.lng.toFixed(3)}
        </div>
      )}

      <Field label="Expedition">
        <select name="expedition_id" value={expedition} onChange={(e) => setExpedition(e.target.value)} className="field">
          {expeditions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.end_date ? " (closed)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Arrived">
          <input name="arrived_on" type="date" required value={arrived} onChange={(e) => setArrived(e.target.value)} className="field" />
        </Field>
        <Field label="Left">
          <input name="left_on" type="date" defaultValue={defaults.left_on ?? ""} className="field" />
        </Field>
      </div>

      <Field label="How he got here">
        <div className="grid grid-cols-4 gap-2">
          {(["drive", "ferry", "flight", "ship"] as const).map((m) => (
            <label key={m} className={`btn cursor-pointer text-center ${mode === m ? "border-orange text-orange" : ""}`}>
              <input type="radio" name="arrival_mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              {m}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Caption">
        <textarea name="caption" rows={3} maxLength={600} defaultValue={defaults.caption ?? ""} className="field" />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_reconstructed" defaultChecked={defaults.is_reconstructed ?? false} className="accent-orange" />
        Reconstructed (entered after the fact, from posts or memory)
      </label>

      <div className="border border-line p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="label">Route preview</span>
          <button type="button" onClick={runPreview} disabled={!place || previewing} className="btn disabled:opacity-40">
            {previewing ? "Routing…" : "Preview route"}
          </button>
        </div>
        {preview && "error" in preview && <p className="mt-2 text-sm text-orange">{preview.error}</p>}
        {preview && !("error" in preview) && place && (
          <>
            <p className="mt-2 text-sm">
              {preview.from ? (
                <>
                  From {preview.from.city}: {Math.round(preview.distanceKm).toLocaleString("en-US")} km
                  {preview.isFallback && <span className="text-orange"> (routing failed, straight line)</span>}
                </>
              ) : (
                "First stop of this expedition: no road to draw yet."
              )}
            </p>
            <div className="relative mt-3 h-64 w-full">
              <RoutePreview geometry={preview.geometry} from={preview.from} to={place} />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !place} className="btn-primary">
          {pending ? "Saving and routing…" : "Save stop"}
        </button>
        {!place && <span className="text-sm text-muted">Pick a city from the search first.</span>}
        {state?.ok && <span className="text-sm text-muted">{state.ok}</span>}
        {state?.error && <span className="text-sm text-orange">{state.error}</span>}
      </div>
    </form>
  );
}
