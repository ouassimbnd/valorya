"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; text: string };
export type ConfirmOptions = { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; tone?: "default" | "danger" };
type Pending = ConfirmOptions & { resolve: (value: boolean) => void };
type Api = { toast: (text: string, kind?: Kind) => void; confirm: (options: ConfirmOptions) => Promise<boolean> };

const Context = createContext<Api>({
  toast: () => {},
  confirm: async (o) => (typeof window !== "undefined" ? window.confirm(o.title) : false),
});

export function useFeedback(): Api { return useContext(Context); }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const counter = useRef(0);

  const toast = useCallback((text: string, kind: Kind = "success") => {
    if (!text) return;
    const id = ++counter.current;
    setToasts(items => [...items.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setToasts(items => items.filter(t => t.id !== id)), kind === "error" ? 7000 : 4200);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => {
    setPending(previous => { previous?.resolve(false); return { ...options, resolve }; });
  }), []);

  const close = (value: boolean) => { pending?.resolve(value); setPending(null); };
  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { pending.resolve(false); setPending(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  return (
    <Context.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon name={t.kind === "error" ? "alert" : t.kind === "info" ? "info" : "check"} size={18} />
            <span>{t.text}</span>
            <button type="button" aria-label="Fermer" onClick={() => setToasts(items => items.filter(x => x.id !== t.id))}><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
      {pending && (
        <div className="dialog-backdrop" onClick={() => close(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}>
            <h2 id="dialog-title">{pending.title}</h2>
            {pending.body && <p>{pending.body}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>{pending.cancelLabel || "Annuler"}</button>
              <button type="button" ref={confirmButton} className={`btn ${pending.tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)}>{pending.confirmLabel || "Confirmer"}</button>
            </div>
          </div>
        </div>
      )}
    </Context.Provider>
  );
}
