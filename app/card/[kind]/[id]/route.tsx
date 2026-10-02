import { ImageResponse } from "next/og";
import { getJourney, getRaised } from "@/lib/data";
import { fmtDate, fmtRange, fmtUsd } from "@/lib/format";
import { kmInCountry } from "@/lib/stats";
import type { Journey } from "@/lib/types";

// Instagram Story cards (1080×1920) for a stop or a country:
//   /card/stop/<id>    /card/country/<ISO2>

const W = 1080;
const H = 1920;
const ORANGE = "#ff6a13";

async function loadFonts() {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Anybody:ital,wdth,wght@1,125,800&family=Schibsted+Grotesk:wght@500", { cache: "force-cache" }).then((r) => r.text());
    const url = (family: string) => css.match(new RegExp(`font-family: '${family}'[^}]*?src: url\\((https://[^)]+\\.ttf)\\)`))?.[1];
    const [condensed, body] = await Promise.all(
      [url("Anybody"), url("Schibsted Grotesk")].map((u) => (u ? fetch(u, { cache: "force-cache" }).then((r) => r.arrayBuffer()) : null)),
    );
    const fonts = [];
    if (condensed) fonts.push({ name: "Condensed", data: condensed, weight: 700 as const, style: "normal" as const });
    if (body) fonts.push({ name: "Body", data: body, weight: 500 as const, style: "normal" as const });
    return fonts;
  } catch {
    return [];
  }
}
const fontsPromise = loadFonts();

// The whole trail as an SVG path, fitted into a box, with one stop picked out.
function trailSvg(j: Journey, highlight: { lng: number; lat: number }[], box: { w: number; h: number }) {
  const pts = j.legs.flatMap((l) => l.geometry.coordinates).concat(j.stops.map((s) => [s.lng, s.lat] as [number, number]));
  if (!pts.length) return null;
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const span = Math.max(maxX - minX, (maxY - minY) * (box.w / box.h), 1);
  const pad = 60;
  const scale = (box.w - pad * 2) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = (lng: number) => box.w / 2 + (lng - cx) * scale;
  const y = (lat: number) => box.h / 2 - (lat - cy) * scale;
  const d = j.legs.map((l) => l.geometry.coordinates.map((c, i) => `${i ? "L" : "M"}${x(c[0]).toFixed(1)} ${y(c[1]).toFixed(1)}`).join(" ")).join(" ");
  return (
    <svg width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`}>
      <path d={d} stroke={ORANGE} strokeOpacity={0.35} strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={ORANGE} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {j.stops.map((s) => (
        <circle key={s.id} cx={x(s.lng)} cy={y(s.lat)} r={9} fill="#0b0b0c" stroke={ORANGE} strokeWidth={4} />
      ))}
      {highlight.map((h, i) => (
        <circle key={i} cx={x(h.lng)} cy={y(h.lat)} r={24} fill="none" stroke="#ffffff" strokeWidth={4} />
      ))}
    </svg>
  );
}

export async function GET(_: Request, ctx: RouteContext<"/card/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  const j = await getJourney();
  const raised = await getRaised(j.site);
  const fonts = await fontsPromise;

  let eyebrow = "";
  let title = "";
  let sub = "";
  let rows: [string, string][] = [];
  let highlight: { lng: number; lat: number }[] = [];

  if (kind === "stop") {
    const i = j.stops.findIndex((s) => s.id === id);
    const stop = j.stops[i];
    if (!stop) return new Response("Not found", { status: 404 });
    const country = j.countries.find((c) => c.iso2 === stop.country_iso2);
    const legIn = j.legs.find((l) => l.to_stop_id === stop.id);
    eyebrow = `Stop ${i + 1} of ${j.stops.length}`;
    title = stop.city;
    sub = country?.name ?? stop.country_iso2;
    rows = [
      ["Dates", fmtRange(stop.arrived_on, stop.left_on)],
      ...(legIn ? [["Road in", `${Math.round(legIn.distance_km).toLocaleString("en-US")} km`] as [string, string]] : []),
      ["Countries", `${j.stats.countriesVisited}/${j.stats.totalCountries}`],
    ];
    highlight = [{ lng: stop.lng, lat: stop.lat }];
  } else if (kind === "country") {
    const c = j.countries.find((x) => x.iso2 === id.toUpperCase());
    if (!c) return new Response("Not found", { status: 404 });
    const stops = j.stops.filter((s) => s.country_iso2 === c.iso2);
    eyebrow = c.status === "current" ? "IJEOMA is here" : c.status === "visited" ? "Visited" : "Coming up";
    title = c.name;
    sub = stops.length ? stops.map((s) => s.city).filter((v, i, a) => a.indexOf(v) === i).join(", ") : "";
    rows = [
      ["First entered", fmtDate(c.first_entered_on)],
      ["Road driven here", kmInCountry(c.iso2, j.stops, j.legs).toLocaleString("en-US")],
      ["Countries", `${j.stats.countriesVisited}/${j.stats.totalCountries}`],
    ];
    highlight = stops.map((s) => ({ lng: s.lng, lat: s.lat }));
  } else {
    return new Response("Not found", { status: 404 });
  }

  const raisedText = `$${raised.usd.toLocaleString("en-US")} of ${fmtUsd(raised.goalUsd)}`;
  const pct = Math.min(100, (raised.usd / raised.goalUsd) * 100);
  const display = fonts.some((f) => f.name === "Condensed") ? "Condensed" : "sans-serif";
  const body = fonts.some((f) => f.name === "Body") ? "Body" : "sans-serif";

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#050506", color: "#f2f2f0", padding: 90, fontFamily: body }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: body, fontSize: 30, letterSpacing: 6, color: "#8a8a88" }}>
          <span style={{ fontFamily: display, color: "#f2f2f0", fontSize: 40 }}>SPYDEY TRACKER</span>
          <span style={{ color: ORANGE }}>IJEOMA</span>
        </div>

        <div style={{ display: "flex", marginTop: 60, height: 720, border: "2px solid rgba(255,255,255,0.12)", background: "radial-gradient(circle at 50% 50%, #151517 0%, #050506 75%)" }}>
          {trailSvg(j, highlight, { w: 896, h: 716 })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 70 }}>
          <span style={{ fontFamily: body, fontSize: 30, letterSpacing: 5, color: ORANGE }}>{eyebrow.toUpperCase()}</span>
          <span style={{ fontFamily: display, fontSize: 168, lineHeight: 0.95, marginTop: 14, textTransform: "uppercase" }}>{title}</span>
          {sub && <span style={{ fontSize: 44, color: "#8a8a88", marginTop: 12 }}>{sub}</span>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 50 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid rgba(255,255,255,0.12)", padding: "20px 0", fontFamily: body, fontSize: 34 }}>
              <span style={{ color: "#8a8a88", letterSpacing: 4 }}>{k.toUpperCase()}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: body, fontSize: 30 }}>
            <span style={{ color: "#8a8a88", letterSpacing: 4 }}>RAISED FOR CANCER AWARENESS</span>
            <span style={{ color: ORANGE }}>{raisedText}</span>
          </div>
          <div style={{ display: "flex", height: 8, background: "rgba(255,255,255,0.12)", marginTop: 18 }}>
            <div style={{ width: `${Math.max(pct, 0.8)}%`, background: ORANGE }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 50, background: ORANGE, color: "#000", padding: "30px 0", fontSize: 31, letterSpacing: 1, fontFamily: display, textAlign: "center" }}>
            DONATE: LINK IN @MICHAELSPYDER BIO
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
