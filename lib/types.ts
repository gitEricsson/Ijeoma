import type { LineString, Mode } from "./routing";

export type CountryStatus = "upcoming" | "current" | "visited";
export type SiteStatus = "on_the_road" | "at_base" | "paused";

export type Country = {
  iso2: string;
  name: string;
  status: CountryStatus;
  first_entered_on: string | null;
  centroid_lng: number;
  centroid_lat: number;
  cancer_fact: string | null;
  ig_highlight_url: string | null;
  is_home: boolean;
  photo_url: string | null;
};

export type Expedition = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  summary: string | null;
  is_placeholder: boolean;
};

export type Stop = {
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
  photo_url: string | null;
};

export type Leg = {
  id: string;
  expedition_id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: Mode;
  geometry: LineString;
  distance_km: number;
  is_fallback: boolean;
};

export type Post = {
  id: string;
  stop_id: string | null;
  country_iso2: string | null;
  url: string;
  shortcode: string;
  kind: "post" | "reel";
  author: string;
  posted_on: string | null;
  caption: string | null;
  sort: number;
  /** From Instagram's oEmbed at build time; null if it couldn't be fetched. */
  meta: import("./instagram").PostMeta | null;
};

export type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  link: string | null;
  panel: string;
  tier: string;
  active: boolean;
};

export type SiteState = {
  status: SiteStatus;
  raised_usd: number;
  goal_usd: number;
  raised_updated_at: string | null;
  next_country_iso2: string | null;
  count_home: boolean;
  updated_at: string;
};

export type Stats = {
  countriesVisited: number;
  totalCountries: number;
  approxKm: number;
  expeditions: number;
  daysOnRoad: number;
  stops: number;
};

// Money raised, read live from Oncrowdr (naira) with the admin's manual
// figure as a fallback. Shown in dollars: naira ÷ 1,400, rounded up.
export type Raised = {
  ngn: number | null;
  goalNgn: number | null;
  donors: number | null;
  usd: number;
  goalUsd: number;
  source: "oncrowdr" | "manual";
  fetchedAt: string | null;
};

export type Journey = {
  countries: Country[];
  expeditions: Expedition[];
  stops: Stop[];
  legs: Leg[];
  posts: Post[];
  sponsors: Sponsor[];
  site: SiteState;
  stats: Stats;
  lastUpdated: string;
};
