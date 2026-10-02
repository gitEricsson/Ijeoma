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
- **IJEOMA on the trail.** A three.js model of the car in a small WebGL overlay that follows the trail every map frame (`lib/three/carMarker.ts`). Tap her to open the garage. three.js loads after the map, the map uses a 70 KB simplified model (`ijeoma-lite.glb`; the garage loads the full one), and the car is only redrawn when her heading, size or tilt changes.
- **Journey replay.** A timeline with play and pause; IJEOMA drives every leg in order, with dates.
- **Garage.** An orbitable IJEOMA (the real W166 model) with eight sponsor panels; a panel can carry several sponsors. JEFFFOREX, the first sponsor, is on the bonnet just ahead of the two vents. "Sponsor this panel" opens a DM to @michaelspyder (`INSTAGRAM_DM` in `lib/site.ts`). Picking a panel (by name or on the car) flies the camera to it; "Full view" flies back.
- **Current country.** A pulsing glow, and the country's own outline rippling outward (the "Spydey sense"). The ripple is 96 pre-scaled outlines in one static source; each frame only flips feature states, so nothing is re-tiled. It pauses while the garage is open.
- **Cancer facts.** Hovering a country shows a random fact for it; on phones, the country sheet shows one with "Another fact". Figures come from the GLOBOCAN country fact sheets (IARC/WHO), built into `public/data/cancer-facts.json` by `scripts/build-cancer-facts.py` (run by hand when IARC publishes new figures; needs `pypdf`). The admin's own fact for a country joins its pool. Seychelles has no GLOBOCAN sheet and shows Africa-wide facts; The Gambia's latest sheet is GLOBOCAN 2022, and its facts say so.
- **HUD.** A mission line, counts that run up as the HUD comes into view (countries, km, dollars, with the bar and the Donate plate in step), and a waving flag for the current country (`components/WavingFlag.tsx`, CSS transforms only).
- **Passport.** Real flags as stamps, with an orange ink mark and entry date on each visited country, over a spider web centred on the current country.
- **Trail pictures.** Hovering the trail (desktop) or tapping it (phones, which then show an "Open" button) shows a picture from the country it passes through. The picture is the stop's photo, then the country's, then a post from there (`lib/photos.ts`). Set them in the admin on Countries or a stop's page: upload a story screenshot (resized to WebP in the browser, stored in the public `photos` bucket) or paste a post or reel link. The four seeded countries use story frames in `public/photos/countries`.
- **Stop and country sheets, feed**, and deep links: `/?stop=<id>`, `/?country=GH`.
- **Share cards.** `/card/stop/<id>` and `/card/country/<ISO2>` render 1080×1920 Instagram Story images.
- **Live fundraising total.** Read from Oncrowdr's public campaign JSON at most every 6 hours (`lib/oncrowdr.ts`), at no cost. Shown in dollars at ₦1,400 = $1, rounded up (`NGN_PER_USD`). The admin's manual figure is only a fallback.
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

## Placeholder data

The seed includes a **placeholder** Lagos → Cotonou → Lomé → Accra → Lagos expedition with made-up June 2026 dates, so the map isn't empty. Replace it with Spyder's real stops in the admin page, then delete the placeholder expedition.
