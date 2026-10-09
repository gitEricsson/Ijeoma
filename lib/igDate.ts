// When an Instagram post was published, read from its shortcode alone: the
// shortcode is the media ID in base64 (A–Z a–z 0–9 - _), and the media ID's
// top bits are milliseconds since Instagram's epoch (2011-08-24). Checked
// against Instagram's own media IDs.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const IG_EPOCH_MS = BigInt(1314220021721);

export function shortcodeDate(shortcode: string): Date | null {
  // Longer shortcodes (private or shared links) carry extra characters after the 11 that encode the ID.
  const code = shortcode.slice(0, 11);
  let id = BigInt(0);
  for (const ch of code) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    id = id * BigInt(64) + BigInt(v);
  }
  const ms = Number((id >> BigInt(23)) + IG_EPOCH_MS);
  // Instagram launched in 2010; anything outside 2010..next year isn't a real post ID.
  const d = new Date(ms);
  return d.getUTCFullYear() >= 2010 && d.getUTCFullYear() <= new Date().getUTCFullYear() + 1 ? d : null;
}

/** The calendar day in Lagos (UTC+1, no daylight saving), as YYYY-MM-DD. */
export function lagosDay(d: Date): string {
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

type StopDates = { id: string; country_iso2: string; arrived_on: string };

/**
 * The stop a post from `day` belongs to: the last one he'd reached by then
 * (he's there, or on the road from it), or the first stop for earlier posts.
 */
export function stopForDay<T extends StopDates>(stops: T[], day: string): T | null {
  const sorted = [...stops].sort((a, b) => a.arrived_on.localeCompare(b.arrived_on));
  let found: T | null = null;
  for (const s of sorted) if (s.arrived_on.slice(0, 10) <= day) found = s;
  return found ?? sorted[0] ?? null;
}
