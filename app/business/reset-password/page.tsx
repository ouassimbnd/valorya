"use client";
import { useEffect, useState, type FormEvent } from "react";
import { configured, supabase, errorMessage } from "@/lib/supabase";
export default function ResetPassword() {
  const [ready, setReady] = useState(false); const [password, setPassword] = useState(""); const [confirmPwd, setConfirmPwd] = useState("");
  const [message, setMessage] = useState("Vérification du lien…"); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => {
    if (!configured) return;
    const client = supabase();
    const { data: sub } = client.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") { setReady(true); setMessage(""); } });
    void client.auth.getSession().then(({ data }) => { if (data.session) { setReady(true); setMessage(""); } else setMessage("Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion."); });
    return () => sub.subscription.unsubscribe();
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMessage("");
    if (password.length < 8) { setMessage("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (password !== confirmPwd) { setMessage("Les deux mots de passe ne correspondent pas."); return; }
    setBusy(true);
    try { const { error } = await supabase().auth.updateUser({ password }); if (error) throw error; setDone(true); setMessage("Mot de passe mis à jour. Vous pouvez accéder à votre tableau de bord."); }
    catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); }
  };
  return <div className="container page narrow auth-card">
    <span className="kicker">ESPACE COMMERÇANT</span><h1>Nouveau mot de passe.</h1>
    {ready && !done && <form onSubmit={submit}>
      <label>Nouveau mot de passe<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/></label>
      <label>Confirmer le mot de passe<input type="password" required minLength={8} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} autoComplete="new-password"/></label>
      <button className="button dark" disabled={busy}>Mettre à jour mon mot de passe</button>
    </form>}
    {message && <p role={done ? "status" : "alert"}>{message}</p>}
    {done && <a className="button outline" href="/business">Accéder au tableau de bord →</a>}
  </div>;
}
