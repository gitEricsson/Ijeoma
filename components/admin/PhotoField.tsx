"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { setPhoto } from "@/app/admin/actions";

type Props = { kind: "country" | "stop"; id: string; current: string | null };

// Resize in the browser before upload so story screenshots stay small.
async function toWebp(file: File, max = 1200): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/webp", 0.82));
}

// The picture shown on the map when someone hovers or taps the trail here.
export default function PhotoField({ kind, id, current }: Props) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const save = (value: string) =>
    startTransition(async () => {
      const res = await setPhoto({ kind, id, value });
      setMsg(res);
      if (res?.ok) {
        setLink("");
        router.refresh();
      }
    });

  async function upload(file: File) {
    setMsg(null);
    try {
      const blob = await toWebp(file);
      const db = createBrowserSupabase();
      const path = `${kind === "country" ? "countries" : "stops"}/${id.toLowerCase()}-${Date.now()}.webp`;
      const { error } = await db.storage.from("photos").upload(path, blob, { contentType: "image/webp", upsert: false });
      if (error) throw new Error(error.message);
      save(db.storage.from("photos").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="label">Trail picture (shown when people hover or tap the route here)</span>
      <div className="flex items-start gap-3">
        <div className="grid h-24 w-16 shrink-0 place-items-center overflow-hidden border border-line bg-ink text-[10px] text-muted">
          {current ? <img src={current} alt="" className="h-full w-full object-cover" /> : "None"}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="btn cursor-pointer self-start">
            Upload a story screenshot
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <div className="flex gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="or paste an Instagram post or reel link" className="field" inputMode="url" />
            <button type="button" disabled={busy || !link.trim()} onClick={() => save(link)} className="btn shrink-0 disabled:opacity-40">
              Use link
            </button>
          </div>
          {current && (
            <button type="button" disabled={busy} onClick={() => save("")} className="self-start text-sm text-muted underline-offset-4 hover:text-text hover:underline">
              Remove picture
            </button>
          )}
          {msg?.ok && <span className="text-sm text-muted">{msg.ok}</span>}
          {msg?.error && <span className="text-sm text-orange">{msg.error}</span>}
        </div>
      </div>
    </div>
  );
}
