"use client";

import { useState } from "react";

type Props = { kind: "stop" | "country"; id: string; title: string };

// Shares an auto-generated Instagram Story card (1080×1920) for a stop or
// country. Phones get the native share sheet with the image attached;
// desktops get the image to save plus a copied link.
export default function ShareButton({ kind, id, title }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const cardUrl = `/card/${kind}/${encodeURIComponent(id)}`;

  async function share() {
    const link = `${location.origin}/?${kind}=${encodeURIComponent(id)}`;
    const text = `${title}. Follow IJEOMA through all 54 African countries, raising money for cancer awareness.`;
    try {
      const blob = await fetch(cardUrl).then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      });
      const file = new File([blob], `spydey-${kind}-${id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${text} ${link}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, text, url: link });
        return;
      }
      window.open(cardUrl, "_blank", "noopener");
      await navigator.clipboard?.writeText(link);
      setNote("Story card opened. Link copied.");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      try {
        await navigator.clipboard?.writeText(link);
        setNote("Link copied.");
      } catch {
        setNote(link);
      }
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={share} className="chip">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M6 1v7M3 4l3-3 3 3M1.5 7v3.5h9V7" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        Share story card
      </button>
      {note && <span className="label normal-case tracking-normal">{note}</span>}
    </div>
  );
}
