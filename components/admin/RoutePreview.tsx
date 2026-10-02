"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LineString } from "@/lib/routing";
import { loadStyle } from "@/lib/map/style";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

type Pt = { lat: number; lng: number };

export default function RoutePreview({ geometry, from, to }: { geometry: LineString; from: Pt | null; to: Pt }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: maplibregl.Map | null = null;
    let disposed = false;
    loadStyle().then((style) => {
      if (disposed || !el.current) return;
      map = new maplibregl.Map({ container: el.current, style, center: [to.lng, to.lat], zoom: 5, attributionControl: { compact: true } });
      map.on("load", () => {
        if (!map) return;
        map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry } });
        map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round" }, paint: { "line-color": "#ff6a13", "line-width": 3 } });
        const pts = [from, to].filter(Boolean) as Pt[];
        map.addSource("pts", {
          type: "geojson",
          data: { type: "FeatureCollection", features: pts.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) },
        });
        map.addLayer({ id: "pts", type: "circle", source: "pts", paint: { "circle-radius": 5, "circle-color": "#0b0b0c", "circle-stroke-color": "#ff6a13", "circle-stroke-width": 2 } });
        const bounds = new maplibregl.LngLatBounds();
        geometry.coordinates.forEach((c) => bounds.extend(c));
        if (from) map.fitBounds(bounds, { padding: 32, maxZoom: 9, duration: 0 });
      });
    });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [geometry, from, to]);

  // Inline style: maplibre-gl.css sets position: relative on the container.
  return <div ref={el} style={{ position: "absolute", inset: 0 }} />;
}
