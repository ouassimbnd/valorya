"use client";
import { useEffect, useState, type FormEvent } from "react";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { BUSINESS_TYPES, getType, type BusinessType } from "@/lib/business-types";
import { Icon } from "@/components/icons";
import { slugify, visitsFor } from "@/lib/loyalty";

export default function NewBusiness() {
  const [type, setType] = useState<BusinessType>(getType("cafe"));
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(location.origin);
    if (!configured) return;
    void supabase().auth.getUser().then(({ data }) => { if (!data.user) location.replace("/business/login"); });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const client = supabase();
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Connectez-vous d’abord.");
      const { data: existing } = await client.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
      if (existing) { location.assign("/business"); return; }
      const first = type.rewards[0];
      const { data: id, error: ce } = await client.rpc("create_business", { p_name: name.trim(), p_slug: slug.trim().toLowerCase(), p_reward: first.name, p_visits: visitsFor(first.points) });
      if (ce) throw ce;
      // Personnalisation : le commerce est déjà créé, un échec ci-dessous ne bloque donc pas l’accès.
      try {
        await client.from("businesses").update({ category: type.label, logo_emoji: type.emoji }).eq("id", id as string);
        const { data: program } = await client.from("programs").select("id").eq("business_id", id as string).eq("active", true).maybeSingle();
        if (program) for (const reward of type.rewards.slice(1)) await client.rpc("add_reward", { p_program: program.id, p_name: reward.name, p_points: reward.points });
      } catch { /* les réglages pourront être complétés depuis l’espace commerçant */ }
      location.assign("/business");
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="onboard">
      <div className="onboard-card">
        <span className="kicker">CRÉER VOTRE PROGRAMME · ÉTAPE FINALE</span>
        <h1 className="h-lg">Votre commerce, votre carte.</h1>
        <p className="page-sub">Choisissez votre métier : nous préparons le vocabulaire et des récompenses adaptées. Tout reste modifiable ensuite.</p>
        {!configured ? <p className="notice notice-error" role="alert">Configurez Supabase avant de créer un programme.</p> : (
          <form className="form" onSubmit={submit}>
            <div className="field"><span>Votre activité</span>
              <div className="type-grid" role="radiogroup" aria-label="Type de commerce">
                {BUSINESS_TYPES.map(t => <button type="button" key={t.key} role="radio" aria-checked={type.key === t.key} className={`type-tile ${type.key === t.key ? "is-on" : ""}`} onClick={() => setType(t)}><Icon name={t.icon} size={22} /><span>{t.short}</span></button>)}
              </div>
            </div>
            <label className="field"><span>Nom du commerce</span>
              <input className="input" required minLength={2} maxLength={80} value={name} autoComplete="organization" placeholder="Ex. Maison Rivoli" onChange={e => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} /></label>
            <label className="field"><span>Adresse de votre page</span>
              <input className="input" required minLength={3} maxLength={50} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()); }} title="Lettres minuscules, chiffres et tirets" />
              <small>{origin || "https://…"}/join/<b>{slug || "votre-commerce"}</b> · non modifiable ensuite, pour ne jamais casser vos QR imprimés.</small></label>
            <div className="preset-box">
              <strong>Récompenses proposées pour un {type.short.toLowerCase()}</strong>
              <ul>{type.rewards.map(r => <li key={r.name}><Icon name="gift" size={16} /><span>{r.name}</span><b>{r.points} pts</b></li>)}</ul>
              <small>10 points par {type.visit.one}. Vous pourrez les changer à tout moment.</small>
            </div>
            <button className="btn btn-primary btn-xl" disabled={busy}>{busy ? "Création…" : "Créer mon programme"}</button>
          </form>
        )}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
