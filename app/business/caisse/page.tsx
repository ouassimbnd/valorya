"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState } from "@/lib/use-merchant";
import { MerchantGate, PageHead, EmptyState, PageSkeleton } from "@/components/states";
import { NoProgram } from "@/components/business/no-program";
import { QrScanner } from "@/components/qr-scanner";
import { useFeedback } from "@/components/feedback";
import { Icon } from "@/components/icons";
import { POINTS_PER_VISIT, VISIT_COOLDOWN_MINUTES, computePoints, initials, nextReward, percent, relativeTime } from "@/lib/loyalty";

type Member = { id: string; name: string; points: number; visits: number };
type HistoryItem = { kind: string; created_at: string; detail: string | null };
type Flash = { title: string; body?: string };
type Log = { id: number; kind: "visit" | "reward"; memberId: string; name: string; text: string; at: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Target = { kind: "text"; text: string } | { kind: "membership"; id: string } | { kind: "digital"; token: string } | { kind: "card"; token: string } | { kind: "uuid"; id: string };

/** Comprend ce que le commerçant a saisi ou scanné : nom, lien de carte Wallet, lien de carte physique ou identifiant. */
function parseTarget(raw: string): Target {
  const value = raw.trim();
  try {
    const url = new URL(value);
    const digital = url.searchParams.get("card");
    if (digital && UUID.test(digital)) return { kind: "digital", token: digital };
    const membership = url.searchParams.get("membership");
    if (membership && UUID.test(membership)) return { kind: "membership", id: membership };
    const card = url.pathname.match(/\/card\/([0-9a-f-]{36})/i);
    if (card && UUID.test(card[1])) return { kind: "card", token: card[1] };
  } catch { /* ce n’est pas une URL */ }
  const digital = value.match(/^card:([0-9a-f-]{36})$/i);
  if (digital && UUID.test(digital[1])) return { kind: "digital", token: digital[1] };
  if (UUID.test(value)) return { kind: "uuid", id: value };
  return { kind: "text", text: value };
}

async function readMemberByToken(token: string, programId: string): Promise<Member | null> {
  const c = supabase();
  const { data, error } = await c.from("memberships").select("id").eq("card_token", token).eq("program_id", programId).maybeSingle();
  if (error) throw error;
  return data?.id ? readMember(data.id, programId) : null;
}

async function readMember(id: string, programId: string): Promise<Member | null> {
  const c = supabase();
  const { data: m, error } = await c.from("memberships").select("id,customer:customers(display_name)").eq("id", id).eq("program_id", programId).maybeSingle();
  if (error) throw error;
  if (!m) return null;
  const [v, f] = await Promise.all([
    c.from("visits").select("id", { count: "exact", head: true }).eq("membership_id", id),
    c.from("private_feedback").select("id", { count: "exact", head: true }).eq("membership_id", id),
  ]);
  if (v.error || f.error) throw v.error || f.error;
  let spent = 0;
  for (let offset = 0; ; offset += 1000) {
    const r = await c.from("redemptions").select("id,points_spent").eq("membership_id", id).order("id").range(offset, offset + 999);
    if (r.error) throw r.error;
    const rows = (r.data || []) as { points_spent: number | null }[];
    spent += rows.reduce((sum, row) => sum + (row.points_spent || 0), 0);
    if (rows.length < 1000) break;
  }
  const customer = m.customer as unknown as { display_name: string } | null;
  return { id: m.id, name: customer?.display_name || "Client", visits: v.count || 0, points: computePoints(v.count || 0, f.count || 0, spent) };
}

function Register({ merchant }: { merchant: MerchantState }) {
  const { business, program, type, rewards, cashiers } = merchant;
  const params = useSearchParams();
  const requested = params.get("card") ? `card:${params.get("card")}` : (params.get("membership") || "");
  const { toast, confirm } = useFeedback();
  const [query, setQuery] = useState(requested);
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<Log[]>([]);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const selection = useRef(0);
  const detail = useRef<HTMLElement>(null);
  const bid = business?.id;
  const pid = program?.id;
  const activeRewards = rewards.filter(r => r.active);
  const activeCashiers = cashiers.filter(c => c.active);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 20000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    if (!bid) return;
    const saved = localStorage.getItem(`fideli.cashier.${bid}`) || "";
    setCounter(cashiers.some(c => c.id === saved && c.active) ? saved : "");
  }, [bid, cashiers]);
  const pickCounter = (id: string) => { setCounter(id); if (bid) localStorage.setItem(`fideli.cashier.${bid}`, id); };

  const choose = useCallback(async (m: Member) => {
    if (!pid) return;
    const current = ++selection.current;
    setFlash(null); setMember(m); setHistory([]);
    window.setTimeout(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    try {
      const [fresh, hist] = await Promise.all([readMember(m.id, pid), supabase().rpc("member_history", { p_membership: m.id })]);
      if (current !== selection.current) return;
      if (fresh) setMember(fresh);
      setHistory(((hist.data || []) as HistoryItem[]).slice(0, 5));
    } catch (e) { if (current === selection.current) toast(errorMessage(e), "error"); }
  }, [pid, toast]);

  useEffect(() => {
    if (!bid || !pid) return;
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const client = supabase();
          const target = parseTarget(query);
          if (target.kind === "text") {
            const r = await client.rpc("business_overview", { p_business: bid, p_offset: 0, p_search: target.text || null });
            if (r.error) throw r.error;
            if (!cancelled) setResults(((r.data as { members?: Member[] })?.members) || []);
            return;
          }
          let found: Member | null = null;
          if (target.kind === "digital") found = await readMemberByToken(target.token, pid);
          if (target.kind === "membership" || target.kind === "uuid") found = await readMember(target.id, pid);
          if (!found && (target.kind === "card" || target.kind === "uuid")) {
            const token = target.kind === "card" ? target.token : target.id;
            const { data: card, error } = await client.from("physical_cards").select("membership_id").eq("token", token).eq("business_id", bid).maybeSingle();
            if (error) throw error;
            if (card?.membership_id) found = await readMember(card.membership_id, pid);
            else if (card && !cancelled) toast("Cette carte physique n’est associée à aucun client pour l’instant.", "info");
          }
          if (cancelled) return;
          setResults(found ? [found] : []);
          if (found) void choose(found);
        } catch (e) { if (!cancelled) { setResults([]); toast(errorMessage(e), "error"); } }
        finally { if (!cancelled) setSearching(false); }
      })();
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, bid, pid, choose, toast]);

  const refresh = async (m: Member) => {
    if (!pid) return m;
    const [fresh, hist] = await Promise.all([readMember(m.id, pid), supabase().rpc("member_history", { p_membership: m.id })]);
    if (fresh) { setMember(fresh); setResults(items => items.map(i => (i.id === fresh.id ? fresh : i))); }
    setHistory(((hist.data || []) as HistoryItem[]).slice(0, 5));
    return fresh || m;
  };
  const counterName = cashiers.find(c => c.id === counter)?.name;
  const addLog = (m: Member, kind: Log["kind"], text: string) => setLog(items => [{ id: Date.now(), kind, memberId: m.id, name: m.name, text, at: Date.now() }, ...items].slice(0, 6));

  const validateVisit = async () => {
    if (!member || lock.current) return;
    lock.current = true; setBusy(true);
    const before = member.points;
    try {
      const r = await supabase().rpc("record_visit", { p_membership: member.id, p_cashier: counter || null });
      if (r.error) throw r.error;
      const fresh = await refresh(member);
      const unlocked = activeRewards.filter(rw => before < rw.points_cost && fresh.points >= rw.points_cost);
      setFlash({
        title: `${type.visit.done} · +${POINTS_PER_VISIT} points`,
        body: `${fresh.name} passe de ${before} à ${fresh.points} points.${unlocked.length ? ` Récompense débloquée : ${unlocked.map(u => u.name).join(", ")}.` : ""}`,
      });
      addLog(fresh, "visit", `${type.visit.done} · +${POINTS_PER_VISIT} pts${counterName ? " · " + counterName : ""}`);
      navigator.vibrate?.(30);
    } catch (e) { toast(errorMessage(e), "error"); } finally { lock.current = false; setBusy(false); }
  };

  const giveReward = async (rewardId: string) => {
    const reward = activeRewards.find(r => r.id === rewardId);
    if (!member || !reward || lock.current) return;
    const ok = await confirm({ title: `Remettre « ${reward.name} » ?`, body: `${member.name} utilise ${reward.points_cost} points (solde actuel : ${member.points}).`, confirmLabel: "Remettre la récompense" });
    if (!ok) return;
    lock.current = true; setBusy(true);
    try {
      const r = await supabase().rpc("redeem_reward", { p_membership: member.id, p_reward: reward.id });
      if (r.error) throw r.error;
      const fresh = await refresh(member);
      setFlash({ title: "Récompense remise", body: `${reward.name} · ${fresh.name} a maintenant ${fresh.points} points.` });
      addLog(fresh, "reward", `Récompense : ${reward.name} (−${reward.points_cost} pts)`);
    } catch (e) { toast(errorMessage(e), "error"); } finally { lock.current = false; setBusy(false); }
  };

  const lastValidation = member ? log.find(l => l.memberId === member.id && l.kind === "visit" && now - l.at < VISIT_COOLDOWN_MINUTES * 60000) : undefined;
  const cooldown = lastValidation ? Math.max(1, Math.ceil((VISIT_COOLDOWN_MINUTES * 60000 - (now - lastValidation.at)) / 60000)) : 0;
  const progress = member ? nextReward(activeRewards, member.points) : null;
  const minReward = activeRewards.length ? Math.min(...activeRewards.map(r => r.points_cost)) : Infinity;

  if (!business || !program) return null;
  return (
    <div className="ws-page">
      <PageHead kicker="AU COMPTOIR" title="Un client. Une attention." subtitle={`Retrouvez sa carte, validez ${type.visit.article} ${type.visit.one} ou remettez une récompense.`}
        actions={<Link className="btn btn-ghost" href="/business/equipe">Gérer l’équipe</Link>} />

      <div className="counter-bar" role="group" aria-label="Qui valide les passages ?">
        <span>Validé par</span>
        <button type="button" className={`chip ${counter === "" ? "is-on" : ""}`} aria-pressed={counter === ""} onClick={() => pickCounter("")}>Propriétaire</button>
        {activeCashiers.map(c => <button type="button" key={c.id} className={`chip ${counter === c.id ? "is-on" : ""}`} aria-pressed={counter === c.id} onClick={() => pickCounter(c.id)}>{c.name}</button>)}
        {!activeCashiers.length && <Link className="text-link" href="/business/equipe">+ Ajouter {type.team.one}</Link>}
      </div>

      <div className="register">
        <section className="card" aria-labelledby="find-title">
          <span className="kicker">1 · RETROUVER UN CLIENT</span>
          <h2 id="find-title">Qui vient de passer ?</h2>
          <div className="search-row">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Prénom, ou lien / QR de la carte" aria-label="Rechercher un client" autoComplete="off" inputMode="search" />
            </label>
            <button type="button" className="btn btn-soft" onClick={() => setScanning(true)}><Icon name="scan" size={18} /> Scanner</button>
          </div>
          <p className="hint">Le QR de la carte Wallet ou de la carte physique ouvre directement la fiche du client.</p>
          {searching ? <div className="skeleton-stack" role="status" aria-label="Recherche en cours"><span className="skeleton" style={{ height: 58 }} /><span className="skeleton" style={{ height: 58 }} /></div>
            : !results.length ? (
              query.trim() ? <EmptyState icon="search" title="Aucun résultat">Vérifiez l’orthographe, ou scannez sa carte.</EmptyState>
                : <EmptyState icon="users" title="Aucun client inscrit" action={<Link className="btn btn-primary" href="/business/cartes">Afficher le QR d’inscription</Link>}>Vos clients rejoignent le programme en scannant votre QR code.</EmptyState>
            ) : (
              <>
                {!query.trim() && <p className="list-caption">Derniers inscrits</p>}
                <ul className="pick-list">
                  {results.map(m => (
                    <li key={m.id}>
                      <button type="button" className={member?.id === m.id ? "is-selected" : ""} disabled={busy} onClick={() => void choose(m)}>
                        <span className="avatar">{initials(m.name)}</span>
                        <span className="pick-main"><strong>{m.name}</strong><small>{m.visits} {m.visits > 1 ? type.visit.many : type.visit.one}</small></span>
                        {m.points >= minReward && <span className="badge badge-amber">Récompense prête</span>}
                        <span className="pick-points">{m.points} pts</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {results.length >= 25 && <p className="hint">25 résultats affichés : précisez votre recherche.</p>}
              </>
            )}
        </section>

        <section className="card register-detail" ref={detail} aria-labelledby="detail-title" aria-live="polite">
          <span className="kicker">2 · VALIDER</span>
          {!member ? <EmptyState icon="cash" title="Prêt à accueillir">Sélectionnez un client pour voir son solde, valider {type.visit.article} {type.visit.one} et remettre ses récompenses.</EmptyState> : (
            <>
              <div className="member-head"><span className="avatar avatar-lg">{initials(member.name)}</span><div><h2 id="detail-title">{member.name}</h2><small>{member.visits} {member.visits > 1 ? type.visit.many : type.visit.one} enregistrés</small></div></div>
              {flash && <div className="flash" role="status"><span className="flash-icon"><Icon name="check" size={20} strokeWidth={2.4} /></span><div><strong>{flash.title}</strong>{flash.body && <p>{flash.body}</p>}</div></div>}
              <div className="balance"><strong>{member.points}</strong><span>points disponibles</span></div>
              {progress?.reward && (
                <div className="next-reward">
                  <div className="progress" aria-hidden="true"><i style={{ width: `${percent(member.points, progress.reward.points_cost)}%` }} /></div>
                  <small>{progress.remaining > 0 ? <>Encore <b>{progress.remaining} pts</b> pour « {progress.reward.name} »</> : <>Objectif atteint : « {progress.reward.name} »</>}</small>
                </div>
              )}
              <button type="button" className="btn btn-primary btn-xl" disabled={busy || cooldown > 0} onClick={() => void validateVisit()}>
                <Icon name="check" size={22} strokeWidth={2.2} />
                {busy ? "Enregistrement…" : cooldown > 0 ? `Déjà validé · encore ${cooldown} min` : `${type.visit.action} · +${POINTS_PER_VISIT} pts`}
              </button>
              {cooldown > 0 && <p className="hint">Par sécurité, un même client ne peut être validé qu’une fois toutes les {VISIT_COOLDOWN_MINUTES} minutes.</p>}

              <h3 className="section-title">Récompenses</h3>
              {!activeRewards.length ? <p className="hint">Aucune récompense active. <Link className="text-link" href="/business/programme">Ajouter une récompense</Link></p> : (
                <ul className="reward-rows">
                  {activeRewards.map(r => (
                    <li key={r.id}>
                      <div><strong>{r.name}</strong><small>{r.points_cost} points</small></div>
                      <button type="button" className={`btn btn-sm ${member.points >= r.points_cost ? "btn-primary" : "btn-ghost"}`} disabled={busy || member.points < r.points_cost} onClick={() => void giveReward(r.id)}>
                        {member.points >= r.points_cost ? "Remettre" : `${r.points_cost - member.points} pts restants`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="section-title">Derniers événements</h3>
              {!history.length ? <p className="hint">Aucun événement pour ce client.</p> : (
                <ul className="mini-history">
                  {history.map((h, i) => (
                    <li key={i}><span className={`dot dot-${h.kind}`} aria-hidden="true" /><span>{h.kind === "visite" ? type.visit.done : h.kind === "recompense" ? "Récompense" : "Avis privé"}{h.detail ? ` · ${h.detail}` : ""}</span><time dateTime={h.created_at}>{relativeTime(h.created_at)}</time></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {log.length > 0 && (
        <section className="card session-log" aria-labelledby="log-title">
          <span className="kicker">CETTE SESSION</span><h2 id="log-title">Validé depuis l’ouverture de la caisse</h2>
          <ul className="feed">{log.map(l => <li key={l.id}><span className="avatar avatar-sm">{initials(l.name)}</span><div><strong>{l.name}</strong><small>{l.text}</small></div><time>{new Date(l.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ul>
        </section>
      )}
      {scanning && <QrScanner onClose={() => setScanning(false)} onDetect={value => { setScanning(false); setQuery(value); }} />}
    </div>
  );
}

function Page() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant} label="Ouverture de la caisse…">{merchant.program ? <Register merchant={merchant} /> : <NoProgram merchant={merchant} />}</MerchantGate>;
}
export default function CaissePage() { return <Suspense fallback={<PageSkeleton label="Ouverture de la caisse…" />}><Page /></Suspense>; }
