// Accepts instagram.com post and reel links, with or without a username
// segment: /p/CODE, /reel/CODE, /reels/CODE, /user/p/CODE, /user/reel/CODE.
const RE = /^https?:\/\/(?:www\.)?instagram\.com\/(?:([A-Za-z0-9._]+)\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)/;

export type ParsedPost = { url: string; shortcode: string; kind: "post" | "reel"; author: string | null };

export function parseInstagramUrl(input: string): ParsedPost | null {
  const m = input.trim().match(RE);
  if (!m) return null;
  const [, author, type, shortcode] = m;
  const kind = type === "p" ? "post" : "reel";
  const path = kind === "post" ? "p" : "reel";
  return {
    url: `https://www.instagram.com/${author ? `${author}/` : ""}${path}/${shortcode}/`,
    shortcode,
    kind,
    author: author ?? null,
  };
}

export const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,20}$/;

export type PostMeta = { caption: string | null; author: string | null; width: number | null; height: number | null };

// Instagram's public oEmbed endpoint: caption, author and image size, no token.
export async function fetchPostMeta(url: string): Promise<PostMeta | null> {
  try {
    const res = await fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (spydey-tracker)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      caption: typeof j.title === "string" && j.title.trim() ? j.title.trim() : null,
      author: typeof j.author_name === "string" ? j.author_name : null,
      width: Number(j.thumbnail_width) || null,
      height: Number(j.thumbnail_height) || null,
    };
  } catch {
    return null;
  }
}
