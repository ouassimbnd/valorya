"use client";
import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/states";
import { resolveType } from "@/lib/business-types";
import { safeColor, shade } from "@/lib/loyalty";

type Business = { id: string; name: string; slug: string; category: string | null; address: string | null; description: string | null; phone: string | null; hours: string | null; logo_emoji: string | null; accent_color: string | null };
type Reward = { id: string; name: string; points_cost: number };
const COLUMNS = "id,name,slug,category,address,description,phone,hours,logo_emoji,accent_color";

function JoinContent() {
  const { slug } = useParams<{ slug: string }>();
  const card = useSearchParams().get("card");
  const [business, setBusiness] = useState<Business | null>(null);
  const [programId, setProgramId] = useState("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const client = supabase();
        const { data: b, error: be } = await client.from("businesses").select(COLUMNS).eq("slug", slug).maybeSingle();
        if (be) throw be;
        if (!b) { if (!cancelled) { setNotFound(true); setLoading(false); } return; }
        const { data: p } = await client.from("programs").select("id").eq("business_id", b.id).eq("active", true).maybeSingle();
        const rw = p ? await client.from("rewards").select("id,name,points_cost").eq("program_id", p.id).eq("active", true).order("points_cost").limit(4) : null;
        const { data: { user } } = await client.auth.getUser();
        if (user && p) {
          const { data: c } = await client.from("customers").select("id,display_name").eq("auth_user_id", user.id).maybeSingle();
          if (c) {
            const { data: m } = await client.from("memberships").select("id").eq("customer_id", c.id).eq("program_id", p.id).maybeSingle();
            if (m) {
              if (card) { const { error: ce } = await client.rpc("claim_card", { p_token: card, p_membership: m.id }); if (ce && !cancelled) setError(errorMessage(ce)); }
              location.replace(`/customer?membership=${m.id}`); return;
            }
            if (!cancelled) setName(c.display_name);
          } else if (!cancelled) setName(user.user_metadata?.display_name || "");
          if (!cancelled) { setEmail(user.email || ""); setSignedIn(true); }
        }
        if (cancelled) return;
        setBusiness(b as Business); setProgramId(p?.id || ""); setRewards((rw?.data || []) as Reward[]); setLoading(false);
      } catch (e) { if (!cancelled) { setError(errorMessage(e)); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, [slug, card]);

  const sendLink = async () => {
    const next = `/join/${encodeURIComponent(slug)}${card ? `?card=${encodeURIComponent(card)}` : ""}`;
    const { error: e } = await supabase().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`, data: { display_name: name.trim() }, shouldCreateUser: true } });
    if (e) throw e;
    setSentTo(email.trim());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!programId || busy) return;
    setBusy(true); setError("");
    try {
      const client = supabase();
      const { data: { user } } = await client.auth.getUser();
      if (!user) { await sendLink(); return; }
      const { data: existing, error: re } = await client.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (re) throw re;
      let customerId = existing?.id as string | undefined;
      if (!customerId) { const { data: created, error: ce } = await client.from("customers").insert({ auth_user_id: user.id, display_name: name.trim() }).select("id").single(); if (ce) throw ce; customerId = created.id; }
      const found = await client.from("memberships").select("id").eq("customer_id", customerId).eq("program_id", programId).maybeSingle();
      if (found.error) throw found.error;
      let membershipId = found.data?.id as string | undefined;
      if (!membershipId) { const created = await client.from("memberships").insert({ customer_id: customerId, program_id: programId }).select("id").single(); if (created.error) throw created.error; membershipId = created.data.id; }
      if (card) { const { error: ce } = await client.rpc("claim_card", { p_token: card, p_membership: membershipId }); if (ce) throw ce; }
      location.assign(`/customer?membership=${membershipId}`);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  if (loading) return <div className="pub-page" role="status" aria-label="Chargement"><Skeleton height={200} radius={22} /><div style={{ height: 14 }} /><Skeleton height={300} radius={18} /></div>;
  if (!configured) return <div className="pub-page"><div className="card empty" role="alert"><h3>Inscription indisponible</h3><p>Ce service n’est pas encore configuré. Merci de réessayer plus tard.</p></div></div>;
  if (notFound || !business) return <div className="pub-page"><div className="card empty" role="alert"><span className="empty-icon danger"><Icon name="alert" size={26} /></span><h3>Commerce introuvable</h3><p>{error || "Ce lien n’est plus valide. Vérifiez le QR code ou demandez-le au commerçant."}</p><Link className="btn btn-ghost" href="/">Retour à l’accueil</Link></div></div>;

  const type = resolveType(business.category);
  const accent = safeColor(business.accent_color, "#109B81");
  const first = rewards[0];
  const style = { "--brand-accent": accent, "--brand-dark": shade(accent, -0.45) } as CSSProperties;

  return (
    <div className="pub-page join-page" style={style}>
      <section className="join-hero">
        <span className="join-emoji" aria-hidden="true">{business.logo_emoji || type.emoji}</span>
        <span className="join-type">{type.label}</span>
        <h1>{business.name}</h1>
        {business.description && <p>{business.description}</p>}
        <ul className="join-info">
          {business.address && <li><Icon name="pin" size={16} />{business.address}</li>}
          {business.hours && <li><Icon name="clock" size={16} /><span style={{ whiteSpace: "pre-line" }}>{business.hours}</span></li>}
        </ul>
      </section>

      <section className="card join-perks" aria-label="Avantages du programme">
        <span className="kicker">VOTRE PROGRAMME DE FIDÉLITÉ</span>
        <p className="perk-line"><Icon name="star" size={18} /> <span>{type.pitch}</span></p>
        <p className="perk-line"><Icon name="check" size={18} /> <span>10 points à chaque {type.visit.one}, 5 points pour un avis privé.</span></p>
        {rewards.length > 0 && <ul className="perk-rewards">{rewards.map(r => <li key={r.id}><Icon name="gift" size={16} /><span>{r.name}</span><b>{r.points_cost} pts</b></li>)}</ul>}
      </section>

      <section className="card join-form" aria-labelledby="join-title">
        {sentTo ? (
          <div className="sent">
            <span className="empty-icon"><Icon name="check" size={26} /></span>
            <h2>Consultez votre boîte mail</h2>
            <p>Nous avons envoyé un lien de connexion à <b>{sentTo}</b>. Ouvrez-le <b>depuis ce téléphone</b> pour créer votre carte.</p>
            <p className="hint">Rien reçu ? Vérifiez vos courriers indésirables.</p>
            <div className="btn-row"><button type="button" className="btn btn-ghost" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await sendLink(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }}>Renvoyer le lien</button><button type="button" className="btn btn-ghost" onClick={() => setSentTo("")}>Changer d’adresse</button></div>
          </div>
        ) : (
          <>
            <h2 id="join-title">{first ? <>Créez votre carte, visez <em>{first.name.toLowerCase()}</em></> : "Créez votre carte en 30 secondes"}</h2>
            <p className="hint">Sans mot de passe : un lien de connexion vous est envoyé par email.</p>
            {!programId ? <p className="notice notice-error" role="alert">Ce commerce n’accepte pas encore de nouvelles inscriptions.</p> : (
              <form className="form" onSubmit={submit}>
                <label className="field"><span>Votre prénom</span><input className="input" required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" /></label>
                <label className="field"><span>Votre email</span><input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" disabled={signedIn} /></label>
                <label className="check-line"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} /><span>J’accepte que mes données servent à gérer ma carte de fidélité. <Link href="/privacy" target="_blank">Confidentialité</Link></span></label>
                <button className="btn btn-primary btn-xl" disabled={busy}>{busy ? "Un instant…" : signedIn ? "Rejoindre le programme" : "Recevoir mon lien"}</button>
              </form>
            )}
            {error && <p className="notice notice-error" role="alert">{error}</p>}
            <p className="hint">Vous avez déjà une carte ? <Link className="text-link" href="/customer/login">Retrouver ma carte</Link></p>
          </>
        )}
      </section>
    </div>
  );
}

export default function JoinClient() {
  return <Suspense fallback={<div className="pub-page"><Skeleton height={200} radius={22} /></div>}><JoinContent /></Suspense>;
}
