"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState } from "@/lib/use-merchant";
import { MerchantGate, PageHead, EmptyState, Skeleton } from "../states";
import { NoProgram } from "./no-program";
import { useFeedback } from "../feedback";
import { Icon } from "../icons";
import { csvCell, formatDate, initials, nextReward, percent } from "@/lib/loyalty";

type Member = { id: string; name: string; visits: number; redeemed: number; points: number };
type Overview = { clients: number; visits: number; redemptions: number; members: Member[] };
type HistoryItem = { kind: string; created_at: string; detail: string | null };
const PAGE = 25;

function Body({ merchant }: { merchant: MerchantState }) {
  const { business, type, rewards } = merchant;
  const { toast } = useFeedback();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const bid = business?.id;
  const active = rewards.filter(r => r.active);
  const minReward = active.length ? Math.min(...active.map(r => r.points_cost)) : Infinity;

  useEffect(() => { const t = window.setTimeout(() => { setSearch(query); setOffset(0); }, 250); return () => window.clearTimeout(t); }, [query]);
  useEffect(() => {
    if (!bid) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await supabase().rpc("business_overview", { p_business: bid, p_offset: offset, p_search: search || null });
        if (r.error) throw r.error;
        if (!cancelled) setData(r.data as Overview);
      } catch (e) { if (!cancelled) toast(errorMessage(e), "error"); } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bid, offset, search, toast]);

  const toggleHistory = async (id: string) => {
    if (open === id) { setOpen(""); return; }
    setOpen(id); setHistory([]); setHistoryLoading(true);
    try {
      const r = await supabase().rpc("member_history", { p_membership: id });
      if (r.error) throw r.error;
      setHistory((r.data || []) as HistoryItem[]);
    } catch (e) { toast(errorMessage(e), "error"); } finally { setHistoryLoading(false); }
  };

  const exportCsv = async () => {
    if (!bid || exporting) return;
    setExporting(true);
    try {
      const rows: Member[] = [];
      for (let o = 0; o < 20000; o += PAGE) {
        const r = await supabase().rpc("business_overview", { p_business: bid, p_offset: o, p_search: null });
        if (r.error) throw r.error;
        const batch = ((r.data as Overview).members || []);
        rows.push(...batch);
        if (batch.length < PAGE) break;
      }
      const header = ["Prénom", type.visit.many.charAt(0).toUpperCase() + type.visit.many.slice(1), "Points", "Récompenses utilisées"];
      const csv = [header, ...rows.map(m => [m.name, m.visits, m.points, m.redeemed])].map(r => r.map(csvCell).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `clients-${business?.slug || "valorya"}.csv`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast(`${rows.length} client${rows.length > 1 ? "s" : ""} exporté${rows.length > 1 ? "s" : ""}.`);
    } catch (e) { toast(errorMessage(e), "error"); } finally { setExporting(false); }
  };

  const members = data?.members || [];
  const total = data?.clients || 0;
  const ready = members.filter(m => m.points >= minReward).length;

  return (
    <div className="ws-page">
      <PageHead kicker="CLIENTÈLE" title="Vos clients fidèles." subtitle="Retrouvez les points, les visites et l’historique de chaque client."
        actions={<><button type="button" className="btn btn-ghost" onClick={() => void exportCsv()} disabled={exporting || !total}><Icon name="download" size={18} /> {exporting ? "Export…" : "Exporter (CSV)"}</button><Link className="btn btn-primary" href="/business/caisse"><Icon name="cash" size={18} /> Ouvrir la caisse</Link></>} />
      <div className="grid grid-3">
        <div className="kpi"><span>CLIENTS INSCRITS</span><strong>{total.toLocaleString("fr-FR")}</strong><small>Dans votre programme</small></div>
        <div className="kpi"><span>{type.visit.many.toUpperCase()} VALIDÉS</span><strong>{(data?.visits || 0).toLocaleString("fr-FR")}</strong><small>Depuis le lancement</small></div>
        <div className="kpi"><span>RÉCOMPENSES PRÊTES</span><strong>{ready}</strong><small>Sur cette page de résultats</small></div>
      </div>
      <section className="card">
        <div className="card-head"><div><span className="kicker">LISTE</span><h2>Clients du programme</h2></div>
          <label className="search-field search-inline"><Icon name="search" size={18} /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher par prénom…" aria-label="Rechercher un client" /></label></div>
        {loading && !data ? <div className="skeleton-stack"><Skeleton height={62} /><Skeleton height={62} /><Skeleton height={62} /></div>
          : !members.length ? (
            search ? <EmptyState icon="search" title="Aucun client ne correspond">Essayez un autre prénom.</EmptyState>
              : <EmptyState icon="users" title="Votre premier client arrive bientôt" action={<Link className="btn btn-primary" href="/business/cartes">Afficher mon QR d’inscription</Link>}>Imprimez l’affiche ou partagez le lien : chaque client crée sa carte en 30 secondes.</EmptyState>
          ) : (
            <ul className="client-list" aria-busy={loading}>
              {members.map(m => {
                const goal = nextReward(active, m.points);
                return (
                  <li key={m.id}>
                    <div className="client-row">
                      <span className="avatar">{initials(m.name)}</span>
                      <div className="client-main">
                        <strong>{m.name}</strong>
                        <small>{m.visits} {m.visits > 1 ? type.visit.many : type.visit.one} · {m.redeemed} récompense{m.redeemed > 1 ? "s" : ""} utilisée{m.redeemed > 1 ? "s" : ""}</small>
                        {goal.reward && <div className="progress progress-sm" aria-hidden="true"><i style={{ width: `${percent(m.points, goal.reward.points_cost)}%` }} /></div>}
                      </div>
                      {m.points >= minReward && <span className="badge badge-amber">Récompense prête</span>}
                      <span className="client-points"><strong>{m.points}</strong><small>pts</small></span>
                      <div className="client-actions">
                        <Link className="btn btn-soft btn-sm" href={`/business/caisse?membership=${m.id}`}>En caisse</Link>
                        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open === m.id} onClick={() => void toggleHistory(m.id)}>{open === m.id ? "Masquer" : "Historique"}</button>
                      </div>
                    </div>
                    {open === m.id && (
                      <div className="history-box">
                        {historyLoading ? <Skeleton height={20} /> : !history.length ? <p className="hint">Aucune opération enregistrée.</p> : (
                          <ul className="mini-history">{history.map((h, i) => <li key={i}><span className={`dot dot-${h.kind}`} aria-hidden="true" /><span>{h.kind === "visite" ? type.visit.done : h.kind === "recompense" ? "Récompense" : "Avis privé"}{h.detail ? ` · ${h.detail}` : ""}</span><time dateTime={h.created_at}>{formatDate(h.created_at, true)}</time></li>)}</ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        {total > PAGE && (
          <div className="pager">
            <button type="button" className="btn btn-ghost btn-sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE))}>← Précédents</button>
            <span>{members.length ? `${offset + 1}–${offset + members.length}` : "Aucun résultat"}{!search && ` sur ${total}`}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={members.length < PAGE || loading || (!search && offset + PAGE >= total)} onClick={() => setOffset(offset + PAGE)}>Suivants →</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function Clients() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant}>{merchant.program ? <Body merchant={merchant} /> : <NoProgram merchant={merchant} />}</MerchantGate>;
}
