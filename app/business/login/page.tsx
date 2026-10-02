"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase, errorMessage, configured } from "@/lib/supabase";
import { Icon } from "@/components/icons";

export default function BusinessLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (new URLSearchParams(location.search).get("mode") === "signup") setMode("signup"); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const client = supabase();
      if (mode === "signup") {
        const { data, error: se } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/auth/callback?next=/business/abonnement` } });
        if (se) throw se;
        if (data.session) location.assign("/business/abonnement");
        else setMessage("Compte créé ! Ouvrez l’email de confirmation reçu : vous serez redirigé vers le choix de votre forfait.");
      } else {
        const { error: le } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (le) throw le;
        const next = new URLSearchParams(location.search).get("next") || "/business";
        location.assign(/^\/business(?:\/|\?|$)/.test(next) && !next.includes("\\") ? next : "/business");
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const switchMode = () => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); setError(""); };

  return (
    <div className="auth-split">
      <aside className="auth-side">
        <h2>Fidélisez vos clients dès aujourd’hui.</h2>
        <ul>
          <li><b>✓</b>Pour tous les commerces : coiffeurs, restaurants, parfumeries, boutiques, instituts…</li>
          <li><b>✓</b>Aucune application à installer : un QR code suffit à vos clients</li>
          <li><b>✓</b>Caisse simple, équipe suivie, carte ajoutable au Wallet du téléphone</li>
          <li><b>✓</b>15 jours gratuits, puis abonnement — carte bancaire requise</li>
        </ul>
        <div className="auth-plans">À partir de <b>19 € HT / mois</b> · Essentiel et Wallet</div>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <span className="kicker">ESPACE COMMERÇANT</span>
          <h1>{mode === "login" ? "Connexion" : "Créer mon compte commerçant"}</h1>
          <p>{mode === "login" ? "Accédez à votre tableau de bord et gérez votre fidélité." : "En 2 minutes : créez votre accès, choisissez votre métier et lancez votre première récompense."}</p>
          {!configured ? <p className="notice notice-error" role="alert">Configurez Supabase avant de créer un compte.</p> : (
            <form onSubmit={submit}>
              <label>Email professionnel<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" /></label>
              <label>Mot de passe
                <span className="pw-wrap"><input type={show ? "text" : "password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                  <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}><Icon name="eye" size={18} /></button></span>
                {mode === "signup" && <small className="hint">8 caractères minimum.</small>}
              </label>
              <button className="button dark" disabled={busy}>{busy ? "Un instant…" : mode === "login" ? "Se connecter à mon espace" : "Créer mon espace commerçant"}</button>
            </form>
          )}
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          {message && <p className="notice notice-ok" role="status">{message}</p>}
          <button className="text-switch" type="button" onClick={switchMode}>{mode === "login" ? "Nouveau commerçant ? Créer un compte" : "Déjà inscrit ? Se connecter"}</button>
          {mode === "login" && <Link className="text-switch" href="/business/forgot-password">Mot de passe oublié ?</Link>}
          <p><Link href="/privacy">Confidentialité et données personnelles</Link></p>
        </div>
      </div>
    </div>
  );
}
