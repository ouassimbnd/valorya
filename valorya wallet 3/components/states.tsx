"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import type { MerchantState } from "@/lib/use-merchant";

export function Skeleton({ height = 16, width = "100%", radius = 8 }: { height?: number; width?: number | string; radius?: number }) {
  return <span className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden="true" />;
}

export function PageSkeleton({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="ws-page" role="status" aria-label={label}>
      <div className="skeleton-stack"><Skeleton height={14} width={120} /><Skeleton height={34} width="46%" /><Skeleton height={16} width="62%" /></div>
      <div className="grid grid-3" style={{ marginTop: 28 }}>{[0, 1, 2].map(i => <div className="card" key={i}><Skeleton height={12} width="50%" /><div style={{ height: 14 }} /><Skeleton height={34} width="40%" /></div>)}</div>
      <div className="card" style={{ marginTop: 20 }}><Skeleton height={14} width="30%" /><div style={{ height: 16 }} /><Skeleton height={56} /><div style={{ height: 10 }} /><Skeleton height={56} /></div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "sparkle", title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ws-page">
      <div className="card empty" role="alert">
        <span className="empty-icon danger"><Icon name="alert" size={26} /></span>
        <h3>Impossible de charger cette page</h3>
        <p>{message || "Une erreur est survenue."}</p>
        {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Réessayer</button>}
      </div>
    </div>
  );
}

/** Garde commune des pages commerçant : chargement, configuration, erreur. Rend les enfants quand tout est prêt. */
export function MerchantGate({ merchant, children, label }: { merchant: MerchantState; children: ReactNode; label?: string }) {
  if (merchant.status === "unconfigured") {
    return (
      <div className="ws-page"><div className="card empty">
        <span className="empty-icon"><Icon name="settings" size={26} /></span>
        <h3>Configuration requise</h3>
        <p>Ajoutez <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> dans Vercel, puis redéployez. Le guide MISE-EN-SERVICE.md décrit chaque étape.</p>
      </div></div>
    );
  }
  if (merchant.status === "loading") return <PageSkeleton label={label} />;
  if (merchant.status === "error") return <ErrorState message={merchant.error} onRetry={() => void merchant.reload()} />;
  return <>{children}</>;
}

export function PageHead({ kicker, title, subtitle, actions }: { kicker?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <span className="kicker">{kicker}</span>}
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "soft" | "ghost" }) {
  return <Link className={`btn btn-${variant}`} href={href}>{children}</Link>;
}
