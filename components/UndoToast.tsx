"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export type ToastState = {
  id: number;
  message: string;
  durationMs: number;
  actionLabel?: string;
  /** What the button does. Kept here so the manager owns the behaviour. */
  action?: () => void;
};

type Props = {
  toast: ToastState | null;
  onDismiss: () => void;
  /** Hovering or focusing holds the countdown, so a toast is never lost mid-read. */
  onPause?: () => void;
  onResume?: () => void;
};

/**
 * Rendered as a live region so the undo is discoverable with a keyboard reader as
 * well as by eye. The countdown bar is CSS-only, so a re-render cannot restart it.
 */
export default function UndoToast({ toast, onDismiss, onPause, onResume }: Props) {
  const regionRef = useRef<HTMLDivElement>(null);
  const previousId = useRef<number | null>(null);

  useEffect(() => {
    if (toast && toast.id !== previousId.current) {
      previousId.current = toast.id;
      regionRef.current?.focus();
    }
  }, [toast]);

  if (!toast) {
    return null;
  }

  const action: ReactNode = toast.action ? (
    <button
      type="button"
      onClick={() => {
        toast.action?.();
        onDismiss();
      }}
      className="shrink-0 rounded-xl bg-ink px-3 py-1.5 text-[11px] font-semibold text-[var(--canvas)] transition-all hover:opacity-90 active:scale-95"
    >
      {toast.actionLabel ?? "Undo"}
    </button>
  ) : null;

  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      data-toast-active=""
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocusCapture={onPause}
      onBlurCapture={onResume}
      className="pointer-events-auto fixed bottom-5 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 outline-none"
    >
      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface-raised/95 px-4 py-3 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
          {toast.message}
        </p>

        {action}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-lg p-1 text-faint transition hover:bg-sunken hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        className="undo-countdown mt-1 h-0.5 w-full rounded-full bg-accent/70"
        style={{ "--undo-duration": `${toast.durationMs}ms` } as CSSProperties}
      />
    </div>
  );
}
