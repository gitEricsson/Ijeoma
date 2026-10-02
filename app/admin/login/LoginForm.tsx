"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createBrowserSupabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/admin`, shouldCreateUser: true },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return <p className="hud p-4 text-sm">Check {email} for a sign-in link. It works once, on this device&apos;s browser.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="label" htmlFor="email">
        Email
      </label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      <button disabled={state === "sending"} className="btn-primary">
        {state === "sending" ? "Sending…" : "Send magic link"}
      </button>
      {state === "error" && <p className="text-sm text-orange">{message}</p>}
    </form>
  );
}
