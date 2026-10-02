"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { BILLING_PLANS,type Plan,type Cycle } from "@/lib/billing-plans";
import { billingRequest,type BillingStatus } from "@/lib/billing-client";
export default function SubscriptionPage(){
 const [state,setState]=useState<BillingStatus|null>(null),[cycle,setCycle]=useState<Cycle>("month"),[busy,setBusy]=useState(""),[error,setError]=useState("");
 async function refresh(sync=false){setError("");try{setState(await billingRequest("status",sync?"POST":"GET"));}catch(e){setError(e instanceof Error?e.message:"Service indisponible.");}}
 useEffect(()=>{void refresh(true);},[]);
 async function act(kind:"checkout"|"portal",plan?:Plan){setBusy(plan||kind);setError("");try{
  const data=await billingRequest(kind,"POST",kind==="checkout"?{plan,cycle}:undefined);
  const u=new URL(data.url);if(u.protocol!=="https:"||!(u.hostname==="checkout.stripe.com"||u.hostname==="billing.stripe.com"))throw new Error("Lien de paiement invalide.");
  location.assign(u.href);
 }catch(e){setError(e instanceof Error?e.message:"Paiement indisponible.");setBusy("");}}
 const existing=state && !["none","canceled","incomplete_expired"].includes(state.status);
 return <div className="container page" style={{maxWidth:1000}}>
  <span className="kicker">VOTRE ABONNEMENT VALORYA</span><h1 className="h-lg">15 jours pour essayer.</h1>
  <p className="page-sub">Choisissez votre forfait, enregistrez votre carte sur Stripe et créez votre commerce. Aucun prélèvement pendant le premier essai.</p>
  {error&&<div className="notice notice-error" role="alert"><p>{error}</p><button className="btn btn-soft" disabled={Boolean(busy)} onClick={()=>void refresh(true)}>Réessayer la vérification</button></div>}
  {!state&&!error&&<p role="status">Chargement de votre abonnement…</p>}
  {state&&<section className="card" style={{marginBottom:24}}>
   <h2>{state.access?(state.status==="trialing"?"Votre essai est actif":"Votre abonnement est actif"):state.trialUsed?"Votre abonnement nécessite une action":"Bienvenue chez Valorya"}</h2>
   {state.validUntil&&<p>{state.status==="trialing"?"Fin de l’essai gratuit":"Accès jusqu’au"} : <strong>{new Date(state.validUntil).toLocaleString("fr-FR")}</strong>.</p>}
   {state.cancelAtPeriodEnd&&<p>La résiliation est programmée. Aucun renouvellement après la période en cours.</p>}
   {!state.access&&state.trialUsed&&<p>Un abonnement payé est nécessaire pour utiliser la caisse et gérer votre programme. Vos données sont conservées.</p>}
   <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:16}}>
    {state.access&&<Link className="btn btn-primary" href="/business">Accéder à mon espace</Link>}
    {state.canManage&&<button className="btn btn-dark" disabled={Boolean(busy)} onClick={()=>void act("portal")}>Gérer mon abonnement et mes factures</button>}
    <button className="btn btn-soft" disabled={Boolean(busy)} onClick={()=>void refresh(true)}>Actualiser mon statut</button>
   </div>
  </section>}
  {!existing&&<>
   <div style={{display:"flex",gap:12,marginBottom:24}} role="group" aria-label="Période de facturation">
    <button className={cycle==="month"?"btn btn-primary":"btn btn-soft"} aria-pressed={cycle==="month"} onClick={()=>setCycle("month")}>Mensuel</button>
    <button className={cycle==="year"?"btn btn-primary":"btn btn-soft"} aria-pressed={cycle==="year"} onClick={()=>setCycle("year")}>Annuel · 2 mois offerts</button>
   </div>
   <div className="billing-grid">{BILLING_PLANS.map(plan=><article className="card" key={plan.id} style={{border:plan.id==="wallet"?"2px solid #109B81":undefined}}>
    <span className="kicker">{plan.id==="wallet"?"AVEC APPLE ET GOOGLE WALLET":"POUR DÉMARRER"}</span><h2>{plan.name}</h2><p>{plan.description}</p>
    <p style={{fontSize:36,fontWeight:800,color:"#102D46",margin:"24px 0"}}>{cycle==="month"?plan.monthly:plan.yearly} € <span style={{fontSize:16,fontWeight:400}}>HT / {cycle==="month"?"mois":"an"}</span></p>
    {cycle==="year"&&<p>Soit {(plan.yearly/12).toLocaleString("fr-FR",{maximumFractionDigits:2})} € HT/mois, facturés en une fois.</p>}
    <ul style={{paddingLeft:20,lineHeight:2}}>{plan.features.map(f=><li key={f}>{f}</li>)}</ul>
    <button className="btn btn-primary" style={{marginTop:24,width:"100%"}} disabled={!state||Boolean(busy)} onClick={()=>void act("checkout",plan.id)}>{busy===plan.id?"Ouverture de Stripe…":state?.trialUsed?"Souscrire ce forfait":"Commencer mes 15 jours gratuits"}</button>
   </article>)}</div>
  </>}
  <p className="hint" style={{marginTop:24}}>Carte bancaire requise. Après les 15 jours gratuits, prélèvement automatique de la période choisie, sauf résiliation avant la fin de l’essai. Ensuite, résiliation effective en fin de période. Un seul essai par compte. En cas d’échec de paiement, les fonctions commerçant sont suspendues. TVA applicable calculée au paiement selon la configuration fiscale du vendeur. Aucun support physique inclus.</p>
  <p><Link href="/terms">Conditions d’abonnement</Link> · <Link href="/privacy">Confidentialité</Link></p>
 </div>;
}
