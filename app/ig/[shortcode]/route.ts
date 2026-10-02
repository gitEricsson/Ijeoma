import { SHORTCODE_RE } from "@/lib/instagram";

// Post images through our own origin: Instagram's CDN sends
// cross-origin-resource-policy: same-origin, so browsers won't show them
// on another site. The host is fixed, so this can't be used as an open proxy.
export async function GET(_: Request, ctx: RouteContext<"/ig/[shortcode]">) {
  const { shortcode } = await ctx.params;
  if (!SHORTCODE_RE.test(shortcode)) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(`https://www.instagram.com/p/${shortcode}/media/?size=l`, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (spydey-tracker)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response("Not found", { status: 404 });
    return new Response(res.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
