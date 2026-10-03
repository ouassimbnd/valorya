"use client";

import { useState } from "react";
import { landingConfig } from "@/lib/landing-config";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: landingConfig.currency, maximumFractionDigits: 0 });

function RangeField({ label, value, min, max, step, unit = "", onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void;
}) {
  return <label className="block border-b border-black/10 py-4 last:border-0">
    <span className="mb-3 flex items-center justify-between gap-4 text-sm font-semibold text-[#102D46]">
      <span>{label}</span><strong className="whitespace-nowrap text-base">{unit === landingConfig.currencySymbol ? euro.format(value) : `${value}${unit}`}</strong>
    </span>
    <input className="landing-range w-full cursor-pointer accent-[#0FA3A0]" type="range" min={min} max={max} step={step} value={value}
      onChange={event => onChange(Number(event.target.value))} aria-label={label} />
    <span className="mt-1 flex justify-between text-xs text-black/45"><span>{unit === landingConfig.currencySymbol ? euro.format(min) : `${min}${unit}`}</span><span>{unit === landingConfig.currencySymbol ? euro.format(max) : `${max}${unit}`}</span></span>
  </label>;
}

export function LandingCalculator() {
  const config = landingConfig.roi;
  const [customers, setCustomers] = useState<number>(config.customersPerDay.initial);
  const [basket, setBasket] = useState<number>(config.averageBasket.initial);
  const [days, setDays] = useState<number>(config.openDays.initial);
  const [growth, setGrowth] = useState<number>(config.hypotheticalGrowth.initial);
  const base = customers * basket * days;
  const additional = Math.round(base * growth / 100);
  const monthlyFee = landingConfig.pricing.plans[0].monthly;
  const difference = additional - monthlyFee;

  return <div className="grid overflow-hidden rounded-[1.75rem] border-2 border-[#102D46] bg-white shadow-[12px_12px_0_#102D46] lg:grid-cols-[1.05fr_.95fr]">
    <div className="p-6 sm:p-9 lg:p-11">
      <div className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#1D4ED8]">Vos hypothèses</div>
      <h3 className="font-display text-3xl uppercase leading-none sm:text-4xl">Ajustez les curseurs</h3>
      <p className="mt-3 text-sm leading-relaxed text-black/60">Utilisez vos propres chiffres. Le scénario ne prédit pas vos résultats.</p>
      <div className="mt-5">
        <RangeField label="Clients par jour" value={customers} onChange={setCustomers} {...config.customersPerDay} />
        <RangeField label="Panier moyen" value={basket} unit={landingConfig.currencySymbol} onChange={setBasket} {...config.averageBasket} />
        <RangeField label="Jours ouverts par mois" value={days} onChange={setDays} {...config.openDays} />
        <RangeField label="Hausse hypothétique des visites" value={growth} unit=" %" onChange={setGrowth} {...config.hypotheticalGrowth} />
      </div>
    </div>
    <div className="flex flex-col justify-between bg-[#102D46] p-6 text-white sm:p-9 lg:p-11" aria-live="polite" aria-atomic="true">
      <div>
        <span className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest">Simulation</span>
        <p className="mt-12 text-sm text-white/65">Scénario de chiffre d’affaires additionnel</p>
        <strong className="mt-2 block font-display text-[clamp(3.1rem,6vw,5.5rem)] leading-none text-[#5EEAD4]">+{euro.format(additional)}</strong>
        <span className="text-sm text-white/65">par mois, selon votre hypothèse</span>
      </div>
      <div className="mt-12 border-t border-white/20 pt-6">
        <div className="flex justify-between gap-4 text-sm"><span>Activité actuelle estimée</span><strong>{euro.format(base)} / mois</strong></div>
        <div className="mt-3 flex justify-between gap-4 text-sm"><span>Offre Valorya indicative</span><strong>{euro.format(monthlyFee)} / mois</strong></div>
        <div className="mt-5 flex justify-between gap-4 border-t border-white/20 pt-5 text-base"><span>Écart indicatif*</span><strong>{difference >= 0 ? "+" : ""}{euro.format(difference)}</strong></div>
        <p className="mt-5 text-xs leading-relaxed text-white/50">* Calcul : clients × panier × jours × hausse choisie, moins l’abonnement indicatif. Ce n’est pas un bénéfice : marges, récompenses, coûts et saisonnalité ne sont pas déduits. Aucun gain n’est garanti.</p>
      </div>
    </div>
  </div>;
}
