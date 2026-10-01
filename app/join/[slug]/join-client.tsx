"use client";
import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/states";
import { resolveType } from "@/lib/business-types";
import { safeColor, shade } from "@/lib/loyalty";

type Business={id:string;name:string;slug:string;category:string|null;address:string|null;description:string|null;phone:string|null;hours:string|null;logo_emoji:string|null;accent_color:string|null};
type Reward={id:string;name:string;points_cost:number};
const COLUMNS="id,name,slug,category,address,description,phone,hours,logo_emoji,accent_color";

function JoinContent(){
 const {slug}=useParams<{slug:string}>(); const card=useSearchParams().get("card");
 const [business,setBusiness]=useState<Business|null>(null); const [programId,setProgramId]=useState(""); const [rewards,setRewards]=useState<Reward[]>([]);
 const [firstName,setFirstName]=useState(""); const [lastName,setLastName]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState("");
 const [privacy,setPrivacy]=useState(false); const [marketingEmail,setMarketingEmail]=useState(false); const [marketingPush,setMarketingPush]=useState(false);
 const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [notFound,setNotFound]=useState(false); const [existing,setExisting]=useState(false);
 useEffect(()=>{if(!configured){setLoading(false);return;}let cancelled=false;(async()=>{try{const c=supabase();const b=await c.from("businesses").select(COLUMNS).eq("slug",slug).maybeSingle();if(b.error)throw b.error;if(!b.data){if(!cancelled){setNotFound(true);setLoading(false)}return;}const p=await c.from("programs").select("id").eq("business_id",b.data.id).eq("active",true).maybeSingle();const rw=p.data?await c.from("rewards").select("id,name,points_cost").eq("program_id",p.data.id).eq("active",true).order("points_cost").limit(4):null;if(!cancelled){setBusiness(b.data as Business);setProgramId(p.data?.id||"");setRewards((rw?.data||[]) as Reward[]);setLoading(false)}}catch(e){if(!cancelled){setError(errorMessage(e));setLoading(false)}}})();return()=>{cancelled=true}},[slug]);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!programId||busy)return;if(!privacy){setError("Acceptez l’utilisation de vos données pour créer votre carte.");return;}setBusy(true);setError("");setExisting(false);try{const r=await supabase().rpc("join_program_public",{p_program:programId,p_first_name:firstName.trim(),p_last_name:lastName.trim(),p_email:email.trim(),p_phone:phone.trim()||null,p_marketing_email:marketingEmail,p_marketing_push:marketingPush});if(r.error)throw r.error;const out=r.data as {status:string;access_token?:string};if(out.status==="existing"){setExisting(true);return;}if(!out.access_token)throw new Error("Impossible de créer la carte.");if(card){const claim=await supabase().rpc("claim_card_public",{p_card_token:card,p_access_token:out.access_token});if(claim.error)throw claim.error;}location.assign(`/c/${out.access_token}`);}catch(err){setError(errorMessage(err));}finally{setBusy(false)}};
 if(loading)return <div className="pub-page"><Skeleton height={200} radius={22}/><div style={{height:14}}/><Skeleton height={360} radius={18}/></div>;
 if(!configured)return <div className="pub-page"><div className="card empty"><h3>Inscription indisponible</h3><p>Ce service n’est pas encore configuré.</p></div></div>;
 if(notFound||!business)return <div className="pub-page"><div className="card empty" role="alert"><span className="empty-icon danger"><Icon name="alert" size={26}/></span><h3>Commerce introuvable</h3><p>{error||"Ce lien n’est plus valide."}</p></div></div>;
 const type=resolveType(business.category);const accent=safeColor(business.accent_color,"#109B81");const style={"--brand-accent":accent,"--brand-dark":shade(accent,-.45)} as CSSProperties; const first=rewards[0];
 return <div className="pub-page join-page" style={style}>
  <section className="join-hero"><span className="join-emoji">{business.logo_emoji||type.emoji}</span><span className="join-type">{type.label}</span><h1>{business.name}</h1>{business.description&&<p>{business.description}</p>}</section>
  <section className="card join-perks"><span className="kicker">PROGRAMME DE FIDÉLITÉ</span><p className="perk-line"><Icon name="star" size={18}/><span>{type.pitch}</span></p>{rewards.length>0&&<ul className="perk-rewards">{rewards.map(r=><li key={r.id}><Icon name="gift" size={16}/><span>{r.name}</span><b>{r.points_cost} pts</b></li>)}</ul>}</section>
  <section className="card join-form" aria-labelledby="join-title"><h2 id="join-title">{first?<>Créez votre carte et visez <em>{first.name.toLowerCase()}</em></>:"Créez votre carte en quelques secondes"}</h2><p className="hint">Aucun mot de passe, aucune application à télécharger. Votre carte s’affiche immédiatement après l’inscription.</p>
   {existing?<div className="notice"><b>Vous avez déjà une carte dans ce commerce.</b><p>Pour protéger votre solde, nous ne réaffichons pas une carte existante à partir d’un simple email.</p><Link className="btn btn-primary" href={`/customer/login?email=${encodeURIComponent(email)}`}>Recevoir un lien sécurisé</Link><button className="btn btn-ghost" type="button" onClick={()=>setExisting(false)}>Utiliser une autre adresse</button></div>:
   !programId?<p className="notice notice-error">Ce commerce n’accepte pas encore de nouvelles inscriptions.</p>:<form className="form" onSubmit={submit}>
    <div className="form-grid"><label className="field"><span>Prénom</span><input className="input" required minLength={2} maxLength={60} value={firstName} onChange={e=>setFirstName(e.target.value)} autoComplete="given-name"/></label><label className="field"><span>Nom</span><input className="input" required minLength={2} maxLength={80} value={lastName} onChange={e=>setLastName(e.target.value)} autoComplete="family-name"/></label></div>
    <label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email"/><small>Il vous permettra de retrouver votre carte si vous changez de téléphone.</small></label>
    <label className="field"><span>Téléphone <i>facultatif</i></span><input className="input" type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/><small>Utile seulement si vous choisissez de recevoir certaines communications du commerce.</small></label>
    <label className="check-line"><input type="checkbox" required checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span>J’accepte l’utilisation de mes données pour gérer ma carte de fidélité. <Link href="/privacy" target="_blank">Confidentialité</Link></span></label>
    <label className="check-line"><input type="checkbox" checked={marketingEmail} onChange={e=>setMarketingEmail(e.target.checked)}/><span>Je souhaite recevoir les offres de ce commerce par email. <b>Facultatif.</b></span></label>
    <label className="check-line"><input type="checkbox" checked={marketingPush} onChange={e=>setMarketingPush(e.target.checked)}/><span>Je souhaite activer plus tard les notifications sur mon téléphone. <b>Facultatif.</b></span></label>
    <button className="btn btn-primary btn-xl" disabled={busy}>{busy?"Création…":"Créer ma carte Valorya"}</button>
   </form>}
   {error&&<p className="notice notice-error" role="alert">{error}</p>}
  </section>
 </div>;
}
export default function JoinClient(){return <Suspense fallback={<div className="pub-page"><Skeleton height={400} radius={22}/></div>}><JoinContent/></Suspense>}
