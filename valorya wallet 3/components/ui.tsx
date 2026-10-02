"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { BrandLogo } from "./brand-logo";
export { BrandLogo } from "./brand-logo";

export function Arrow({ children }: { children: ReactNode }) {
  return <span className="arrow">{children} <span aria-hidden>↗</span></span>;
}


const NAV: [string, string][] = [
  ["/demo", "Parcours client"],
  ["/#secteurs", "Pour votre métier"],
  ["/#tarifs", "Tarifs"],
  ["/#faq", "Questions"],
];

export function Header() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="Valorya, accueil"><BrandLogo /> Valorya</Link>
        <nav aria-label="Navigation principale" className="site-nav">
          {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link className="header-login" href="/business/login">Connexion</Link>
          <Link className="nav-cta" href="/business/login?mode=signup">Créer mon espace <span aria-hidden>↗</span></Link>
          <button type="button" className="header-burger" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav className="header-drawer" aria-label="Menu mobile" onClick={() => setOpen(false)}>
          {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          <Link href="/business/login">Connexion commerçant</Link>
          <Link href="/customer/login">Retrouver ma carte client</Link>
          <Link className="drawer-cta" href="/business/login?mode=signup">Créer mon espace ↗</Link>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <span className="brand small"><BrandLogo /> Valorya</span>
          <span>La fidélité, simplement.</span>
        </div>
        <nav className="footer-links" aria-label="Informations légales">
          <Link href="/privacy">Confidentialité</Link>
          <Link href="/legal">Mentions légales</Link>
          <Link href="/terms">CGU et CGV</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/business/login">Espace commerçant</Link>
          <Link href="/customer/login">Espace client</Link>
        </nav>
        <p className="footer-copy">© 2026 Valorya. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
