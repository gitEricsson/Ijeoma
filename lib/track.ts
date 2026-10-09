import { SUPABASE_KEY, SUPABASE_URL } from "./supabase/env";

// First-party analytics: a visit per page load and each Donate click, sent to
// the track() database function (supabase/migrations/0005_analytics.sql).
// A random id in localStorage tells returning browsers apart; nothing personal
// is stored. Not counted: local development, automated browsers, and anyone
// signed in to the admin (so your own checks don't inflate the numbers).

const KEY = "spydey-vid";

// For browsers without crypto.randomUUID (older Safari).
function uuid4() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function browserId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? uuid4();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: skip rather than count every load as new
  }
}

function skip() {
  return (
    navigator.webdriver ||
    /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname) ||
    document.cookie.includes("-auth-token")
  );
}

export function track(kind: "visit" | "donate") {
  if (typeof window === "undefined" || skip()) return;
  const id = browserId();
  if (!id) return;
  // keepalive lets the Donate click land even as the page hands off to GoFundMe.
  fetch(`${SUPABASE_URL}/rest/v1/rpc/track`, {
    method: "POST",
    keepalive: true,
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_kind: kind, p_vid: id }),
  }).catch(() => {});
}
