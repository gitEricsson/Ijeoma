"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/admin/actions";

type Props = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submit?: string;
  className?: string;
};

export default function ActionForm({ action, children, submit = "Save", className = "" }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={`flex flex-col gap-3 ${className}`}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "Saving…" : submit}
        </button>
        {state?.ok && <span className="text-sm text-muted">{state.ok}</span>}
        {state?.error && <span className="text-sm text-orange">{state.error}</span>}
      </div>
    </form>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
