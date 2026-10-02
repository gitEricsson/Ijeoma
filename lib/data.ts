import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/server";
import { computeStats } from "./stats";
import { JOURNEY_TAG } from "./site";
import { getCampaignTotals, ngnToUsd } from "./oncrowdr";
import { fetchPostMeta } from "./instagram";
import type { Country, Expedition, Journey, Leg, Post, Raised, SiteState, Sponsor, Stop } from "./types";

async function loadJourney(): Promise<Journey> {
  const db = createPublicClient();
  const [countries, expeditions, stops, legs, posts, sponsors, site] = await Promise.all([
    db.from("countries").select("iso2,name,status,first_entered_on,centroid_lng,centroid_lat,cancer_fact,ig_highlight_url,is_home,photo_url").order("name"),
    db.from("expeditions").select("id,name,start_date,end_date,summary,is_placeholder").is("deleted_at", null).order("start_date"),
    db.from("stops").select("id,expedition_id,city,country_iso2,lat,lng,arrived_on,left_on,arrival_mode,caption,is_reconstructed,photo_url").is("deleted_at", null).order("arrived_on").order("created_at"),
    db.from("legs").select("id,expedition_id,from_stop_id,to_stop_id,mode,geometry,distance_km,is_fallback"),
    db.from("posts").select("id,stop_id,country_iso2,url,shortcode,kind,author,posted_on,caption,sort").is("deleted_at", null).order("sort"),
    db.from("sponsors").select("id,name,logo_url,link,panel,tier,active").is("deleted_at", null).eq("active", true),
    db.from("site_state").select("status,raised_usd,goal_usd,raised_updated_at,next_country_iso2,count_home,updated_at").eq("id", 1).single(),
  ]);
  for (const r of [countries, expeditions, stops, legs, posts, sponsors, site]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }
  // Legs whose stops were soft-deleted must not be drawn.
  const stopIds = new Set((stops.data as Stop[]).map((s) => s.id));
  const liveLegs = (legs.data as Leg[]).filter((l) => stopIds.has(l.from_stop_id) && stopIds.has(l.to_stop_id));
  const siteState = site.data as SiteState;
  siteState.raised_usd = Number(siteState.raised_usd);
  siteState.goal_usd = Number(siteState.goal_usd);

  const c = countries.data as Country[];
  const e = expeditions.data as Expedition[];
  const s = stops.data as Stop[];
  return {
    countries: c,
    expeditions: e,
    stops: s,
    legs: liveLegs,
    posts: await Promise.all(
      (posts.data as Omit<Post, "meta">[]).map(async (p) => ({ ...p, meta: await fetchPostMeta(p.url) })),
    ),
    sponsors: sponsors.data as Sponsor[],
    site: siteState,
    stats: computeStats(c, e, s, liveLegs, siteState),
    lastUpdated: siteState.updated_at,
  };
}

// Visitors only ever read this cache; admin saves expire the tag.
export const getJourney = unstable_cache(loadJourney, ["journey-v5"], { tags: [JOURNEY_TAG], revalidate: 86400 });

// Live Oncrowdr totals when reachable, otherwise the admin's manual figure.
export async function getRaised(site: SiteState): Promise<Raised> {
  const live = await getCampaignTotals();
  if (live) {
    return {
      ngn: live.ngn,
      goalNgn: live.goalNgn,
      donors: live.donors,
      usd: ngnToUsd(live.ngn),
      goalUsd: ngnToUsd(live.goalNgn),
      source: "oncrowdr",
      fetchedAt: live.fetchedAt,
    };
  }
  return { ngn: null, goalNgn: null, donors: null, usd: site.raised_usd, goalUsd: site.goal_usd, source: "manual", fetchedAt: site.raised_updated_at };
}
