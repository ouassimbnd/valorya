"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { configured, supabase, errorMessage } from "@/lib/supabase";
export default function ForgotPassword() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/business/reset-password` });
      if (error) throw error;
      setSent(true); setMessage("Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé.");
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); }
  };
  return <div className="container page narrow auth-card">
    <span className="kicker">ESPACE COMMERÇANT</span><h1>Mot de passe oublié.</h1>
    <p>Indiquez votre email professionnel : vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    {!configured ? <p role="alert">Configurez Supabase avant de réinitialiser un mot de passe.</p> : !sent ? <form onSubmit={submit}>
      <label>Email professionnel<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/></label>
      <button className="button dark" disabled={busy}>Envoyer le lien</button>
    </form> : null}
    {message && <p role="status">{message}</p>}
    <Link className="text-switch" href="/business/login">← Retour à la connexion</Link>
  </div>;
}
