"use client";

import { useState } from "react";
import Link from "next/link";
import { landingConfig } from "@/lib/landing-config";

export function LandingPricing() {
  const [annual, setAnnual] = useState(false);
  const { plans, taxLabel, availability, trialDays, annualDiscountLabel } = landingConfig.pricing;
  const cur = landingConfig.currencySymbol;
  return <div>
    <div className="text-center">
      <span className="landing-eyebrow">06 / OFFRES</span>
      <h2 className="landing-title mt-5">UNE OFFRE QUI SUIT<br/><span className="text-[#1D4ED8]">VOTRE PME.</span></h2>
      <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-black/65">Commencez avec l’essentiel, puis ajoutez du pilotage et du multi-sites quand votre programme prend de l’ampleur. Les montants restent configurables avant lancement commercial.</p>
      <div className="mt-8 inline-flex rounded-full border-2 border-[#102D46] bg-white p-1" role="group" aria-label="Période de facturation">
        <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)} className={`rounded-full px-5 py-2 text-sm font-bold ${!annual ? "bg-[#102D46] text-white" : "text-[#102D46]"}`}>Mensuel</button>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)} className={`rounded-full px-5 py-2 text-sm font-bold ${annual ? "bg-[#102D46] text-white" : "text-[#102D46]"}`}>Annuel · {annualDiscountLabel}</button>
      </div>
    </div>
    <div className="mt-12 grid gap-6 lg:grid-cols-3">
      {plans.map(plan => { const price = annual ? plan.annualPerMonth : plan.monthly; return <article key={plan.id} className={`relative flex flex-col rounded-[1.5rem] border-2 border-[#102D46] bg-white p-7 sm:p-8 ${plan.highlight ? "shadow-[10px_10px_0_#1D4ED8]" : ""}`}>
        {plan.highlight && <span className="absolute -top-3 left-7 rounded-full bg-[#C9EDE5] px-3 py-1 text-xs font-bold">Pour PME actives</span>}
        <h3 className="font-display text-2xl">{plan.name}</h3><p className="mt-1 text-sm text-black/55">{plan.tagline}</p>
        <div className="mt-6 flex items-baseline gap-2"><strong className="font-display text-5xl">{price} {cur}</strong><span className="text-sm text-black/60">{taxLabel} / mois</span></div>
        <ul className="my-6 flex-1 space-y-3 text-sm font-medium">{plan.features.map(item => <li key={item} className="flex gap-3"><span className="font-bold text-[#1D4ED8]">✓</span>{item}</li>)}</ul>
        <Link href="/business/login" className="landing-solid-link inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#102D46] px-7 text-sm font-bold text-white">Créer mon espace <span className="ml-3">↗</span></Link>
      </article>; })}
    </div>
    <p className="mt-8 text-center text-xs leading-relaxed text-black/50">Essai prévu : {trialDays} jours. {availability}</p>
  </div>;
}
