import { unstable_cache } from "next/cache";
import { RAISED_TAG } from "./site";

// The campaign's public JSON, the same endpoint oncrowdr.com's own page reads.
// No key, no cost: it is fetched at most once per REFRESH_SECONDS, when the
// cached page is rebuilt.
const CAMPAIGN_API = "https://api.oncrowdr.com/campaigns/slug/help-raise-1000000-for-cancer-awareness-in-africa";
export const REFRESH_SECONDS = 6 * 60 * 60;

// Oncrowdr counts in naira. The site shows dollars at a fixed ₦1,400 = $1
// (so the ₦1.4B goal reads as $1,000,000), rounded up to whole dollars.
export const NGN_PER_USD = 1400;
export const ngnToUsd = (ngn: number) => Math.ceil(ngn / NGN_PER_USD);

export type CampaignTotals = { ngn: number; goalNgn: number; donors: number; fetchedAt: string };

export async function fetchCampaignTotals(): Promise<CampaignTotals | null> {
  try {
    const res = await fetch(CAMPAIGN_API, {
      headers: { Accept: "application/json", "User-Agent": "spydey-tracker (reads campaign totals a few times a day)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    const ngn = Number(data?.nairaDonatedAmount);
    const goalNgn = Number(data?.nairaGoalAmount);
    if (!Number.isFinite(ngn) || !Number.isFinite(goalNgn) || goalNgn <= 0) return null;
    return { ngn, goalNgn, donors: Number(data?.totalNoOfCampaignDonors) || 0, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

export const getCampaignTotals = unstable_cache(fetchCampaignTotals, ["oncrowdr-v1"], { tags: [RAISED_TAG], revalidate: REFRESH_SECONDS });
