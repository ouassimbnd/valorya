"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState } from "@/lib/use-merchant";
import { MerchantGate, PageHead, EmptyState, Skeleton } from "../states";
import { NoProgram } from "./no-program";
import { useFeedback } from "../feedback";
import { Icon } from "../icons";
import { safeColor, shade } from "@/lib/loyalty";

type Card = { id: string; token: string; status: string; created_at: string };
const STATUS: Record<string, { label: string; tone: string }> = {
  unassigned: { label: "À distribuer", tone: "badge-green" },
  active: { label: "Associée à un client", tone: "badge-blue" },
  lost: { label: "Déclarée perdue", tone: "badge-red" },
  replaced: { label: "Remplacée", tone: "badge-gray" },
};
const FILTERS: [string, string][] = [["all", "Toutes"], ["unassigned", "À distribuer"], ["active", "Associées"], ["lost", "Perdues"]];

function downloadSvg(id: string, name: string) {
  const svg = document.getElementById(id);
  if (!svg) return false;
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

function Body({ merchant }: { merchant: MerchantState }) {
  const { business, type, rewards } = merchant;
  const { toast } = useFeedback();
  const [origin, setOrigin] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(24);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("all");
  const bid = business?.id;

  const loadCards = useCallback(async () => {
    if (!bid) return;
    try {
      const { data, count, error } = await supabase().from("physical_cards").select("id,token,status,created_at", { count: "exact" }).eq("business_id", bid).order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      setCards((data || []) as Card[]); setTotal(count || 0);
    } catch (e) { toast(errorMessage(e), "error"); } finally { setLoading(false); }
  }, [bid, limit, toast]);
  useEffect(() => { setOrigin(location.origin); void loadCards(); }, [loadCards]);

  if (!business) return null;
  const accent = safeColor(business.accent_color, "#0FA3A0");
  const joinUrl = `${origin}/join/${business.slug}`;
  const firstReward = [...rewards.filter(r => r.active)].sort((a, b) => a.points_cost - b.points_cost)[0];
  const markPoster = () => localStorage.setItem(`fideli.poster.${business.id}`, "1");
  const copy = async (url: string) => { try { await navigator.clipboard.writeText(url); toast("Lien copié."); } catch { toast("Copiez le lien affiché à l’écran.", "info"); } };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: business.name, text: `Rejoignez le programme de fidélité de ${business.name}`, url: joinUrl });
      else await copy(joinUrl);
    } catch { /* partage annulé */ }
  };
  const create = async (count: number) => {
    if (creating) return;
    setCreating(true);
    try {
      for (let i = 0; i < count; i++) { const { error } = await supabase().rpc("issue_card", { p_business: business.id }); if (error) throw error; }
      toast(count > 1 ? `${count} cartes créées. Téléchargez leurs QR pour l’impression.` : "Carte créée. Téléchargez son QR pour l’imprimer.");
      await loadCards();
    } catch (e) { toast(errorMessage(e), "error"); await loadCards(); } finally { setCreating(false); }
  };
  const shown = cards.filter(c => filter === "all" || c.status === filter);
  const count = (s: string) => cards.filter(c => c.status === s).length;

  return (
    <div className="ws-page">
      <PageHead kicker="CARTES & INVITATIONS" title="Un seul QR pour inscrire tous vos clients." subtitle="Valorya génère ensuite automatiquement une carte digitale et un QR personnel pour chaque client. Vous n’avez aucune carte à créer manuellement." />
      <div className="grid grid-2">
        <section className="card poster-card">
          <span className="kicker">AFFICHE PRÊTE À IMPRIMER</span>
          <h2>QR unique de votre commerce</h2>
          <div className="poster-preview">
            <div className="poster-sheet" style={{ "--poster": accent, "--poster-dark": shade(accent, -0.45) } as CSSProperties}>
              <div className="poster-top"><span className="poster-emoji" aria-hidden="true">{business.logo_emoji || type.emoji}</span><strong>{business.name}</strong></div>
              <h3>Rejoignez notre programme de fidélité</h3>
              <p className="poster-pitch">{type.pitch}</p>
              <div className="poster-qr">{origin ? <QRCodeSVG id="join-qr" value={joinUrl} size={220} marginSize={2} /> : <Skeleton height={220} width={220} />}</div>
              <p className="poster-scan">Scannez avec l’appareil photo de votre téléphone</p>
              <ol className="poster-steps"><li><b>1</b> Scannez</li><li><b>2</b> Créez votre carte</li><li><b>3</b> Cumulez des points</li></ol>
              {firstReward && <p className="poster-reward">Dès {firstReward.points_cost} points : <b>{firstReward.name}</b></p>}
              <small className="poster-brand">Valorya · un seul QR pour rejoindre votre programme</small>
            </div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={!origin} onClick={() => { markPoster(); window.print(); }}><Icon name="print" size={18} /> Imprimer l’affiche</button>
            <button type="button" className="btn btn-ghost" disabled={!origin} onClick={() => { markPoster(); if (!downloadSvg("join-qr", `qr-${business.slug}.svg`)) toast("QR indisponible, réessayez.", "error"); }}><Icon name="download" size={18} /> QR en SVG</button>
          </div>
          <p className="hint"><b>À retenir :</b> ce QR reste le même pour tous vos clients. Vous pouvez l’imprimer sur une affiche, un sticker, votre menu ou l’encoder dans un support NFC.</p>
        </section>

        <section className="card">
          <span className="kicker">PARTAGER EN LIGNE</span>
          <h2>Votre lien d’inscription</h2>
          <p className="page-sub">Idéal pour Instagram, Google Maps, WhatsApp ou une signature d’email.</p>
          <div className="url-box" aria-label="Lien d’inscription">{joinUrl}</div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={!origin} onClick={() => void copy(joinUrl)}><Icon name="copy" size={18} /> Copier</button>
            <button type="button" className="btn btn-ghost" disabled={!origin} onClick={() => void share()}><Icon name="share" size={18} /> Partager</button>
            <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Rejoignez le programme de fidélité de ${business.name} : ${joinUrl}`)}`}>WhatsApp</a>
          </div>
          <div className="divider" />
          <h3 className="section-title">Ce qui se passe après le scan</h3>
          <p className="page-sub">Le client rejoint votre programme sur mobile. Valorya crée automatiquement son adhésion, sa carte digitale et son QR personnel. Aucun lot de cartes n’est à préparer.</p>
          <a className="btn btn-soft" target="_blank" rel="noopener noreferrer" href={`/join/${business.slug}`}><Icon name="eye" size={18} /> Voir ma page publique</a>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div><span className="kicker">OPTIONNEL</span><h2>Cartes physiques individuelles</h2></div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={creating} onClick={() => void create(1)}><Icon name="plus" size={18} /> {creating ? "Création…" : "Créer une carte"}</button>
            <span className="hint">Pas de création en masse nécessaire</span>
          </div>
        </div>
        <p className="page-sub">Vous n’en avez pas besoin pour le fonctionnement normal : les cartes digitales sont créées automatiquement. Cette section sert uniquement si vous décidez plus tard de vendre ou remettre une carte physique nominative à certains clients.</p>
        <div className="tabs" role="tablist" aria-label="Filtrer les cartes">
          {FILTERS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "is-on" : ""} onClick={() => setFilter(key)}>{label}{key !== "all" ? ` (${count(key)})` : ` (${total})`}</button>)}
        </div>
        {loading ? <div className="grid grid-3"><Skeleton height={200} /><Skeleton height={200} /><Skeleton height={200} /></div>
          : !cards.length ? <EmptyState icon="card" title="Aucune carte physique">Vous n’en avez pas besoin pour démarrer : l’affiche QR et le Wallet mobile suffisent. Créez-en quand vous voulez offrir une carte à vos clients.</EmptyState>
            : !shown.length ? <EmptyState icon="card" title="Aucune carte dans cette catégorie" />
              : (
                <div className="cards-grid">
                  {shown.map(card => {
                    const url = `${origin}/card/${card.token}`;
                    const st = STATUS[card.status] || { label: card.status, tone: "badge-gray" };
                    return (
                      <article className="physical" key={card.id}>
                        <span className={`badge ${st.tone}`}>{st.label}</span>
                        {origin && <QRCodeSVG id={`card-qr-${card.token}`} value={url} size={120} marginSize={2} />}
                        <small className="mono">{card.token.slice(0, 8)}…</small>
                        <div className="physical-actions">
                          <button type="button" className="text-link" onClick={() => void copy(url)}>Copier</button>
                          <button type="button" className="text-link" onClick={() => { if (!downloadSvg(`card-qr-${card.token}`, `valorya-carte-${card.token.slice(0, 8)}.svg`)) toast("QR indisponible.", "error"); }}>SVG</button>
                          <Link className="text-link" href={`/card/${card.token}`}>Ouvrir</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
        {total > cards.length && <div className="pager"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit(limit + 24)}>Afficher plus ({cards.length} sur {total})</button></div>}
      </section>
    </div>
  );
}

export default function Cards() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant}>{merchant.program ? <Body merchant={merchant} /> : <NoProgram merchant={merchant} />}</MerchantGate>;
}
