"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type LoadingContextValue = { setPending: (id: string, pending: boolean) => void };
const LoadingContext = createContext<LoadingContextValue | null>(null);

// Each request owns its signal, so one completed request cannot unlock another pending request.
export function useLoadingSignal(pending: boolean) {
  const context = useContext(LoadingContext);
  const id = useId();
  if (!context) throw new Error("Loading signals must be inside LoadingProvider.");
  const { setPending } = context;
  useEffect(() => {
    if (pending) setPending(id, true);
    return () => { if (pending) setPending(id, false); };
  }, [id, pending, setPending]);
}

export function LoadingSignal({ pending }: { pending: boolean }) {
  useLoadingSignal(pending);
  return null;
}

function LoadingDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="loading-dialog" tabIndex={-1} aria-modal="true" aria-label="Please wait" onCancel={(event) => event.preventDefault()}>
    <LoadingCard />
  </dialog>;
}

export function LoadingCard() {
  return <div className="loading-card" role="status" aria-live="polite"><LoaderCircle size={22} className="spin" aria-hidden="true" /><span>Please wait</span></div>;
}

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Set<string>>(() => new Set());
  const setPending = useCallback((id: string, pending: boolean) => {
    setRequests((current) => {
      if (current.has(id) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ setPending }), [setPending]);
  const busy = requests.size > 0;
  return <LoadingContext.Provider value={value}>
    <div data-app-shell inert={busy} aria-busy={busy}>{children}</div>
    {busy && <LoadingDialog />}
  </LoadingContext.Provider>;
}
