# Spydey Tracker

Michael Spyder's drive through all 54 African countries in IJEOMA, his orange Mercedes ML350, raising $1,000,000 for cancer awareness.

The site records where IJEOMA **has been**, never where she is right now: stops are entered by hand at city level, and roads between them are drawn by OSRM.

## Stack

Next.js 16 (App Router) · MapLibre GL (globe) + OpenFreeMap tiles · Supabase (Postgres, auth, RLS) · Tailwind v4 · Framer Motion · Netlify.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run db:apply             # schema + seed + road legs (safe to re-run)
npm run dev
```

`DATABASE_URL` must be the **session pooler** string (Supabase → Connect → Session pooler). The direct `db.*.supabase.co` host is IPv6-only.

## How it works

- `/` is a static page built from `getJourney()` (`lib/data.ts`), cached under the `journey` tag. Visitors never query Supabase directly.
- `/admin` (magic-link sign-in, `admins` allow-list) writes through server actions in `app/admin/actions.ts`. Every write expires the `journey` tag, so the public page rebuilds on its next visit.
- Saving a stop re-draws that expedition's legs (`lib/legs.ts`: OSRM for drives, arcs for ferry/flight/ship) and recomputes every country's status (`refresh_country_status()` in SQL).
- Instagram posts and reels are stored as links and shown as dark cards: caption from Instagram's public oEmbed, image through `/ig/<shortcode>` (Instagram's CDN refuses cross-site image loads). Story highlights can't be embedded, so they're link-out buttons.

## Features

- **Globe and trail.** On a first visit the globe turns in space for a moment, then the camera flies in to the trail as it draws on. Later visits fly straight in. Reduced motion jumps straight to the view.
- **IJEOMA on the trail.** A three.js model of the car in a small WebGL overlay that follows the trail every map frame (`lib/three/carMarker.ts`). Tap her to open the garage. three.js loads after the map, the map uses a 70 KB simplified model (`ijeoma-lite.glb`; the garage loads the full one), and the car is only redrawn when her heading, size, tilt, wheels or ride change. While she drives, her wheels roll with her actual on-screen travel (capped so the spokes never strobe) and the body rides a little suspension: three out-of-step waves plus the odd pothole on a damped spring, scaled by speed, so she's still when parked. The wheel rig (`rigWheels` in `lib/three/ijeoma.ts`) is only applied to the map's light model; the garage car's wheels never turn.
- **Journey replay.** A timeline with play and pause; IJEOMA drives every leg in order, with dates. As she reaches each checkpoint, its photo card shows at the stop for about two seconds and fades as she drives on (`components/map/CheckpointPreview.tsx`).
- **Garage.** A showroom (`lib/three/showroom.ts`): IJEOMA on a glossy turntable (brushed-metal rim, orange LED ring, 5° ticks) under a halo ring light, in a dark hall with a cove light at floor level, soft wall light panels, a polished tiled floor and three spotlight beams. Her reflection in the stage is a mirrored copy of the car under the stage's dark gloss. The stage turns slowly. One motion button (top right) opens the controls in a flowing flyout on hover or tap: turn 45° either way, pause, and the lighting (Showroom, Night, Sunset). Weaker devices get the stage and basic lights only.
  - Load time: the car appears once its shaders are compiled (`compileAsync`), with sponsor decals added just after. To keep that quick on Windows (Direct3D compiles slowly), the scene has one real spotlight (the other beams are just cones), no shadow maps or render-to-texture mirror, and standard materials; that took it from 36 shaders to 16. On fast connections the model is fetched once the map settles. `performance` marks `garage:open`, `garage:model` and `garage:ready` show the timing in DevTools. The car is the real W166 model. The garage opens on a three-quarter front view, and the stage starts turning once she's revealed.
  - Sponsors are grouped by side: Front, Right side, Left side, Rear, Roof (`SECTIONS` in `lib/site.ts`). A side can carry many sponsors. Picking a side flies the camera to it and lists its sponsors; picking a sponsor zooms onto their sticker on the car, and picking it again zooms back out. Tapping a sticker on the car does the same. "Full view" flies back. "Sponsor this side" opens a DM to @michaelspyder (`INSTAGRAM_DM`).
  - Stickers are decals placed where they are on the real car, from photos: JEFFFOREX (bonnet; under the right front door handle), C9X (right front wing by the mirror), Ralph Custom (right rear door's triangular glass), Solsync (right quarter glass; rear left corner above the tail light), Project Africa 54 (left front door), City Jollof (left rear door glass), NYNTH WORLD (left C-pillar), Wraphaus (rear glass, its wordmark only). IJEOMA's own stickers, her name and Cancer Awareness on the rear glass, are fixed livery (`LIVERY`). Logos are in `public/sponsors/`.
  - A sponsor's `panel` is a sticker spot (`SPOTS` in `lib/site.ts`, placed in `STICKER_SPOTS` in `lib/three/ijeoma.ts`), or just a side (listed there with no sticker yet). Each spot was measured on the model by raycasting (pillars, seams, handles, glass edges) and faces the panel's own surface normal. Every sticker lands fully on its panel: a 9 x 5 grid of rays over each one hits the target surface. A new spot needs an entry in both `SPOTS` and `STICKER_SPOTS`.
- **Current country.** A pulsing glow, and the country's own outline rippling outward (the "Spydey sense"). The ripple is 96 pre-scaled outlines in one static source; each frame only flips feature states, so nothing is re-tiled. It pauses while the garage is open.
- **Cancer facts.** Hovering a country shows a random fact for it; on phones, the country sheet shows one with "Another fact". Figures come from the GLOBOCAN country fact sheets (IARC/WHO), built into `public/data/cancer-facts.json` by `scripts/build-cancer-facts.py` (run by hand when IARC publishes new figures; needs `pypdf`). The admin's own fact for a country joins its pool. Seychelles has no GLOBOCAN sheet and shows Africa-wide facts; The Gambia's latest sheet is GLOBOCAN 2022, and its facts say so.
- **HUD.** A mission line, counts that run up as the HUD comes into view (countries, km, dollars, with the bar and the Donate plate in step), and a waving flag for the current country (`components/WavingFlag.tsx`, CSS transforms only).
- **Passport.** Real flags as stamps, with an orange ink mark and entry date on each visited country, over a spider web centred on the current country.
- **Trail pictures.** Hovering the trail (desktop) or tapping it (phones, which then show an "Open" button) shows a picture from the country it passes through. The picture is the stop's photo, then the country's, then a post from there (`lib/photos.ts`). Set them in the admin on Countries or a stop's page: upload a story screenshot (resized to WebP in the browser, stored in the public `photos` bucket) or paste a post or reel link. The four seeded countries use story frames in `public/photos/countries`; stop photos (like Cotonou's, at Étoile Rouge) are in `public/photos/stops`.
- **Stop and country sheets, feed** (every post, newest first), and deep links: `/?stop=<id>`, `/?country=GH`.
- **Instagram sync.** Admin → Posts → "Sync from Instagram": drag the "Send to Spydey" bookmark to your bookmarks bar, open Michael's profile in your own signed-in browser, scroll, and click it. The import page lists the posts with their dates, read from each shortcode (`lib/igDate.ts`), and files new ones under the stop he was at that day. Instagram blocks logged-out access to profiles, so this runs in your browser rather than on the server. There's a paste box for phones.
- **Share cards.** `/card/stop/<id>` and `/card/country/<ISO2>` render 1080×1920 Instagram Story images.
- **Live fundraising total.** Read from the GoFundMe campaign at most once an hour (`lib/gofundme.ts`): the amount from the campaign page, the donor count from GoFundMe's counts feed, no key or cost. GoFundMe counts in Canadian dollars; the site shows US dollars at a fixed 1 USD = 1.38 CAD (`CAD_PER_USD`), rounded up, against a fixed $1M goal. Donors include the 6 from the earlier Oncrowdr campaign (`EARLIER_DONORS`). The admin's manual figure is only a fallback.
- **Fire ring.** Hovering (or focusing) Michael's photo sets it alight (`components/hud/FireRing.tsx`): the flame catches at the top and burns round once like a progress ring, then keeps burning in place, with flame particles rising and cooling from yellow to red. It burns down when the pointer leaves.
- **Map style.** A stripped OpenFreeMap dark style with terrain hillshade from the free AWS Terrarium tiles.
- **Type.** Anybody (wide italic, for display) and Schibsted Grotesk.
- **Donate.** An orange plate with a highlight that passes every few seconds (`components/hud/DonateButton.tsx`).
- **Credit.** "Designed and built by Ericsson Raphael" at the foot of the HUD.
- **Private analytics.** The admin dashboard shows visitors (unique browsers, today, last 7 days, all time), page views, Donate clicks and click-through, with a 30-day chart. Counted first-party in Supabase (`supabase/migrations/0005_analytics.sql`, `lib/track.ts`): a random id in localStorage, no cookies, IPs or third parties. The public can only call `track()`; only admins can read, via `analytics_summary()`. Local runs, automated browsers and browsers signed in to the admin aren't counted.
- **Icon.** IJEOMA in side profile, traced from the 3D model itself: `scripts/assets/model-side.mjs` renders an exact orthographic side view of `ijeoma.glb` with a depth buffer (each pixel labelled by material), and `scripts/assets/icons.py` turns that into `app/icon.svg` (vector, about 8 KB), `app/favicon.ico` and `app/apple-icon.png`. `scripts/assets/model-lite.mjs` builds the light map model. Setup for both is in the scripts' headers.
- **Weaker phones** get no hillshade, pixel ratio 1 and no antialiasing on the car (`lib/device.ts`). Every device shows the real model: the 70 KB light one on the map, the full one in the garage (fetched as soon as someone reaches for the IJEOMA button). Browsers without WebGL get a plain list of stops.

The 3D car is "2013 Mercedes-Benz ML250 Bluetec Executive" by tonielpro520 (CC BY 4.0), recoloured to IJEOMA's measured #E9401E and compressed to `public/models/ijeoma.glb`.

## Performance notes

- First load is the page, the app CSS, two font files and about 190 KB of JS (gzipped). The map chunk (maplibre), three.js, the sheets (framer-motion) and the garage load afterwards, in that order.
- The map style and country boundaries are preloaded from the page `<head>`, so they arrive while the JS is still downloading.
- `maplibre-gl.css` ships with the map chunk, not on every page. The style's sprite sheet isn't downloaded (no icons are used).
- three.js skips its synchronous shader checks in production.
- `netlify.toml` sets cache headers for `/models`, `/flags`, `/photos` and `/data`.

Flags come from [flag-icons](https://github.com/lipis/flag-icons) (MIT), copied into `public/flags` (square) and `public/flags/4x3` by `scripts/copy-vendor.mjs`.

## Deploying to Netlify

1. Connect the repo. `netlify.toml` sets the build.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do **not** set `DATABASE_URL`.
3. Supabase → Authentication → URL Configuration: set the Site URL to the Netlify URL and add `https://<your-site>/auth/callback` and `http://localhost:3000/auth/callback` as redirect URLs.
4. GitHub → Settings → Secrets: add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the weekly keep-alive workflow.
