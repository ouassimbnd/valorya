"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState } from "@/lib/use-merchant";
import { MerchantGate, PageHead, EmptyState, Skeleton } from "../states";
import { useFeedback } from "../feedback";
import { Icon } from "../icons";
import { initials, percent } from "@/lib/loyalty";

type Stat = { id: string; name: string; active: boolean; total: number; last7: number; last30: number };

function Body({ merchant }: { merchant: MerchantState }) {
  const { business, type } = merchant;
  const { toast, confirm } = useFeedback();
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const bid = business?.id;

  const load = useCallback(async () => {
    if (!bid) return;
    try {
      const r = await supabase().rpc("cashier_stats", { p_business: bid });
      if (r.error) throw r.error;
      setStats((r.data || []) as Stat[]);
    } catch (e) { toast(errorMessage(e), "error"); setStats([]); }
  }, [bid, toast]);
  useEffect(() => { void load(); }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !bid) return;
    setBusy(true);
    try {
      const { error } = await supabase().rpc("add_cashier", { p_business: bid, p_name: name.trim() });
      if (error) throw error;
      toast(`${name.trim()} ajouté·e à l’équipe.`);
      setName(""); await load(); await merchant.reload();
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const toggle = async (s: Stat) => {
    if (busy) return;
    if (s.active) {
      const ok = await confirm({ title: `Désactiver ${s.name} ?`, body: "Cette personne ne pourra plus être choisie en caisse. Son historique reste conservé et vous pourrez la réactiver.", confirmLabel: "Désactiver", tone: "danger" });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { error } = await supabase().rpc("set_cashier_active", { p_cashier: s.id, p_active: !s.active });
      if (error) throw error;
      toast(s.active ? "Profil désactivé." : "Profil réactivé.");
      await load(); await merchant.reload();
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };

  const list = stats || [];
  const max = Math.max(1, ...list.map(s => s.total));
  const total = list.reduce((a, s) => a + s.total, 0);
  const many = type.visit.many;

  return (
    <div className="ws-page">
      <PageHead kicker="GESTION" title={type.team.title + "."} subtitle={`Ajoutez ${type.team.many} et suivez qui valide les ${many} au quotidien.`}
        actions={<Link className="btn btn-ghost" href="/business/caisse">Ouvrir la caisse</Link>} />
      <div className="grid grid-3">
        <div className="kpi"><span>PROFILS ACTIFS</span><strong>{list.filter(s => s.active).length}</strong><small>Sélectionnables en caisse</small></div>
        <div className="kpi"><span>{many.toUpperCase()} ATTRIBUÉS</span><strong>{total.toLocaleString("fr-FR")}</strong><small>Validés avec un profil</small></div>
        <div className="kpi"><span>SUR 7 JOURS</span><strong>{list.reduce((a, s) => a + s.last7, 0)}</strong><small>Toute l’équipe</small></div>
      </div>

      <div className="grid grid-main">
        <section className="card" aria-labelledby="ranking-title">
          <div className="card-head"><div><span className="kicker">RÉSULTATS</span><h2 id="ranking-title">Classement de l’équipe</h2></div></div>
          {stats === null ? <div className="skeleton-stack"><Skeleton height={60} /><Skeleton height={60} /></div>
            : !list.length ? <EmptyState icon="team" title="Aucun profil pour l’instant">Ajoutez le premier : en caisse, il suffira de le sélectionner avant de valider un {type.visit.one}.</EmptyState>
              : (
                <ul className="team-list">
                  {list.map((s, i) => (
                    <li key={s.id} className={s.active ? "" : "is-off"}>
                      <span className="rank">{i + 1}</span>
                      <span className="avatar">{initials(s.name)}</span>
                      <div className="team-main">
                        <strong>{s.name}{!s.active && <em> · désactivé</em>}</strong>
                        <small>{s.total} au total · {s.last30} sur 30 jours · {s.last7} sur 7 jours</small>
                        <div className="progress progress-sm" aria-hidden="true"><i style={{ width: `${percent(s.total, max)}%` }} /></div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void toggle(s)}>{s.active ? "Désactiver" : "Réactiver"}</button>
                    </li>
                  ))}
                </ul>
              )}
        </section>
        <div className="stack">
          <section className="card">
            <span className="kicker">AJOUTER</span>
            <h2>Nouveau profil</h2>
            <form className="form" onSubmit={add}>
              <label className="field"><span>Prénom</span><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={type.team.placeholder} minLength={2} maxLength={60} required /></label>
              <button className="btn btn-primary" disabled={busy}><Icon name="plus" size={18} /> Ajouter</button>
            </form>
          </section>
          <section className="card note-card">
            <span className="kicker">BON À SAVOIR</span>
            <h3 className="section-title">Comment ça marche</h3>
            <ul className="bullets">
              <li>En caisse, choisissez qui valide : ce choix est mémorisé sur l’appareil.</li>
              <li>Chaque validation est comptée dans les résultats de la personne.</li>
              <li>Ces profils servent au suivi : ce ne sont pas des comptes de connexion. La caisse reste ouverte avec votre compte.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant}><Body merchant={merchant} /></MerchantGate>;
}
