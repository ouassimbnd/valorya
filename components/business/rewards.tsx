"use client";
import { useState, type FormEvent } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState, type Reward } from "@/lib/use-merchant";
import { MerchantGate, PageHead, EmptyState } from "../states";
import { NoProgram } from "./no-program";
import { useFeedback } from "../feedback";
import { Icon } from "../icons";
import { POINTS_PER_FEEDBACK, POINTS_PER_VISIT, normalizeText, visitsFor } from "@/lib/loyalty";

function Body({ merchant }: { merchant: MerchantState }) {
  const { program, type, rewards } = merchant;
  const { toast, confirm } = useFeedback();
  const [name, setName] = useState("");
  const [points, setPoints] = useState(80);
  const [busy, setBusy] = useState(false);
  const active = rewards.filter(r => r.active);
  const known = new Set(rewards.map(r => normalizeText(r.name)));
  const suggestions = type.rewards.filter(r => !known.has(normalizeText(r.name)));

  const add = async (rewardName: string, cost: number, done: () => void) => {
    if (busy || !program) return;
    setBusy(true);
    try {
      const { error } = await supabase().rpc("add_reward", { p_program: program.id, p_name: rewardName, p_points: cost });
      if (error) throw error;
      toast(`« ${rewardName} » ajoutée au catalogue.`);
      done();
      await merchant.reload();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void add(name.trim(), points, () => { setName(""); setPoints(80); }); };

  const toggle = async (r: Reward) => {
    if (busy) return;
    if (r.active) {
      const ok = await confirm({ title: `Retirer « ${r.name} » ?`, body: "Vos clients ne pourront plus l’obtenir. Les récompenses déjà remises restent dans l’historique. Vous pourrez la réactiver.", confirmLabel: "Retirer du catalogue", tone: "danger" });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { error } = await supabase().rpc("set_reward_active", { p_reward: r.id, p_active: !r.active });
      if (error) throw error;
      toast(r.active ? "Récompense retirée du catalogue." : "Récompense réactivée.");
      await merchant.reload();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };

  const cost = Math.max(0, Number.isFinite(points) ? points : 0);
  return (
    <div className="ws-page">
      <PageHead kicker="CLIENTÈLE" title="Vos récompenses." subtitle={`Chaque ${type.visit.one} rapporte ${POINTS_PER_VISIT} points, chaque avis privé ${POINTS_PER_FEEDBACK}. Choisissez ce que vos clients peuvent obtenir.`} />

      {suggestions.length > 0 && (
        <section className="card">
          <span className="kicker">IDÉES POUR VOTRE MÉTIER · {type.short.toUpperCase()}</span>
          <h2>Ajout en un clic</h2>
          <div className="suggest-grid">
            {suggestions.map(s => (
              <button type="button" key={s.name} className="suggest" disabled={busy} onClick={() => void add(s.name, s.points, () => {})}>
                <span className="suggest-plus"><Icon name="plus" size={18} /></span>
                <strong>{s.name}</strong>
                <small>{s.points} pts · environ {visitsFor(s.points)} {visitsFor(s.points) > 1 ? type.visit.many : type.visit.one}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-main">
        <section className="card" aria-labelledby="catalog-title">
          <div className="card-head"><div><span className="kicker">CATALOGUE</span><h2 id="catalog-title">{active.length} récompense{active.length > 1 ? "s" : ""} active{active.length > 1 ? "s" : ""}</h2></div></div>
          {!rewards.length ? <EmptyState icon="gift" title="Aucune récompense">Ajoutez-en une pour que vos clients aient un objectif.</EmptyState> : (
            <ul className="reward-catalog">
              {rewards.map(r => (
                <li key={r.id} className={r.active ? "" : "is-off"}>
                  <span className="reward-icon"><Icon name="gift" size={20} /></span>
                  <div><strong>{r.name}</strong><small>{r.points_cost} points · environ {visitsFor(r.points_cost)} {visitsFor(r.points_cost) > 1 ? type.visit.many : type.visit.one}</small></div>
                  <span className={`badge ${r.active ? "badge-green" : "badge-gray"}`}>{r.active ? "Active" : "Désactivée"}</span>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void toggle(r)}>{r.active ? "Retirer" : "Réactiver"}</button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">Pour modifier une récompense, retirez-la et créez-en une nouvelle : les points déjà dépensés par vos clients ne changent jamais.</p>
        </section>

        <section className="card" aria-labelledby="new-title">
          <span className="kicker">PERSONNALISER</span>
          <h2 id="new-title">Nouvelle récompense</h2>
          <form className="form" onSubmit={submit}>
            <label className="field"><span>Nom visible par le client</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={`Ex. ${type.rewards[0].name}`} minLength={2} maxLength={100} required /></label>
            <label className="field"><span>Coût en points</span>
              <input className="input" type="number" inputMode="numeric" min={10} max={100000} step={5} value={points} onChange={e => setPoints(Number(e.target.value))} required />
              <small>{cost >= POINTS_PER_VISIT ? `Soit environ ${visitsFor(cost)} ${visitsFor(cost) > 1 ? type.visit.many : type.visit.one} pour l’obtenir.` : "Minimum : 10 points."}</small></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Ajout…" : "Ajouter au catalogue"}</button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function Rewards() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant}>{merchant.program ? <Body merchant={merchant} /> : <NoProgram merchant={merchant} />}</MerchantGate>;
}
