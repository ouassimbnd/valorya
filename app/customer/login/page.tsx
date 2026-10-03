"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { Icon } from "@/components/icons";

export default function CustomerLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const { error: e } = await supabase().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback?next=/customer`, shouldCreateUser: false } });
    if (e) throw e;
    setSent(email.trim());
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await send(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="pub-page">
      <section className="card">
        {sent ? (
          <div className="sent">
            <span className="empty-icon"><Icon name="check" size={26} /></span>
            <h2>Lien envoyé</h2>
            <p>Si un compte existe pour <b>{sent}</b>, vous allez recevoir un lien de connexion. Ouvrez-le depuis ce téléphone.</p>
            <div className="btn-row"><button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => { setBusy(true); try { await send(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }}>Renvoyer</button><button type="button" className="btn btn-ghost" onClick={() => setSent("")}>Changer d’adresse</button></div>
            {error && <p className="notice notice-error" role="alert">{error}</p>}
          </div>
        ) : (
          <>
            <span className="kicker">ESPACE CLIENT</span>
            <h1 className="h-lg">Retrouver ma carte.</h1>
            <p className="page-sub">Recevez un lien de connexion par email, sans mot de passe.</p>
            {!configured ? <p className="notice notice-error" role="alert">Service indisponible pour le moment.</p> : (
              <form className="form" onSubmit={submit}>
                <label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" /></label>
                <button className="btn btn-primary btn-xl" disabled={busy}>{busy ? "Envoi…" : "Recevoir mon lien"}</button>
              </form>
            )}
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <p className="hint">Pas encore de carte ? Scannez le QR code d’un commerce partenaire pour en créer une.</p>
            <p className="hint">Vous êtes commerçant ? <Link className="text-link" href="/business/login">Espace commerçant</Link></p>
          </>
        )}
      </section>
    </div>
  );
}
