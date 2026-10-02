"use client";
import { useState } from "react";
import Link from "next/link";
import { BILLING_PLANS } from "@/lib/billing-plans";
export function LandingPricing(){const [annual,setAnnual]=useState(false);return <div>
 <div className="text-center"><span className="landing-eyebrow">06 / OFFRES</span><h2 className="landing-title mt-5">VOTRE FIDÉLITÉ.<br/><span className="text-[#109B81]">UN PRIX SIMPLE.</span></h2>
 <p className="mx-auto mt-6 max-w-2xl">15 jours gratuits pour tester avec vos clients. Sans frais d’installation.</p>
 <div className="mt-8 inline-flex rounded-full border-2 border-[#102D46] p-1" role="group" aria-label="Période de facturation">
 <button className={`rounded-full px-5 py-2 font-bold ${!annual?"bg-[#102D46] text-white":""}`} aria-pressed={!annual} onClick={()=>setAnnual(false)}>Mensuel</button>
 <button className={`rounded-full px-5 py-2 font-bold ${annual?"bg-[#102D46] text-white":""}`} aria-pressed={annual} onClick={()=>setAnnual(true)}>Annuel · 2 mois offerts</button></div></div>
 <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">{BILLING_PLANS.map(plan=><article key={plan.id} className={`flex flex-col rounded-3xl border-2 border-[#102D46] bg-white p-8 ${plan.id==="wallet"?"shadow-[8px_8px_0_#109B81]":""}`}>
 <h3 className="font-display text-2xl">{plan.name}</h3><p>{plan.description}</p><p className="my-6"><strong className="font-display text-5xl">{annual?plan.yearly:plan.monthly} €</strong> HT / {annual?"an":"mois"}</p>
 {annual&&<p className="text-sm">{(plan.yearly/12).toLocaleString("fr-FR",{maximumFractionDigits:2})} € HT/mois · facturation annuelle</p>}
 <ul className="my-6 flex-1 space-y-3">{plan.features.map(f=><li key={f}>✓ {f}</li>)}</ul>
 <Link href="/business/login?mode=signup" className="landing-solid-link inline-flex min-h-12 items-center justify-center rounded-full bg-[#102D46] px-6 font-bold text-white">Essayer 15 jours gratuitement</Link>
 </article>)}</div><p className="mt-8 text-center text-xs leading-relaxed">Carte bancaire requise. Renouvellement automatique après l’essai, sauf résiliation. TVA applicable en supplément. Support physique non inclus.</p></div>;}
