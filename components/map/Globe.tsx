"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
// With the map chunk, so it doesn't block the first paint (or the admin).
import "maplibre-gl/dist/maplibre-gl.css";
import type { Country, Leg, Stop } from "@/lib/types";
import type { LngLat } from "@/lib/routing";
import { loadStyle } from "@/lib/map/style";
import { buildPath, pointAt, trailAt, type JourneyPath, type PathPoint } from "@/lib/map/path";
import type { CarMarker } from "@/lib/three/carMarker";
import { fmtDate } from "@/lib/format";
import { countryAt } from "@/lib/photos";
import { loadCancerFacts, randomFact } from "@/lib/cancerFacts";
import { wavingFlagHtml } from "@/components/WavingFlag";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ORANGE = "#ff6a13";
// Desktop HUD column width (md:w-[440px] xl:w-[480px] in MapApp); the camera keeps the trail clear of it.
const hudRail = () => (window.innerWidth >= 1280 ? 480 : 440);
const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

/** A spot on the trail being previewed (hover on desktop, tap on phones). */
export type TrailPick = { x: number; y: number; iso2: string | null; stopId: string; pinned: boolean; onRoad: boolean };

export type GlobeHandle = {
  /** Replay progress 0..1, or null to return to "today". */
  setReplay: (p: number | null) => PathPoint | null;
  /** Where a map position is on screen right now, or null before the map exists. */
  screenPoint: (at: LngLat) => { x: number; y: number } | null;
};

type Props = {
  ref?: Ref<GlobeHandle>;
  countries: Country[];
  stops: Stop[];
  legs: Leg[];
  focus: { lng: number; lat: number; zoom: number } | null;
  /** Fly in from space and draw the trail. Set once the intro (if any) is done. */
  started: boolean;
  low: boolean;
  reduced: boolean;
  /** Something covers the map (the garage): stop the pulse so the map can idle. */
  paused: boolean;
  onStop: (id: string) => void;
  onCountry: (iso2: string) => void;
  onCar: () => void;
  onPreview: (pick: TrailPick | null) => void;
  onReady: () => void;
  onError: () => void;
};

function focusCenter(stops: Stop[], countries: Country[]): LngLat {
  if (stops.length) {
    const lngs = stops.map((s) => s.lng);
    const lats = stops.map((s) => s.lat);
    return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  }
  const home = countries.find((c) => c.is_home);
  return home ? [home.centroid_lng, home.centroid_lat] : [17, 3];
}

