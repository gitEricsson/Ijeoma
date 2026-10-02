"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import Flag from "@/components/Flag";

type Props = { open: boolean; onClose: () => void; title: string; eyebrow?: string; flagIso?: string; children: ReactNode };

// Bottom sheet on phones, right-hand panel on desktop.
export default function BottomSheet({ open, onClose, title, eyebrow, flagIso, children }: Props) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key={title}
          role="dialog"
          aria-label={title}
          className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[82dvh] flex-col border-t border-line bg-panel-solid md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:border-l md:border-t-0"
          initial={reduce ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 300 }}
          drag={reduce ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onClose();
          }}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden />
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-3 md:pt-6">
            <div className="min-w-0">
              {eyebrow && <div className="text-sm text-muted">{eyebrow}</div>}
              <h2 className="font-display flex items-center gap-2.5 truncate text-2xl uppercase leading-tight">
                {flagIso && <Flag iso={flagIso} size={24} />}
                {title}
              </h2>
            </div>
            <button onClick={onClose} className="-mr-2 grid h-9 w-9 shrink-0 place-items-center text-muted hover:text-text" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-8" onPointerDownCapture={(e) => e.stopPropagation()}>
            {children}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
