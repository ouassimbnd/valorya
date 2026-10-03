"use client";
import { Suspense, useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { WalletButton } from "@/components/wallet-button";
import { Icon } from "@/components/icons";
import { useFeedback } from "@/components/feedback";
import { Skeleton } from "@/components/states";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { resolveType } from "@/lib/business-types";
import { computePoints, formatDate, initials, nextReward, percent, relativeTime, safeColor, shade } from "@/lib/loyalty";

type Business = { name: string; slug: string; category: string | null; address: string | null; phone: string | null; hours: string | null; description: string | null; logo_emoji: string | null; accent_color: string | null };
type Item = { id: string; joined_at: string; card_token: string; program: { id: string; business: Business } };
type Reward = { id: string; name: string; points_cost: number };
type Entry = { id: string; kind: "visit" | "reward" | "feedback"; at: string; text: string };
type Summary = { visits: number; feedback: number; redeemed: number; spent: number; canRate: boolean };
const COLUMNS = "name,slug,category,address,phone,hours,description,logo_emoji,accent_color";

function Content() {
  const requested = useSearchParams().get("membership");
  const { toast, confirm } = useFeedback();
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<{ id: string; display_name: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [summary, setSummary] = useState<Summary>({ visits: 0, feedback: 0, redeemed: 0, spent: 0, canRate: false });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [card, setCard] = useState<{ status: string; token: string } | null>(null);
  const [tab, setTab] = useState<"card" | "history" | "profile">("card");
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [fatal, setFatal] = useState("");

  const load = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      const client = supabase();
      const { data: { user } } = await client.auth.getUser();
      if (!user) { location.replace("/customer/login"); return; }
      const { data: c, error: ce } = await client.from("customers").select("id,display_name").eq("auth_user_id", user.id).maybeSingle();
      if (ce) throw ce;
      setCustomer(c);
      if (!c) { setItems([]); setLoading(false); return; }
      const { data, error } = await client.from("memberships").select(`id,joined_at,card_token,program:programs(id,business:businesses(${COLUMNS}))`).eq("customer_id", c.id).order("joined_at", { ascending: false });
      if (error) throw error;
      const list = (data || []) as unknown as Item[];
      setItems(list);
      const chosen = list.find(i => i.id === requested) || list[0];
      if (!chosen) { setLoading(false); return; }
      setSelected(chosen);
      const [sum, cardRes, rw, v, r, f] = await Promise.all([
        client.rpc("customer_card_summary", { p_membership: chosen.id }),
        client.from("physical_cards").select("status,token").eq("membership_id", chosen.id).eq("status", "active").maybeSingle(),
        client.from("rewards").select("id,name,points_cost").eq("program_id", chosen.program.id).eq("active", true).order("points_cost"),
        client.from("visits").select("id,created_at").eq("membership_id", chosen.id).order("created_at", { ascending: false }).limit(20),
        client.from("redemptions").select("id,created_at,points_spent,rewards(name)").eq("membership_id", chosen.id).order("created_at", { ascending: false }).limit(20),
        client.from("private_feedback").select("id,created_at,rating").eq("membership_id", chosen.id).order("created_at", { ascending: false }).limit(20),
      ]);
      const failed = [sum, cardRes, rw, v, r, f].find(x => x.error);
      if (failed?.error) throw failed.error;
      setSummary(sum.data as Summary); setCard(cardRes.data); setRewards((rw.data || []) as Reward[]);
      const type = resolveType(chosen.program.business.category);
      setEntries([
        ...((v.data || []) as { id: string; created_at: string }[]).map(x => ({ id: "v" + x.id, kind: "visit" as const, at: x.created_at, text: `${type.visit.done} · +10 points` })),
        ...((r.data || []) as unknown as { id: string; created_at: string; points_spent: number; rewards: { name: string } | null }[]).map(x => ({ id: "r" + x.id, kind: "reward" as const, at: x.created_at, text: `${x.rewards?.name || "Récompense"} · −${x.points_spent} points` })),
        ...((f.data || []) as { id: string; created_at: string; rating: number }[]).map(x => ({ id: "f" + x.id, kind: "feedback" as const, at: x.created_at, text: `Avis privé (${x.rating}/5) · +5 points` })),
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25));
      setLoading(false);
    } catch (e) { setFatal(errorMessage(e)); setLoading(false); }
  }, [requested]);
  useEffect(() => { setOrigin(location.origin); void load(); }, [load]);

  const rate = async (rating: number) => {
    if (!selected || busy) return;
    setBusy(true);
    try { const { error } = await supabase().rpc("submit_feedback", { p_membership: selected.id, p_rating: rating }); if (error) throw error; toast("Merci ! 5 points ajoutés pour votre retour privé."); await load(); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const lost = async () => {
    if (!selected) return;
    const ok = await confirm({ title: "Déclarer cette carte perdue ?", body: "Elle ne pourra plus être utilisée. Vos points sont conservés : demandez une nouvelle carte au commerçant.", confirmLabel: "Déclarer perdue", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase().rpc("report_lost_card", { p_membership: selected.id });
    if (error) toast(errorMessage(error), "error"); else { toast("Carte désactivée."); void load(); }
  };
  const saveName = async () => {
    const value = nameDraft.trim();
    if (!customer || value.length < 2 || busy) { toast("Le prénom doit contenir au moins 2 caractères.", "error"); return; }
    setBusy(true);
    try { const { error } = await supabase().from("customers").update({ display_name: value.slice(0, 60) }).eq("id", customer.id); if (error) throw error; toast("Prénom mis à jour."); setEditing(false); await load(); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const deleteData = async () => {
    const ok = await confirm({ title: "Supprimer votre compte ?", body: "Votre compte, vos cartes et tout votre historique seront définitivement supprimés. Cette action est irréversible.", confirmLabel: "Supprimer définitivement", tone: "danger" });
    if (!ok) return;
    const client = supabase();
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const response = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    if (response.ok) { await client.auth.signOut(); location.replace("/"); } else toast("Suppression indisponible. Contactez le responsable indiqué dans la politique de confidentialité.", "error");
  };
  const logout = async () => { await supabase().auth.signOut(); location.assign("/"); };

  if (!configured) return <div className="pub-page"><div className="card empty"><h2>Configuration requise</h2><p>Ajoutez les variables Supabase pour accéder aux cartes clients.</p></div></div>;
  if (loading) return <div className="pub-page" role="status" aria-label="Chargement de votre carte"><Skeleton height={230} radius={22} /><div style={{ height: 16 }} /><Skeleton height={120} radius={16} /></div>;
  if (fatal) return <div className="pub-page"><div className="card empty" role="alert"><span className="empty-icon danger"><Icon name="alert" size={26} /></span><h3>Impossible de charger votre carte</h3><p>{fatal}</p><button className="btn btn-primary" onClick={() => location.reload()}>Réessayer</button></div></div>;
  if (!selected) return (
    <div className="pub-page"><div className="card empty">
      <span className="empty-icon"><Icon name="card" size={26} /></span><h3>Aucune carte pour l’instant</h3>
      <p>{customer ? `Bonjour ${customer.display_name}. ` : ""}Scannez le QR code d’un commerce partenaire pour créer votre première carte de fidélité.</p>
      <button type="button" className="btn btn-ghost" onClick={logout}>Se déconnecter</button>
    </div></div>
  );

  const b = selected.program.business;
  const type = resolveType(b.category);
  const accent = safeColor(b.accent_color, "#109B81");
  const points = computePoints(summary.visits, summary.feedback, summary.spent);
  const goal = nextReward(rewards, points);
  const ready = rewards.filter(r => points >= r.points_cost);
  const first = rewards[0];
  const style = { "--brand-accent": accent, "--brand-dark": shade(accent, -0.45) } as CSSProperties;

  return (
    <div className="pub-page customer-page" style={style}>
      <div className="me-head">
        <span className="avatar avatar-lg" aria-hidden="true">{initials(customer?.display_name || "")}</span>
        <div><small>Bonjour</small><h1>{customer?.display_name}<span className="brand-period">.</span></h1></div>
        {items.length > 1 && <select className="input select-compact" aria-label="Choisir une carte" value={selected.id} onChange={e => location.assign(`/customer?membership=${e.target.value}`)}>{items.map(i => <option key={i.id} value={i.id}>{i.program.business.name}</option>)}</select>}
      </div>

      <article className="loyalty-card" aria-label={`Carte de fidélité ${b.name}`}>
        <div className="loyalty-top"><span className="loyalty-brand"><span aria-hidden="true">{b.logo_emoji || type.emoji}</span>{b.name}</span><span className="loyalty-tag">Carte de fidélité</span></div>
        <div className="loyalty-points"><strong>{points}</strong><span>points</span></div>
        <p className="loyalty-meta">{summary.visits} {summary.visits > 1 ? type.visit.many : type.visit.one} · membre depuis {formatDate(selected.joined_at)}</p>
        {goal.reward && (
          <div className="loyalty-goal">
            <div className="progress progress-on-dark" aria-hidden="true"><i style={{ width: `${percent(points, goal.reward.points_cost)}%` }} /></div>
            <div><span>{goal.remaining > 0 ? `Encore ${goal.remaining} pts pour « ${goal.reward.name} »` : `« ${goal.reward.name} » disponible`}</span><span>{Math.min(points, goal.reward.points_cost)} / {goal.reward.points_cost}</span></div>
          </div>
        )}
      </article>

      {ready.length > 0 && <div className="flash flash-amber" role="status"><span className="flash-icon"><Icon name="gift" size={20} /></span><div><strong>{ready.length > 1 ? `${ready.length} récompenses disponibles` : "Une récompense vous attend"}</strong><p>Présentez cet écran au commerçant : lui seul peut la valider.</p></div></div>}

      <div className="tabs tabs-3" role="tablist" aria-label="Sections de votre carte">
        {([["card", "Ma carte"], ["history", "Historique"], ["profile", "Mon profil"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "card" && (
        <div className="stack">
          <section className="card qr-card">
            <div className="qr-box">{origin ? <QRCodeSVG value={`${origin}/business/caisse?card=${selected.card_token}`} size={168} marginSize={2} /> : <Skeleton height={168} width={168} />}</div>
            <div><h2>Mon QR de fidélité</h2><p>Montrez-le en caisse : ce QR contient uniquement un identifiant aléatoire. Le commerçant retrouve votre fiche puis confirme lui-même l’opération.</p></div>
          </section>
          <section className="card"><WalletButton membershipId={selected.id} /></section>
          <section className="card">
            <span className="kicker">MES RÉCOMPENSES</span>
            {!rewards.length ? <p className="hint">Ce commerce n’a pas encore publié de récompense.</p> : (
              <ul className="rewards-list">
                {rewards.map(r => (
                  <li key={r.id}>
                    <div><strong>{r.name}</strong><div className="progress progress-sm" aria-hidden="true"><i style={{ width: `${percent(points, r.points_cost)}%` }} /></div><small>{Math.min(points, r.points_cost)} / {r.points_cost} points</small></div>
                    <span className={`badge ${points >= r.points_cost ? "badge-amber" : "badge-gray"}`}>{points >= r.points_cost ? "Disponible" : "En cours"}</span>
                  </li>
                ))}
              </ul>
            )}
            {first && <p className="hint">Chaque {type.visit.one} rapporte 10 points ; un avis privé, 5 points.</p>}
          </section>
          <section className="card">
            <span className="kicker">MON AVIS PRIVÉ</span><h2>Comment c’était ?</h2>
            <p className="hint">Notez votre dernière visite : {summary.canRate ? "5 points offerts, quelle que soit la note." : "une nouvelle visite est nécessaire pour laisser un avis."}</p>
            <div className="rating-row" role="group" aria-label="Noter la visite">
              {[[1, "😕"], [2, "😐"], [3, "🙂"], [4, "😊"], [5, "😍"]].map(([n, emoji]) => <button key={n} type="button" disabled={!summary.canRate || busy} onClick={() => void rate(Number(n))} aria-label={`${n} sur 5`}>{emoji}</button>)}
            </div>
          </section>
        </div>
      )}

      {tab === "history" && (
        <section className="card">
          <span className="kicker">MON HISTORIQUE</span>
          {!entries.length ? <div className="empty"><span className="empty-icon"><Icon name="history" size={26} /></span><h3>Rien pour l’instant</h3><p>Vos {type.visit.many}, avis et récompenses apparaîtront ici après votre premier passage.</p></div> : (
            <ul className="feed">
              {entries.map(e => <li key={e.id}><span className={`avatar avatar-sm ${e.kind === "reward" ? "avatar-amber" : ""}`}><Icon name={e.kind === "reward" ? "gift" : e.kind === "feedback" ? "star" : "check"} size={16} /></span><div><strong>{e.kind === "reward" ? "Récompense" : e.kind === "feedback" ? "Avis" : type.visit.done}</strong><small>{e.text}</small></div><time dateTime={e.at} title={formatDate(e.at, true)}>{relativeTime(e.at)}</time></li>)}
            </ul>
          )}
        </section>
      )}

      {tab === "profile" && (
        <div className="stack">
          <section className="card">
            <span className="kicker">MON PROFIL</span>
            {editing ? (
              <div className="form"><label className="field"><span>Prénom</span><input className="input" value={nameDraft} maxLength={60} onChange={e => setNameDraft(e.target.value)} /></label>
                <div className="btn-row"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveName()}>Enregistrer</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Annuler</button></div></div>
            ) : (
              <div className="profile-line"><div><strong>{customer?.display_name}</strong><small>Prénom affiché au commerçant</small></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNameDraft(customer?.display_name || ""); setEditing(true); }}>Modifier</button></div>
            )}
          </section>
          <section className="card">
            <span className="kicker">{b.name.toUpperCase()}</span>
            {b.description && <p>{b.description}</p>}
            <ul className="info-list">
              {b.address && <li><Icon name="pin" size={18} /><span>{b.address}</span></li>}
              {b.hours && <li><Icon name="clock" size={18} /><span style={{ whiteSpace: "pre-line" }}>{b.hours}</span></li>}
              {b.phone && <li><Icon name="phone" size={18} /><a href={`tel:${b.phone.replace(/[^+\d]/g, "")}`}>{b.phone}</a></li>}
              {!b.address && !b.hours && !b.phone && !b.description && <li><span>Ce commerce n’a pas encore renseigné ses informations.</span></li>}
            </ul>
          </section>
          <section className="card">
            <span className="kicker">CARTE PHYSIQUE</span>
            <h3 className="section-title">{card ? "Votre carte est liée" : "Pas de carte physique"}</h3>
            <p className="hint">{card ? "En cas de perte, désactivez-la ici : vos points sont conservés." : "Demandez une carte au commerçant et scannez son QR pour la relier à votre compte."}</p>
            {card && <button type="button" className="btn btn-ghost" onClick={() => void lost()}>Déclarer ma carte perdue</button>}
          </section>
          <section className="card danger-zone">
            <span className="kicker">MON COMPTE</span>
            <div className="btn-row"><button type="button" className="btn btn-ghost" onClick={logout}><Icon name="logout" size={18} /> Se déconnecter</button><Link className="btn btn-ghost" href="/privacy">Confidentialité</Link></div>
            <button type="button" className="text-link danger" onClick={() => void deleteData()}>Supprimer mon compte et mes données</button>
          </section>
        </div>
      )}
    </div>
  );
}
export default function Customer() { return <Suspense fallback={<div className="pub-page"><Skeleton height={230} radius={22} /></div>}><Content /></Suspense>; }
