"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { Post } from "@/lib/types";
import { fmtDate } from "@/lib/format";

// A dark, on-theme card for an Instagram post: the image (through /ig, our
// proxy), caption, author and date. Instagram's own embed only comes in light.
export default function PostCard({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const caption = post.caption ?? post.meta?.caption ?? null;
  const author = post.meta?.author ?? post.author;
  const ratio = post.meta?.width && post.meta?.height ? post.meta.width / post.meta.height : post.kind === "reel" ? 9 / 16 : 1;
  // Very tall reels are cropped a little so one card never fills the whole sheet.
  const shown = Math.max(ratio, 0.68);
  const long = !!caption && (caption.length > 160 || caption.split("\n").length > 4);

  return (
    <article className="overflow-hidden border border-line bg-panel-solid">
      <a href={post.url} target="_blank" rel="noopener noreferrer" className="group relative block bg-ink" style={{ aspectRatio: String(shown) }} aria-label={`Watch on Instagram${caption ? `: ${caption.slice(0, 80)}` : ""}`}>
        {!failed && (
          <img
            src={`/ig/${post.shortcode}`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )}
        {post.kind === "reel" && (
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-text">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M5 3l10 6-10 6z" fill="currentColor" />
            </svg>
          </span>
        )}
      </a>
      <div className="p-3.5">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate font-medium">@{author}</span>
          <span className="shrink-0 text-muted">{fmtDate(post.posted_on)}</span>
        </div>
        {caption && (
          <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-text/90 ${open ? "" : "line-clamp-4"}`}>{caption}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          {long ? (
            <button onClick={() => setOpen((v) => !v)} className="text-muted underline-offset-4 hover:text-text hover:underline">
              {open ? "Less" : "More"}
            </button>
          ) : (
            <span />
          )}
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="chip">
            Watch on Instagram
          </a>
        </div>
      </div>
    </article>
  );
}
