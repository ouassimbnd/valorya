"use client";
import { useEffect, useState } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { Icon } from "./icons";

type Links = { url: string; appleUrl: string; googleUrl: string };

/**
 * Une seule carte Passcreator est créée par adhésion, à la demande du client.
 * Le même pass peut ensuite être ajouté à Apple Wallet ou Google Wallet.
 */
export function WalletButton({ membershipId }: { membershipId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"" | "apple" | "google" | "universal">("");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<Links | null>(null);
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    setIsApple(/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent));
    const controller = new AbortController();
    fetch("/api/wallet/passcreator", { signal: controller.signal })
      .then(r => r.ok ? r.json() : { configured: false })
      .then(data => { if (!controller.signal.aborted) setConfigured(Boolean(data.configured)); })
      .catch(() => { if (!controller.signal.aborted) setConfigured(false); });
    return () => controller.abort();
  }, []);

  const getLinks = async () => {
    if (links) return links;
    const { data: { session } } = await supabase().auth.getSession();
    if (!session) throw new Error("Reconnectez-vous pour ajouter votre carte.");
    const response = await fetch("/api/wallet/passcreator", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId }),
    });
    const data = await response.json().catch(() => ({})) as Partial<Links> & { error?: string };
    if (!response.ok || !data.url) throw new Error(data.error || "Carte Wallet indisponible.");
    const next = { url: data.url, appleUrl: data.appleUrl || data.url, googleUrl: data.googleUrl || data.url } as Links;
    setLinks(next);
    return next;
  };

  const open = async (kind: "apple" | "google" | "universal") => {
    if (busy) return;
    setBusy(kind); setMessage("");
    try {
      const pass = await getLinks();
      const target = kind === "apple" ? pass.appleUrl : kind === "google" ? pass.googleUrl : pass.url;
      location.assign(target);
    } catch (error) {
      setMessage(errorMessage(error));
      setBusy("");
    }
  };

  const checking = configured === null;
  return (
    <div className="wallet-add">
      <div className="wallet-add-head"><span className="wallet-badge"><Icon name="wallet" size={20} /></span><div><strong>Ma carte dans mon téléphone</strong><small>Une carte digitale personnelle, créée uniquement quand vous l’ajoutez.</small></div></div>
      <div className="wallet-buttons">
        {isApple ? (
          <button type="button" className="btn btn-dark" disabled={!configured || Boolean(busy)} onClick={() => void open("apple")}><Icon name="wallet" size={18} />{busy === "apple" ? "Préparation…" : "Ajouter à Apple Wallet"}</button>
        ) : (
          <button type="button" className="btn btn-dark" disabled={!configured || Boolean(busy)} onClick={() => void open("google")}><Icon name="wallet" size={18} />{busy === "google" ? "Préparation…" : "Ajouter à Google Wallet"}</button>
        )}
        <button type="button" className="btn btn-soft" disabled={!configured || Boolean(busy)} onClick={() => void open("universal")}><Icon name="share" size={18} />{busy === "universal" ? "Préparation…" : "Autres options Wallet"}</button>
      </div>
      <p className="hint">{checking ? "Vérification du service Wallet…" : configured ? "Le QR de la carte identifie uniquement votre adhésion. Les points restent sécurisés dans Valorya." : "Le service Wallet n’est pas encore activé. Votre carte Valorya reste disponible dans cet espace."}</p>
      {message && <p className="notice notice-error" role="status">{message}</p>}
    </div>
  );
}
