"use client";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useMerchant, type MerchantState } from "@/lib/use-merchant";
import { MerchantGate, PageHead } from "../states";
import { useFeedback } from "../feedback";
import { Icon } from "../icons";
import { BUSINESS_TYPES, resolveType, type BusinessType } from "@/lib/business-types";
import { safeColor, shade } from "@/lib/loyalty";
import { BUSINESS_UPDATED } from "../app-shell";

const SWATCHES = ["#109B81", "#102D46", "#FF8A3D", "#2563EB", "#7C5CFF", "#D6336C", "#0D9488", "#B7791F"];
type Form = { name: string; category: string; address: string; phone: string; hours: string; description: string; logo_emoji: string; accent_color: string };
const PHONE = /^[0-9+().\s-]{6,30}$/;

function Body({ merchant }: { merchant: MerchantState }) {
  const { business } = merchant;
  const { toast } = useFeedback();
  const initial = useMemo<Form | null>(() => business ? {
    name: business.name || "", category: resolveType(business.category).label, address: business.address || "", phone: business.phone || "",
    hours: business.hours || "", description: business.description || "", logo_emoji: business.logo_emoji || "", accent_color: safeColor(business.accent_color, "#109B81"),
  } : null, [business]);
  const [form, setForm] = useState<Form | null>(initial);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setForm(initial); }, [initial]);
  useEffect(() => { setOrigin(location.origin); }, []);
  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial));
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!business || !form) return null;
  const type: BusinessType = resolveType(form.category);
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const pickType = (t: BusinessType) => {
    const previous = resolveType(form.category);
    // On ne remplace l’emoji que s’il vient du type précédent ou s’il est vide.
    const keepEmoji = form.logo_emoji && !previous.logos.includes(form.logo_emoji) && form.logo_emoji !== previous.emoji;
    set({ category: t.label, logo_emoji: keepEmoji ? form.logo_emoji : t.emoji });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    if (form.phone.trim() && !PHONE.test(form.phone.trim())) { toast("Le numéro de téléphone semble invalide.", "error"); return; }
    setBusy(true);
    try {
      const { error } = await supabase().from("businesses").update({
        name: form.name.trim(), category: form.category.trim() || null, address: form.address.trim() || null,
        description: form.description.trim() || null, phone: form.phone.trim() || null, hours: form.hours.trim() || null,
        logo_emoji: form.logo_emoji.trim() || null, accent_color: form.accent_color || null,
      }).eq("id", business.id);
      if (error) throw error;
      toast("Établissement mis à jour. Vos clients voient les changements immédiatement.");
      window.dispatchEvent(new Event(BUSINESS_UPDATED));
      await merchant.reload();
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const publicUrl = `${origin}/join/${business.slug}`;
  const copy = async () => { try { await navigator.clipboard.writeText(publicUrl); toast("Lien copié."); } catch { toast("Copiez le lien affiché à l’écran.", "info"); } };
  const accent = form.accent_color;

  return (
    <div className="ws-page">
      <PageHead kicker="GESTION" title="Mon établissement." subtitle="Ces informations apparaissent sur la page d’inscription et sur la carte de vos clients." />
      <div className="profile-layout">
        <form className="stack" onSubmit={submit}>
          <section className="card">
            <span className="kicker">1 · VOTRE ACTIVITÉ</span>
            <h2>Quel est votre métier ?</h2>
            <p className="page-sub">Le vocabulaire (« {type.visit.one} », « {type.team.one} »…) et les récompenses proposées s’adaptent à votre choix.</p>
            <div className="type-grid" role="radiogroup" aria-label="Type de commerce">
              {BUSINESS_TYPES.map(t => (
                <button type="button" key={t.key} role="radio" aria-checked={type.key === t.key} className={`type-tile ${type.key === t.key ? "is-on" : ""}`} onClick={() => pickType(t)}>
                  <Icon name={t.icon} size={22} /><span>{t.short}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <span className="kicker">2 · IDENTITÉ</span>
            <h2>Nom et image</h2>
            <div className="form">
              <label className="field"><span>Nom du commerce</span><input className="input" required maxLength={80} value={form.name} onChange={e => set({ name: e.target.value })} /></label>
              <div className="field"><span>Logo (emoji)</span>
                <div className="emoji-row">
                  {[...new Set([...type.logos, ...(form.logo_emoji ? [form.logo_emoji] : [])])].map(em => (
                    <button type="button" key={em} className={`emoji ${form.logo_emoji === em ? "is-on" : ""}`} aria-pressed={form.logo_emoji === em} aria-label={`Logo ${em}`} onClick={() => set({ logo_emoji: em })}>{em}</button>
                  ))}
                  <input className="input emoji-input" maxLength={8} value={form.logo_emoji} onChange={e => set({ logo_emoji: e.target.value })} aria-label="Autre emoji ou initiale" placeholder="Autre" />
                </div>
                <small>Un logo image (PNG) nécessite l’activation du stockage Supabase : prévu dans une prochaine version.</small></div>
              <div className="field"><span>Couleur de votre carte</span>
                <div className="swatch-row">
                  {SWATCHES.map(c => <button type="button" key={c} className={`swatch ${accent.toLowerCase() === c.toLowerCase() ? "is-on" : ""}`} style={{ background: c }} aria-label={`Couleur ${c}`} aria-pressed={accent.toLowerCase() === c.toLowerCase()} onClick={() => set({ accent_color: c })} />)}
                  <input className="swatch-custom" type="color" value={accent} onChange={e => set({ accent_color: e.target.value })} aria-label="Couleur personnalisée" />
                </div></div>
            </div>
          </section>

          <section className="card">
            <span className="kicker">3 · INFORMATIONS PRATIQUES</span>
            <h2>Pour que vos clients vous retrouvent</h2>
            <div className="form">
              <label className="field"><span>Adresse</span><input className="input" maxLength={160} value={form.address} onChange={e => set({ address: e.target.value })} placeholder="12 rue des Lilas, 75011 Paris" autoComplete="street-address" /></label>
              <label className="field"><span>Téléphone</span><input className="input" type="tel" maxLength={30} value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="01 23 45 67 89" autoComplete="tel" /></label>
              <label className="field"><span>Horaires</span><textarea className="input" rows={3} maxLength={400} value={form.hours} onChange={e => set({ hours: e.target.value })} placeholder={type.hoursHint} /></label>
              <label className="field"><span>Description</span><textarea className="input" rows={4} maxLength={600} value={form.description} onChange={e => set({ description: e.target.value })} placeholder={type.descriptionHint} /><small>{form.description.length} / 600</small></label>
            </div>
          </section>

          <div className="save-bar">
            <span className={dirty ? "is-dirty" : ""}>{dirty ? "Modifications non enregistrées" : "Tout est à jour"}</span>
            <button className="btn btn-primary" disabled={busy || !dirty}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>

        <aside className="stack profile-aside">
          <section className="card">
            <span className="kicker">APERÇU CLIENT</span>
            <div className="mini-join" style={{ "--brand-accent": accent, "--brand-dark": shade(accent, -0.4) } as CSSProperties}>
              <div className="mini-join-top"><span className="mini-emoji" aria-hidden="true">{form.logo_emoji || type.emoji}</span><div><strong>{form.name || "Votre commerce"}</strong><small>{type.label}</small></div></div>
              <p>{type.pitch}</p>
              <ul>
                {form.address && <li><Icon name="pin" size={16} />{form.address}</li>}
                {form.hours && <li><Icon name="clock" size={16} />{form.hours.split("\n")[0]}</li>}
                {form.phone && <li><Icon name="phone" size={16} />{form.phone}</li>}
              </ul>
              <span className="mini-cta">Créer ma carte</span>
            </div>
          </section>
          <section className="card">
            <span className="kicker">PAGE PUBLIQUE</span>
            <div className="url-box">{publicUrl}</div>
            <div className="btn-row"><button type="button" className="btn btn-soft btn-sm" onClick={() => void copy()}><Icon name="copy" size={16} /> Copier</button><a className="btn btn-ghost btn-sm" href={`/join/${business.slug}`} target="_blank" rel="noopener noreferrer"><Icon name="eye" size={16} /> Ouvrir</a></div>
            <p className="hint">L’adresse ne peut pas être modifiée : vos QR codes déjà imprimés continueront de fonctionner.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function Profile() {
  const merchant = useMerchant();
  return <MerchantGate merchant={merchant}><Body merchant={merchant} /></MerchantGate>;
}
