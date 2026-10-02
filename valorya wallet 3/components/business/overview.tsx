"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState } from "@/lib/use-merchant";
import { MerchantGate, PageHead, EmptyState, Skeleton } from "../states";
import { NoProgram } from "./no-program";
import { Icon } from "../icons";
import { formatDate, relativeTime, startOfDay, initials } from "@/lib/loyalty";

type Feed = { id: string; kind: "visit" | "reward"; at: string; name: string; detail: string };
type Stats = { clients: number; newWeek: number; visits: number; redemptions: number; month: number; days: { label: string; count: number; today: boolean }[]; feed: Feed[] };

type Embedded = { program_id?: string; customers?: { display_name: string } | null } | null;
const nameOf = (m: unknown) => ((m as Embedded)?.customers?.display_name) || "Client";

function Body({ merchant }: { merchant: MerchantState }) {
  const { business, program, type, cashiers, rewards } = merchant;
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [posterDone, setPosterDone] = useState(false);
  const bid = business?.id;
  const pid = program?.id;

  useEffect(() => {
    if (!bid || !pid) return;
    let cancelled = false;
    setPosterDone(Boolean(localStorage.getItem(`fideli.poster.${bid}`)));
    (async () => {
      try {
        const client = supabase();
        const today = startOfDay();
        const dayStarts = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return d; });
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const weekAgo = dayStarts[0];
        const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 29);
        const visitsIn = (from?: Date, to?: Date) => {
          let q = client.from("visits").select("id,memberships!inner(program_id)", { count: "exact", head: true }).eq("memberships.program_id", pid);
          if (from) q = q.gte("created_at", from.toISOString());
          if (to) q = q.lt("created_at", to.toISOString());
          return q;
        };
        const perDayRequest = Promise.all(dayStarts.map((d, i) => visitsIn(d, i === 6 ? tomorrow : dayStarts[i + 1])));
        const [clients, newWeek, visits, redemptions, month, feedVisits, feedRewards, perDay] = await Promise.all([
          client.from("memberships").select("id", { count: "exact", head: true }).eq("program_id", pid),
          client.from("memberships").select("id", { count: "exact", head: true }).eq("program_id", pid).gte("joined_at", weekAgo.toISOString()),
          visitsIn(),
          client.from("redemptions").select("id,memberships!inner(program_id)", { count: "exact", head: true }).eq("memberships.program_id", pid),
          visitsIn(monthAgo),
          client.from("visits").select("id,created_at,cashier_id,memberships!inner(program_id,customers(display_name))").eq("memberships.program_id", pid).order("created_at", { ascending: false }).limit(8),
          client.from("redemptions").select("id,created_at,points_spent,rewards(name),memberships!inner(program_id,customers(display_name))").eq("memberships.program_id", pid).order("created_at", { ascending: false }).limit(5),
          perDayRequest,
        ]);
        const failed = [clients, newWeek, visits, redemptions, month, feedVisits, feedRewards, ...perDay].find(r => r.error);
        if (failed?.error) throw failed.error;
        const cashierName = (id: string | null) => cashiers.find(c => c.id === id)?.name;
        const feed: Feed[] = [
          ...((feedVisits.data || []) as unknown as { id: string; created_at: string; cashier_id: string | null; memberships: unknown }[]).map(v => ({
            id: "v" + v.id, kind: "visit" as const, at: v.created_at, name: nameOf(v.memberships),
            detail: `${type.visit.done}${cashierName(v.cashier_id) ? " · " + cashierName(v.cashier_id) : ""}`,
          })),
          ...((feedRewards.data || []) as unknown as { id: string; created_at: string; points_spent: number; rewards: { name: string } | null; memberships: unknown }[]).map(r => ({
            id: "r" + r.id, kind: "reward" as const, at: r.created_at, name: nameOf(r.memberships),
            detail: `Récompense remise : ${r.rewards?.name || "récompense"} (−${r.points_spent} pts)`,
          })),
        ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
        if (cancelled) return;
        setStats({
          clients: clients.count || 0, newWeek: newWeek.count || 0, visits: visits.count || 0, redemptions: redemptions.count || 0, month: month.count || 0,
          days: dayStarts.map((d, i) => ({ label: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), count: perDay[i].count || 0, today: i === 6 })),
          feed,
        });
      } catch (e) { if (!cancelled) setError(errorMessage(e)); }
    })();
    return () => { cancelled = true; };
  }, [bid, pid, cashiers, type]);

  if (!business || !program) return null;
  const nf = (n: number) => n.toLocaleString("fr-FR");
  const many = type.visit.many;
  const todayCount = stats?.days[6]?.count ?? 0;
  const yesterday = stats?.days[5]?.count ?? 0;
  const weekTotal = stats?.days.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const max = Math.max(1, ...(stats?.days.map(d => d.count) || [1]));
  const profileDone = Boolean(business.description || business.hours || business.phone || business.address);
  const steps = [
    { done: profileDone, label: "Présentez votre établissement", hint: "Horaires, adresse et description visibles par vos clients.", href: "/business/profil" },
    { done: posterDone, label: "Affichez votre QR d’inscription", hint: "Imprimez l’affiche et posez-la près de la caisse.", href: "/business/cartes" },
    { done: (stats?.clients || 0) > 0, label: "Inscrivez votre premier client", hint: "Il scanne le QR, saisit son prénom et son email.", href: "/business/cartes" },
    { done: (stats?.visits || 0) > 0, label: `Validez votre premier ${type.visit.one}`, hint: "Depuis la caisse : cherchez le client et validez.", href: "/business/caisse" },
  ];
  const doneCount = steps.filter(s => s.done).length;

  return (
    <div className="ws-page">
      <PageHead kicker={business.name.toUpperCase()} title="Votre activité, en un regard."
        subtitle={stats ? (todayCount ? `${todayCount} ${todayCount > 1 ? many : type.visit.one} aujourd’hui.` : `Aucun ${type.visit.one} enregistré pour le moment aujourd’hui.`) : "Chargement de vos indicateurs…"}
        actions={<><button type="button" className="btn btn-ghost" onClick={() => location.reload()}>Actualiser</button><Link className="btn btn-primary" href="/business/caisse"><Icon name="cash" size={18} /> Ouvrir la caisse</Link></>} />
      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <section className="grid grid-4" aria-label="Indicateurs clés">
        <div className="kpi"><span>{many.toUpperCase()} AUJOURD’HUI</span><strong>{stats ? nf(todayCount) : <Skeleton height={34} width={60} />}</strong><small>{stats ? `Hier : ${nf(yesterday)}` : " "}</small></div>
        <div className="kpi"><span>7 DERNIERS JOURS</span><strong>{stats ? nf(weekTotal) : <Skeleton height={34} width={60} />}</strong><small>{stats ? `${nf(stats.month)} sur 30 jours` : " "}</small></div>
        <div className="kpi"><span>CLIENTS INSCRITS</span><strong>{stats ? nf(stats.clients) : <Skeleton height={34} width={60} />}</strong><small>{stats ? (stats.newWeek ? `+${nf(stats.newWeek)} cette semaine` : "Aucun nouveau cette semaine") : " "}</small></div>
        <div className="kpi"><span>RÉCOMPENSES REMISES</span><strong>{stats ? nf(stats.redemptions) : <Skeleton height={34} width={60} />}</strong><small>{rewards.filter(r => r.active).length} au catalogue</small></div>
      </section>

      <div className="grid grid-main">
        <section className="card" aria-labelledby="chart-title">
          <div className="card-head"><div><span className="kicker">FRÉQUENTATION</span><h2 id="chart-title">{many.charAt(0).toUpperCase() + many.slice(1)} sur 7 jours</h2></div></div>
          {!stats ? <Skeleton height={170} /> : weekTotal === 0 ? (
            <EmptyState icon="chart" title="Le graphique se remplira tout seul">Dès votre premier {type.visit.one} validé en caisse, la fréquentation de la semaine apparaît ici.</EmptyState>
          ) : (
            <div className="bars" role="img" aria-label={`${many} par jour : ` + stats.days.map(d => `${d.label} ${d.count}`).join(", ")}>
              {stats.days.map((d, i) => (
                <div className={`bar-col ${d.today ? "is-today" : ""}`} key={i}>
                  <span className="bar-value">{d.count}</span>
                  <span className="bar-fill" style={{ height: `${Math.max(4, Math.round((d.count / max) * 100))}%` }} />
                  <span className="bar-label">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="feed-title">
          <div className="card-head"><div><span className="kicker">EN DIRECT</span><h2 id="feed-title">Activité récente</h2></div></div>
          {!stats ? <div className="skeleton-stack"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div> : !stats.feed.length ? (
            <EmptyState icon="clock" title="Pas encore d’activité">Les {many} validés et les récompenses remises s’afficheront ici.</EmptyState>
          ) : (
            <ul className="feed">
              {stats.feed.map(item => (
                <li key={item.id}>
                  <span className={`avatar avatar-sm ${item.kind === "reward" ? "avatar-amber" : ""}`}>{item.kind === "reward" ? <Icon name="gift" size={16} /> : initials(item.name)}</span>
                  <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                  <time dateTime={item.at} title={formatDate(item.at, true)}>{relativeTime(item.at)}</time>
                </li>
              ))}
            </ul>
          )}
          <Link className="text-link" href="/business/clients">Voir tous les clients →</Link>
        </section>
      </div>

      {doneCount < steps.length && (
        <section className="card checklist" aria-labelledby="start-title">
          <div className="card-head"><div><span className="kicker">POUR BIEN DÉMARRER</span><h2 id="start-title">{doneCount} étape{doneCount > 1 ? "s" : ""} sur {steps.length}</h2></div>
            <div className="progress progress-lg" aria-hidden="true"><i style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div></div>
          <ol>
            {steps.map(s => (
              <li key={s.label} className={s.done ? "done" : ""}>
                <span className="check" aria-hidden="true">{s.done ? <Icon name="check" size={16} strokeWidth={2.4} /> : null}</span>
                <div><strong>{s.label}</strong><small>{s.hint}</small></div>
                {!s.done && <Link className="btn btn-soft btn-sm" href={s.href}>Faire</Link>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid grid-3 shortcuts" aria-label="Raccourcis">
        <Link href="/business/cartes" className="shortcut"><Icon name="qr" size={22} /><strong>Affiche & QR d’inscription</strong><small>Imprimez, partagez le lien ou créez des cartes physiques.</small></Link>
        <Link href="/business/programme" className="shortcut"><Icon name="gift" size={22} /><strong>Récompenses</strong><small>Ajoutez des paliers adaptés à votre activité.</small></Link>
        <Link href="/business/equipe" className="shortcut"><Icon name="team" size={22} /><strong>{type.team.title}</strong><small>Suivez les résultats de chaque {type.team.one}.</small></Link>
      </section>
    </div>
  );
}

export default function Overview() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant}>{merchant.program ? <Body merchant={merchant} /> : <NoProgram merchant={merchant} />}</MerchantGate>;
}
