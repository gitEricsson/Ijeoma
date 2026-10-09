import { unstable_cache } from "next/cache";
import { RAISED_TAG } from "./site";

// The GoFundMe campaign, read from its public page and GoFundMe's small
// counts feed. No key, no cost: fetched at most once per REFRESH_SECONDS,
// when the cached page is rebuilt.
export const CAMPAIGN_SLUG = "help-michaelspyder-raise-1000000-for-cancer-awareness-in";
const PAGE_URL = `https://www.gofundme.com/f/${CAMPAIGN_SLUG}`;
const COUNTS_URL = `https://gateway.gofundme.com/web-gateway/v1/feed/${CAMPAIGN_SLUG}/counts`;
export const REFRESH_SECONDS = 60 * 60;

// GoFundMe counts in Canadian dollars. The site shows US dollars at a fixed
// rate, rounded up to whole dollars (as it did with the old ₦1,400 rule).
export const CAD_PER_USD = 1.38;
export const cadToUsd = (cad: number) => Math.ceil(cad / CAD_PER_USD);

// The goal is $1,000,000 whatever GoFundMe's own goal field says.
export const GOAL_USD = 1_000_000;

// Donors from the earlier Oncrowdr campaign (its money has moved to GoFundMe,
// so only the people are added, not the amount).
export const EARLIER_DONORS = 6;

export type CampaignTotals = { cad: number; donors: number; fetchedAt: string };

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; spydey-tracker; reads the campaign total a few times a day)",
  "Accept-Language": "en-US,en;q=0.9",
};

async function get(url: string, accept: string) {
  const res = await fetch(url, { headers: { ...HEADERS, Accept: accept }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  return res.ok ? res : null;
}

// The amount GoFundMe shows on the page; its donor counts from the counts
// feed. Each backs the other up; null if neither can be read.
export async function fetchCampaignTotals(): Promise<CampaignTotals | null> {
  const [page, counts] = await Promise.all([
    get(PAGE_URL, "text/html")
      .then((r) => r?.text() ?? null)
      .catch(() => null),
    get(COUNTS_URL, "application/json")
      .then((r) => r?.json() ?? null)
      .catch(() => null),
  ]);
  const c = counts?.references?.counts;
  const pageAmount = page?.match(/"currentAmount":\{"__typename":"Money","amount":([\d.]+),"currencyCode":"([A-Z]{3})"\}/);
  const pageDonors = page?.match(/"donationCount":(\d+)/);

  const cad = pageAmount && pageAmount[2] === "CAD" ? Number(pageAmount[1]) : Number(c?.amount_raised_unattributed);
  const donors = Number.isFinite(Number(c?.total_unique_donors)) ? Number(c.total_unique_donors) : Number(pageDonors?.[1]);
  if (!Number.isFinite(cad) || cad < 0 || !Number.isFinite(donors)) return null;
  return { cad, donors, fetchedAt: new Date().toISOString() };
}

export const getCampaignTotals = unstable_cache(fetchCampaignTotals, ["gofundme-v1"], { tags: [RAISED_TAG], revalidate: REFRESH_SECONDS });
