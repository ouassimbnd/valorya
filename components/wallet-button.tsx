"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon } from "./icons";
type Props = { membershipId?: string; accessToken?: string };
type Kind = "apple" | "google" | "universal";
export function WalletButton({ membershipId, accessToken }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<Kind | "">("");
  const [message, setMessage] = useState("");
  const [isApple, setIsApple] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setIsApple(/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent));
    const controller = new AbortController();
    fetch("/api/wallet/passcreator", { signal: controller.signal }).then(r => r.json()).then(data => {
      if (!controller.signal.aborted) setConfigured(Boolean(data.configured));
    }).catch(() => { if (!controller.signal.aborted) setConfigured(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setMessage(""); setBusy("");
    return () => { requestRef.current?.abort(); requestRef.current = null; };
  }, [membershipId, accessToken]);
  const open = async (kind: Kind) => {
    if (requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    setBusy(kind); setMessage("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, string>;
      if (accessToken) body = { accessToken };
      else {
        const { data: { session } } = await supabase().auth.getSession();
        if (!session || !membershipId) throw new Error("Reconnectez-vous pour retrouver votre carte.");
        headers.Authorization = `Bearer ${session.access_token}`; body = { membershipId };
      }
      if (controller.signal.aborted) return;
      // Never cache URLs across memberships. The server refreshes fields on every request.
      const response = await fetch("/api/wallet/passcreator", { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Votre carte est en préparation. Réessayez dans quelques instants.");
      const target = kind === "apple" ? data.appleUrl : kind === "google" ? data.googleUrl : data.url;
      const url = new URL(target || data.url);
      if (url.protocol !== "https:") throw new Error("Le lien Wallet est indisponible.");
      if (!controller.signal.aborted) location.assign(url.href);
    } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "Carte Wallet indisponible."); }
    finally { if (!controller.signal.aborted) { requestRef.current = null; setBusy(""); } }
  };
  return <div className="wallet-add">
    <div className="wallet-add-head"><span className="wallet-badge"><Icon name="wallet" size={20} /></span><div><strong>Votre fidélité, toujours avec vous</strong><small>Votre prénom, vos points et vos avantages sur votre carte personnelle.</small></div></div>
    <div className="wallet-buttons">
      <button type="button" className="btn btn-dark" disabled={!configured || Boolean(busy)} onClick={() => void open(isApple ? "apple" : "google")}><Icon name="wallet" size={18} />{busy && busy !== "universal" ? "Préparation de votre carte…" : isApple ? "Ajouter à Apple Wallet" : "Ajouter à Google Wallet"}</button>
      <button type="button" className="btn btn-soft" disabled={!configured || Boolean(busy)} onClick={() => void open("universal")}><Icon name="share" size={18} />{busy === "universal" ? "Préparation…" : "Autres options Wallet"}</button>
    </div>
    <p className="hint">{configured === null ? "Vérification du service Wallet…" : configured ? "Présentez votre QR en caisse. Après validation, vos points sont transmis au Wallet ; leur affichage peut prendre quelques instants." : "L’ajout au Wallet sera disponible après son activation. Votre carte reste accessible ici."}</p>
    {message && <p className="notice notice-error" role="status">{message}</p>}
  </div>;
}
