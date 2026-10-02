import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Keeps the admin session fresh. Public pages never touch auth.
export async function proxy(request: NextRequest) {
  // Supabase falls back to the Site URL when a redirect isn't allow-listed,
  // so a magic link can land on "/?code=…". Hand it to the callback.
  if (request.nextUrl.pathname === "/") {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.next();
    const url = new URL("/auth/callback", request.url);
    url.searchParams.set("code", code);
    url.searchParams.set("next", "/admin");
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = { matcher: ["/", "/admin/:path*"] };
