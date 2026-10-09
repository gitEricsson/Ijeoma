"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { importPosts, type ActionState } from "@/app/admin/actions";
import { lagosDay, shortcodeDate, stopForDay } from "@/lib/igDate";
import { SHORTCODE_RE } from "@/lib/instagram";

type Stop = { id: string; city: string; country_iso2: string; arrived_on: string };
type Item = { kind: "post" | "reel"; code: string };

const fmt = (d: Date) =>
  d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

// Review what the bookmark (or the paste box) collected, then import.
export default function IgImport({ stops, known, removed }: { stops: Stop[]; known: string[]; removed: string[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ActionState>(null);
  const [busy, start] = useTransition();
  const onSite = useMemo(() => new Set(known), [known]);
  const gone = useMemo(() => new Set(removed), [removed]);

  // The links arrive in the URL fragment: #codes=reel:ABC,p:DEF
  useEffect(() => {
    const raw = new URLSearchParams(window.location.hash.slice(1)).get("codes") ?? "";
    const seen = new Set<string>();
    const list: Item[] = [];
    for (const part of raw.split(",")) {
      const [k, code] = part.split(":");
      if (!code || !SHORTCODE_RE.test(code) || seen.has(code)) continue;
      seen.add(code);
      list.push({ kind: k === "p" ? "post" : "reel", code });
    }
    list.sort((a, b) => (shortcodeDate(b.code)?.getTime() ?? 0) - (shortcodeDate(a.code)?.getTime() ?? 0));
    // Reading the fragment needs the browser, so this runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(list);
    setPicked(new Set(list.filter((i) => !onSite.has(i.code) && !gone.has(i.code)).map((i) => i.code)));
  }, [onSite, gone]);

  if (!items) return <p className="label">Reading the links…</p>;
  if (!items.length)
    return (
      <p className="text-sm text-muted">
        No post links arrived. Go back to <Link href="/admin/posts" className="underline underline-offset-4">Posts</Link> and use the bookmark or paste box.
      </p>
    );

  const toggle = (code: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {items.map((i) => {
          const when = shortcodeDate(i.code);
          const stop = when ? stopForDay(stops, lagosDay(when)) : null;
          const status = onSite.has(i.code) ? "On the site" : gone.has(i.code) ? "Removed earlier" : "New";
          const selectable = status === "New";
          return (
            <li key={i.code} className={`flex items-center gap-3 py-2.5 text-sm ${selectable ? "" : "opacity-55"}`}>
              <input type="checkbox" checked={picked.has(i.code)} disabled={!selectable} onChange={() => toggle(i.code)} className="accent-orange" aria-label={`Import ${i.code}`} />
              <a href={`https://www.instagram.com/${i.kind === "post" ? "p" : "reel"}/${i.code}/`} target="_blank" rel="noopener noreferrer" className="w-28 shrink-0 font-mono text-xs underline-offset-4 hover:underline">
                {i.code}
              </a>
              <span className="w-12 shrink-0 capitalize text-muted">{i.kind}</span>
              <span className="min-w-0 flex-1 truncate">{when ? fmt(when) : "Unknown date"}</span>
              <span className="hidden min-w-0 flex-1 truncate text-muted sm:block">{stop ? `→ ${stop.city}` : "→ no stop yet"}</span>
              <span className={`shrink-0 text-xs ${selectable ? "text-orange" : "text-muted"}`}>{status}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          disabled={busy || !picked.size}
          onClick={() =>
            start(async () => {
              const res = await importPosts(items.filter((i) => picked.has(i.code)));
              setResult(res);
              if (res?.ok) setPicked(new Set());
            })
          }
        >
          {busy ? "Importing…" : `Import ${picked.size} ${picked.size === 1 ? "post" : "posts"}`}
        </button>
        <Link href="/admin/posts" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">
          Back to Posts
        </Link>
        {result?.ok && <span className="text-sm text-muted">{result.ok}</span>}
        {result?.error && <span className="text-sm text-orange">{result.error}</span>}
      </div>
    </div>
  );
}