// Douglas-Peucker on one ring (degrees). The ripple is a thin line moving
// outward, so a coarse outline looks the same and is far cheaper to draw.
function simplify(ring: number[][], tol: number): number[][] {
  if (ring.length < 5) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let max = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      // A closed ring starts and ends on the same point: measure from that point.
      const d = len < 1e-12 ? Math.hypot(ring[i][0] - ax, ring[i][1] - ay) : Math.abs(dy * ring[i][0] - dx * ring[i][1] + bx * ay - by * ax) / len;
      if (d > max) [max, at] = [d, i];
    }
    if (max > tol && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

// The ripple, as one static source: RIPPLE_FRAMES copies of the country
// outline, each scaled a little further out. Each frame only switches which
// copies are visible (feature state), so the map never re-tiles anything.
const RIPPLE_FRAMES = 96;
const RIPPLE_MS = 2800;
function rippleFrames(shape: GeoJSON.Feature[], [cx, cy]: [number, number]): GeoJSON.FeatureCollection {
  const rings: number[][][] = [];
  for (const f of shape) {
    const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const outers = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((poly) => poly[0]);
    for (const r of outers) rings.push(simplify(r, 0.02));
  }
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < RIPPLE_FRAMES; i++) {
    const k = 1 + (i / RIPPLE_FRAMES) * 0.55;
    const coordinates = rings.map((r) => r.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]));
    features.push({ type: "Feature", id: i, properties: {}, geometry: { type: "MultiLineString", coordinates } });
  }
  return { type: "FeatureCollection", features };
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function Globe(props: Props) {
  const { ref, countries, stops, legs, focus, started, low, reduced } = props;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const handlers = useRef(props);
  const state = useRef({
    loaded: false,
    begun: false,
    drawn: reduced ? 1 : 0,
    path: null as JourneyPath | null,
    car: null as CarMarker | null,
    replay: null as number | null,
    lastReplayAt: 0,
  });

  const startedRef = useRef(started);
  const pausedRef = useRef(props.paused);
  const resume = useRef<() => void>(() => {});
  useEffect(() => {
    handlers.current = props;
    startedRef.current = started;
    const wasPaused = pausedRef.current;
    pausedRef.current = props.paused;
    if (wasPaused && !props.paused) resume.current();
  });


  // Parked at the latest stop, facing the way it arrived.
  const placeCarAtEnd = () => {
    const s = state.current;
    const end = s.path ? pointAt(s.path, 1) : null;
    if (end) {
      s.car?.setPosition(end.at, end.ahead);
    } else if (stops.length) {
      const st = stops[stops.length - 1];
      s.car?.setPosition([st.lng, st.lat], null);
    }
  };

  // The "today" camera. Keeps the trail clear of the HUD: on top on phones, on the left on desktop.
  const overview = () => {
    const narrow = window.innerWidth < 768;
    const padding = narrow ? { top: 300, bottom: 90, left: 0, right: 0 } : { top: 0, bottom: 0, left: hudRail(), right: 0 };
    return { center: focusCenter(stops, countries), zoom: narrow ? 4 : 4.6, padding, pitch: low ? 0 : 35 };
  };

  const begin = () => {
    const s = state.current;
    const map = mapRef.current;
    if (!map || s.begun) return;
    s.begun = true;
    const target = overview();
    if (reduced) {
      map.jumpTo(target);
      return;
    }
    map.stop();
    map.flyTo({ ...target, duration: 5200, curve: 1.7, essential: true });
    const start = performance.now();
    const DRAW_MS = 3600;
    const draw = (now: number) => {
      if (s.replay !== null) return; // replay took over
      const t = Math.min(1, Math.max(0, (now - start - 2400) / DRAW_MS));
      const eased = 1 - Math.pow(1 - t, 3);
      s.drawn = eased;
      if (s.path) {
        (map.getSource("trail") as GeoJSONSource).setData(trailAt(s.path, eased));
        const pt = pointAt(s.path, eased);
        if (pt && t > 0) {
          s.car?.setPosition(pt.at, pt.ahead);
        }
      }
      map.setPaintProperty("stops", "circle-opacity", eased);
      map.setPaintProperty("stops", "circle-stroke-opacity", eased);
      if (t < 1) requestAnimationFrame(draw);
      else placeCarAtEnd();
    };
    requestAnimationFrame(draw);
  };

  // Fly in once the map has loaded and the page says go (after the intro).
  useEffect(() => {
    if (started && state.current.loaded) begin();
    // begin only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useImperativeHandle(ref, () => ({
    screenPoint(at) {
      const map = mapRef.current;
      if (!map) return null;
      const { x, y } = map.project(at);
      return { x, y };
    },
    setReplay(p) {
      const s = state.current;
      const map = mapRef.current;
      if (!map || !s.path || !s.loaded) return null;
      const starting = s.replay === null && p !== null;
      s.replay = p;
      const src = map.getSource("trail") as GeoJSONSource | undefined;
      if (p === null) {
        src?.setData(trailAt(s.path, 1));
        placeCarAtEnd();
        map.easeTo({ ...overview(), duration: reduced ? 0 : 1600, essential: true });
        return null;
      }
      src?.setData(trailAt(s.path, p));
      const pt = pointAt(s.path, p);
      if (pt) {
        s.car?.setPosition(pt.at, pt.ahead);
        if (starting) {
          // Drop down to road level, tilted, behind the car.
          s.begun = true;
          map.stop();
          const narrow = window.innerWidth < 768;
          const padding = narrow ? { top: 120, bottom: 200, left: 0, right: 0 } : { top: 0, bottom: 0, left: hudRail(), right: 0 };
          map.easeTo({ center: pt.at, zoom: narrow ? 6 : 6.5, pitch: low ? 0 : 50, padding, duration: reduced ? 0 : 1400, essential: true });
        } else if (!map.isMoving()) {
          // Follow the car with time-based damping, so it's smooth at any frame rate.
          const now = performance.now();
          const dt = s.lastReplayAt ? Math.min(0.1, (now - s.lastReplayAt) / 1000) : 0.016;
          const k = reduced ? 1 : 1 - Math.exp(-dt / 0.35);
          const c = map.getCenter();
          map.jumpTo({ center: [c.lng + (pt.at[0] - c.lng) * k, c.lat + (pt.at[1] - c.lat) * k] });
        }
        s.lastReplayAt = performance.now();
      }
      map.triggerRepaint();
      return pt;
    },
  }));

  useEffect(() => {
    if (!el.current) return;
    let disposed = false;
    let raf = 0;
    const s = state.current;
    const narrow = window.innerWidth < 768;
    const sense = { on: [] as number[], centre: null as [number, number] | null };

    (async () => {
      let style: Awaited<ReturnType<typeof loadStyle>>;
      let africa: GeoJSON.FeatureCollection;
      try {
        [style, africa] = await Promise.all([loadStyle(), fetch("/data/africa.geojson").then((r) => r.json())]);
      } catch {
        handlers.current.onError();
        return;
      }
      if (disposed || !el.current) return;

      const statusOf = new Map(countries.map((c) => [c.iso2, c.status]));
      for (const f of africa.features) f.properties!.status = statusOf.get(f.properties!.iso) ?? "none";

      let map: MLMap;
      try {
        map = new maplibregl.Map({
          container: el.current,
          style,
          center: reduced ? [12, 4] : [-35, 8],
          zoom: reduced ? (narrow ? 2.1 : 2.6) : narrow ? 0.9 : 1.4,
          attributionControl: { compact: true },
          maxPitch: 60,
          pixelRatio: low ? 1 : Math.min(window.devicePixelRatio, 2),
        });
      } catch {
        handlers.current.onError();
        return;
      }
      mapRef.current = map;

      map.on("style.load", () => map.setProjection({ type: "globe" }));

      // Slow spin from space while the intro titles play.
      const spin = () => {
        if (disposed || s.begun || reduced || !s.loaded) return;
        const c = map.getCenter();
        map.easeTo({ center: [c.lng + 6, c.lat], duration: 1000, easing: (t) => t });
      };
      map.on("moveend", spin);

      map.on("load", () => {
        const path = buildPath(legs, stops);
        s.path = path;

        if (!low) {
          map.addSource("dem", { type: "raster-dem", tiles: [DEM_TILES], encoding: "terrarium", tileSize: 256, maxzoom: 12, attribution: "Terrain: Mapzen / AWS Open Data" });
          map.addLayer({
            id: "hillshade",
            type: "hillshade",
            source: "dem",
            paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#000000", "hillshade-highlight-color": "#2a2a2a", "hillshade-accent-color": "#111111" },
          });
        }

        map.addSource("countries", { type: "geojson", data: africa });
        map.addLayer({
          id: "country-fill",
          type: "fill",
          source: "countries",
          paint: {
            "fill-color": ["match", ["get", "status"], "upcoming", "#9a9a9a", ORANGE],
            "fill-opacity": ["match", ["get", "status"], "current", 0.2, "visited", 0.11, "upcoming", 0.035, 0.0],
          },
        });
        map.addLayer({
          id: "country-line",
          type: "line",
          source: "countries",
          paint: { "line-color": ["match", ["get", "status"], "visited", "rgba(255,106,19,0.45)", "#2c2c2c"], "line-width": 0.6 },
        });
        map.addLayer({
          id: "current-glow",
          type: "line",
          source: "countries",
          filter: ["==", ["get", "status"], "current"],
          paint: { "line-color": ORANGE, "line-width": 8, "line-blur": 7, "line-opacity": 0.6 },
        });
        map.addLayer({ id: "current-edge", type: "line", source: "countries", filter: ["==", ["get", "status"], "current"], paint: { "line-color": ORANGE, "line-width": 1.4 } });

        // "Spydey sense": the current country's own outline ripples outward.
        const current = countries.find((c) => c.status === "current");
        const shape = current ? africa.features.filter((f) => f.properties!.iso === current.iso2) : [];
        sense.centre = current && shape.length ? [current.centroid_lng, current.centroid_lat] : null;
        map.addSource("sense", { type: "geojson", data: sense.centre ? rippleFrames(shape, sense.centre) : { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "sense",
          type: "line",
          source: "sense",
          paint: { "line-color": ORANGE, "line-width": 1.4, "line-opacity": ["coalesce", ["feature-state", "o"], 0] },
        });

        map.addSource("trail", { type: "geojson", data: trailAt(path, s.drawn) });
        map.addLayer({ id: "trail-glow", type: "line", source: "trail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ORANGE, "line-width": 12, "line-blur": 9, "line-opacity": 0.38 } });
        map.addLayer({
          id: "trail",
          type: "line",
          source: "trail",
          filter: ["==", ["get", "mode"], "drive"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ORANGE, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1.6, 8, 3.5] },
        });
        map.addLayer({ id: "trail-arc", type: "line", source: "trail", filter: ["!=", ["get", "mode"], "drive"], paint: { "line-color": ORANGE, "line-width": 1.5, "line-dasharray": [2, 2] } });
        // Wide invisible line so the trail is easy to tap on a phone.
        map.addLayer({ id: "trail-hit", type: "line", source: "trail", paint: { "line-color": "#000", "line-width": 22, "line-opacity": 0 } });

        map.addSource("stops", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: stops.map((st) => ({ type: "Feature", properties: { id: st.id, city: st.city, date: fmtDate(st.arrived_on) }, geometry: { type: "Point", coordinates: [st.lng, st.lat] } })),
          },
        });
        map.addLayer({
          id: "stops",
          type: "circle",
          source: "stops",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2.5, 8, 6],
            "circle-color": "#0b0b0c",
            "circle-stroke-color": ORANGE,
            "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 2, 1.2, 8, 2],
            "circle-opacity": s.drawn,
            "circle-stroke-opacity": s.drawn,
          },
        });
        map.addLayer({
          id: "stop-labels",
          type: "symbol",
          source: "stops",
          minzoom: 5,
          layout: { "text-field": ["get", "city"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top" },
          paint: { "text-color": "#d8d8d4", "text-halo-color": "#050506", "text-halo-width": 1.2 },
        });

        // IJEOMA herself. three.js loads after the map so the map draws first;
        // she's too small to see during the spin from space anyway.
        import("@/lib/three/carMarker")
          .then(({ CarMarker }) => {
            if (disposed) return;
            try {
              s.car = new CarMarker(el.current!, { low, reduced, onClick: () => handlers.current.onCar() });
            } catch {
              return; // no second WebGL context available: the map still works
            }
            const pt = s.path && s.replay === null && s.drawn < 1 ? pointAt(s.path, s.drawn) : null;
            if (pt) s.car.setPosition(pt.at, pt.ahead);
            else if (s.replay === null) placeCarAtEnd();
            map.triggerRepaint();
          })
          .catch(() => {});
        map.on("render", () => s.car?.render(map));

        // The glow breathes and two ripples run outward. Only paint values and
        // feature states change; nothing is re-uploaded.
        const setRipple = (on: number[], o: number[]) => {
          for (const id of sense.on) if (!on.includes(id)) map.setFeatureState({ source: "sense", id }, { o: 0 });
          on.forEach((id, i) => map.setFeatureState({ source: "sense", id }, { o: o[i] }));
          sense.on = on;
        };
        const tick = (now: number) => {
          if (pausedRef.current) {
            raf = 0; // resume() restarts it
            return;
          }
          map.setPaintProperty("current-glow", "line-opacity", 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(now / 550)));
          if (sense.centre && map.getBounds().contains(sense.centre)) {
            const t = (now / RIPPLE_MS) % 1;
            const frames = [t, (t + 0.5) % 1];
            setRipple(
              frames.map((x) => Math.floor(x * RIPPLE_FRAMES)),
              frames.map((x) => 0.85 * (1 - x)),
            );
          }
          raf = requestAnimationFrame(tick);
        };
        if (reduced) {
          if (sense.centre) setRipple([Math.round(RIPPLE_FRAMES * 0.45)], [0.5]);
        } else {
          resume.current = () => {
            if (!raf && !disposed) raf = requestAnimationFrame(tick);
          };
          resume.current();
        }

        s.loaded = true;
        handlers.current.onReady();
        if (reduced || startedRef.current) begin();
        else spin();
      });

      const canHover = window.matchMedia("(hover: hover)").matches;
      // What's under the pointer on the trail: a stop, or a stretch of road
      // (named by its destination stop and the country it passes through).
      const trailPick = (e: maplibregl.MapMouseEvent, pad: number, pinned: boolean): TrailPick | null => {
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - pad, e.point.y - pad],
          [e.point.x + pad, e.point.y + pad],
        ];
        const stop = map.queryRenderedFeatures(box, { layers: ["stops"] })[0];
        if (stop) {
          const st = stops.find((x) => x.id === stop.properties.id);
          return { x: e.point.x, y: e.point.y, iso2: st?.country_iso2 ?? null, stopId: stop.properties.id, pinned, onRoad: false };
        }
        const leg = map.queryRenderedFeatures(box, { layers: ["trail-hit"] })[0];
        if (leg) {
          const iso2 = countryAt(africa.features, [e.lngLat.lng, e.lngLat.lat]) ?? stops.find((x) => x.id === leg.properties.to)?.country_iso2 ?? null;
          return { x: e.point.x, y: e.point.y, iso2, stopId: leg.properties.to, pinned, onRoad: true };
        }
        return null;
      };

      map.on("click", (e) => {
        const h = handlers.current;
        if (s.car?.hitTest(map, e.point.x, e.point.y)) return h.onCar();
        const pick = trailPick(e, 12, true);
        if (pick) {
          // Phones can't hover: the first tap pins a preview card, which then opens the stop.
          if (canHover) return h.onStop(pick.stopId);
          return h.onPreview(pick);
        }
        h.onPreview(null);
        const country = map.queryRenderedFeatures(e.point, { layers: ["country-fill"] })[0];
        if (country) h.onCountry(country.properties.iso);
      });
      map.on("movestart", () => {
        if (!canHover) handlers.current.onPreview(null);
      });

      // Desktop hover: a picture card along the trail and at stops, plain
      // tooltips for the car and countries. Phones get the card on tap.
      if (canHover) {
        const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "spydey-tip", offset: 12, maxWidth: "232px" });
        // A new fact each time the pointer enters a country (not on every move).
        const hovered = { iso: null as string | null, fact: undefined as string | undefined };
        const lastFact = new Map<string, string>(); // per country, so re-entering shows a different one
        // Not on "idle": the pulse keeps the map animating, so it never idles.
        map.on("mousemove", (e) => {
          if (!s.loaded) return;
          void loadCancerFacts(); // fetched once; later calls reuse it
          const h = handlers.current;
          const overCar = s.car?.hitTest(map, e.point.x, e.point.y);
          const pick = overCar ? null : trailPick(e, 8, false);
          h.onPreview(pick);
          const f = overCar || pick ? null : map.queryRenderedFeatures(e.point, { layers: ["country-fill"] })[0];
          map.getCanvas().style.cursor = overCar || pick || f ? "pointer" : "";
          if (!f || overCar) hovered.iso = null;
          if (overCar) tip.setLngLat(e.lngLat).setHTML("<b>IJEOMA</b><br/>Open the garage").addTo(map);
          else if (!f) tip.remove();
          else {
            const iso: string = f.properties.iso;
            // Re-pick when the pointer enters another country, or once the facts arrive.
            if (iso !== hovered.iso || (!hovered.fact && randomFact(iso))) {
              const c = countries.find((x) => x.iso2 === iso);
              const label = c ? (c.status === "current" ? "IJEOMA is here" : c.status === "visited" ? "Visited" : "Not reached yet") : "";
              const fact = randomFact(iso, c?.cancer_fact, lastFact.get(iso));
              hovered.iso = iso;
              hovered.fact = fact?.text;
              if (fact) lastFact.set(iso, fact.text);
              tip.setHTML(
                `<span class="tip-name">${wavingFlagHtml(iso)}<b>${escapeHtml(f.properties.name)}</b></span>${label ? `<span class="tip-status">${label}</span>` : ""}` +
                  (fact ? `<p class="tip-fact">${escapeHtml(fact.text)}</p>${fact.source ? `<span class="tip-src">${escapeHtml(fact.source)}</span>` : ""}` : ""),
              );
            }
            tip.setLngLat(e.lngLat).addTo(map);
          }
        });
        map.on("mouseout", () => {
          hovered.iso = null;
          tip.remove();
          handlers.current.onPreview(null);
        });
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      s.car?.dispose();
      s.car = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is built once per data snapshot; the page is static between rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    // Leave room for the bottom sheet on phones, the HUD rail and panel on desktop.
    const padding = window.innerWidth < 768 ? { top: 40, bottom: window.innerHeight * 0.45, left: 0, right: 0 } : { top: 0, bottom: 0, left: hudRail(), right: 420 };
    const opts = { center: [focus.lng, focus.lat] as LngLat, zoom: focus.zoom, padding };
    if (reduced) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 1800, essential: true });
  }, [focus, reduced]);

  // Inline style: maplibre-gl.css sets position: relative on the container, which beats Tailwind utilities.
  return <div ref={el} style={{ position: "absolute", inset: 0 }} aria-label="Map of IJEOMA's journey across Africa" role="img" />;
}
