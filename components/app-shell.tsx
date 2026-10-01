"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Header, Footer, BrandLogo } from "./ui";
import { Icon } from "./icons";
import { FeedbackProvider } from "./feedback";
import { configured, supabase } from "@/lib/supabase";
import { resolveType } from "@/lib/business-types";
import { safeColor } from "@/lib/loyalty";

const NAV: { label: string; items: [string, string, string][] }[] = [
  { label: "Pilotage", items: [["/business", "Vue d’ensemble", "overview"], ["/business/caisse", "Caisse", "cash"]] },
  { label: "Clientèle", items: [["/business/clients", "Clients", "users"], ["/business/programme", "Récompenses", "gift"]] },
  { label: "Diffusion", items: [["/business/cartes", "QR & cartes", "qr"], ["/business/wallet", "Wallet mobile", "wallet"]] },
  { label: "Gestion", items: [["/business/equipe", "Équipe", "team"], ["/business/profil", "Mon établissement", "store"]] },
];
const ALL = NAV.flatMap(group => group.items);
const AUTH_PATHS = ["/business/login", "/business/new", "/business/forgot-password", "/business/reset-password"];
const CLIENT_PUBLIC = ["/join", "/card", "/c", "/customer/login", "/auth/callback"];

type Identity = { name: string; emoji: string; color: string };

function isActive(path: string, href: string) {
  return href === "/business" ? path === href : path === href || path.startsWith(href + "/");
}

export const BUSINESS_UPDATED = "fideli:business-updated";

function MerchantShell({ path, children }: { path: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const load = async () => {
      try {
        const client = supabase();
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;
        const { data } = await client.from("businesses").select("name,category,logo_emoji,accent_color").eq("owner_id", user.id).maybeSingle();
        if (data && !cancelled) {
          const type = resolveType(data.category);
          setIdentity({ name: data.name, emoji: data.logo_emoji || type.emoji, color: safeColor(data.accent_color, "#109B81") });
        }
      } catch { /* l’identité du commerce est décorative : on ignore l’échec */ }
    };
    void load();
    window.addEventListener(BUSINESS_UPDATED, load);
    return () => { cancelled = true; window.removeEventListener(BUSINESS_UPDATED, load); };
  }, []);

  const logout = async () => {
    try {
      if (configured) { const { error: e } = await supabase().auth.signOut(); if (e) throw e; }
      location.assign("/business/login");
    } catch { setError("Déconnexion impossible. Réessayez."); }
  };
  const title = ALL.find(([href]) => isActive(path, href))?.[1] || "Mon espace";

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">Aller au contenu</a>
      <aside className={`app-sidebar ${open ? "is-open" : ""}`} aria-label="Navigation de l’espace commerçant">
        <Link className="brand" href="/business"><BrandLogo size={30} /><span>Valorya</span></Link>
        <div className="sidebar-business">
          <span className="sidebar-avatar" style={{ background: identity?.color || "#109B81" }} aria-hidden="true">{identity?.emoji || "•"}</span>
          <div><strong>{identity?.name || "Mon commerce"}</strong><small>Espace commerçant</small></div>
        </div>
        <nav>
          {NAV.map(group => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(([href, label, icon]) => (
                <Link key={href} href={href} className={isActive(path, href) ? "active" : ""} aria-current={isActive(path, href) ? "page" : undefined}>
                  <Icon name={icon} size={19} />{label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" onClick={logout}><Icon name="logout" size={18} /> Se déconnecter</button>
          {error && <p role="alert" className="form-error">{error}</p>}
          <Link href="/">Voir le site Valorya</Link>
        </div>
      </aside>
      {open && <button type="button" className="nav-backdrop" aria-label="Fermer le menu" onClick={() => setOpen(false)} />}
      <div className="workspace-body">
        <header className="app-topbar">
          <button type="button" className="menu-toggle" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="menu" /></button>
          <div className="topbar-title"><span>{identity?.name || "Mon commerce"}</span><i>/</i><strong>{title}</strong></div>
          {path !== "/business/caisse" && <Link className="btn btn-primary btn-sm topbar-cash" href="/business/caisse"><Icon name="cash" size={17} /> <span>Ouvrir la caisse</span></Link>}
        </header>
        <main id="main-content">{children}</main>
        <footer className="app-footer"><span>Valorya · La fidélité, simplement.</span><Link href="/privacy">Confidentialité</Link></footer>
      </div>
      <nav className="tabbar" aria-label="Accès rapide">
        <Link href="/business" className={path === "/business" ? "active" : ""}><Icon name="overview" size={22} /><span>Accueil</span></Link>
        <Link href="/business/clients" className={isActive(path, "/business/clients") ? "active" : ""}><Icon name="users" size={22} /><span>Clients</span></Link>
        <Link href="/business/caisse" className={`tab-main ${isActive(path, "/business/caisse") ? "active" : ""}`}><span className="tab-fab"><Icon name="cash" size={24} /></span><span>Caisse</span></Link>
        <Link href="/business/programme" className={isActive(path, "/business/programme") ? "active" : ""}><Icon name="gift" size={22} /><span>Offres</span></Link>
        <button type="button" onClick={() => setOpen(true)}><Icon name="more" size={22} /><span>Plus</span></button>
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const merchant = path.startsWith("/business") && !AUTH_PATHS.includes(path);
  const customer = path === "/customer";
  const clientPublic = CLIENT_PUBLIC.some(p => path === p || path.startsWith(p + "/"));

  let content: ReactNode;
  if (merchant) content = <MerchantShell path={path}>{children}</MerchantShell>;
  else if (customer) {
    content = (
      <div className="client-shell">
        <a className="skip-link" href="#main-content">Aller au contenu</a>
        <header className="client-top">
          <Link className="brand" href="/customer" aria-label="Valorya, ma carte"><BrandLogo size={28} /><span>Valorya</span></Link>
          <span className="client-top-label">Mon espace fidélité</span>
          <Link href="/privacy">Confidentialité</Link>
        </header>
        <main id="main-content">{children}</main>
      </div>
    );
  } else if (clientPublic) {
    content = (
      <div className="pub-shell">
        <a className="skip-link" href="#main-content">Aller au contenu</a>
        <header className="pub-top">
          <Link className="brand" href="/" aria-label="Valorya"><BrandLogo size={28} /><span>Valorya</span></Link>
          <Link className="pub-top-link" href="/customer/login">J’ai déjà une carte</Link>
        </header>
        <main id="main-content">{children}</main>
        <footer className="pub-footer"><span>Propulsé par Valorya</span><Link href="/privacy">Confidentialité</Link><Link href="/terms">Conditions</Link></footer>
      </div>
    );
  } else content = <><Header /><main id="main-content">{children}</main><Footer /></>;

  return <FeedbackProvider>{content}</FeedbackProvider>;
}
