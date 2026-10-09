"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseInstagramUrl } from "@/lib/instagram";

// The bookmark's script, run on Michael's Instagram profile in your own
// browser: it gathers every post and reel link on the page and opens the
// import page here with them in the URL fragment (never sent to a server).
function bookmarklet(origin: string) {
  const code = `(()=>{const s=new Set();document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"],a[href*="/reels/"]').forEach(a=>{const m=(a.getAttribute('href')||'').match(/\\/(p|reels?)\\/([A-Za-z0-9_-]+)/);if(m)s.add((m[1]==='p'?'p':'reel')+':'+m[2])});if(!s.size){alert('No posts found here. Open the Instagram profile and scroll to load posts first.');return}window.open(${JSON.stringify(origin)}+'/admin/posts/import#codes='+[...s].join(','),'_blank')})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

export default function IgSync() {
  const link = useRef<HTMLAnchorElement>(null);
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // React refuses javascript: hrefs, so the bookmark's address is set directly.
  useEffect(() => {
    link.current?.setAttribute("href", bookmarklet(window.location.origin));
  }, []);

  const importPasted = () => {
    const codes = text
      .split(/\s+/)
      .map((l) => parseInstagramUrl(l))
      .filter((p) => !!p)
      .map((p) => `${p.kind === "post" ? "p" : "reel"}:${p.shortcode}`);
    if (!codes.length) {
      setError("No Instagram post or reel links found. Paste one link per line.");
      return;
    }
    router.push(`/admin/posts/import#codes=${[...new Set(codes)].join(",")}`);
  };

  return (
    <section className="flex flex-col gap-4 border border-line p-4">
      <div>
        <h2 className="font-semibold">Sync from Instagram</h2>
        <p className="mt-1 text-sm text-muted">New posts and reels are dated automatically and filed under the stop Michael was at that day.</p>
      </div>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        <li>
          Drag this to your bookmarks bar:{" "}
          <a ref={link} onClick={(e) => e.preventDefault()} className="chip ml-1 cursor-grab font-medium text-orange" title="Drag me to your bookmarks bar">
            Send to Spydey
          </a>
        </li>
        <li>
          Open{" "}
          <a href="https://www.instagram.com/michaelspyder/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            instagram.com/michaelspyder
          </a>{" "}
          in this browser, signed in, and scroll until the posts you want have loaded.
        </li>
        <li>Click the bookmark. A tab opens here with the posts to review and import.</li>
      </ol>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">On a phone, or the bookmark won&apos;t work? Paste links instead</summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            rows={4}
            placeholder={"https://www.instagram.com/reel/DeOhGYxx49U/\nhttps://www.instagram.com/p/DeGhGGyxiGe/"}
            className="field font-mono text-xs"
          />
          {error && <p className="text-sm text-orange">{error}</p>}
          <button type="button" onClick={importPasted} className="btn self-start">
            Review and import
          </button>
        </div>
      </details>
    </section>
  );
}
