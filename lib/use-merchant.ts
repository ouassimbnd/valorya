"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { billingRequest } from "./billing-client";
import { configured, supabase, errorMessage } from "./supabase";
import { resolveType, type BusinessType } from "./business-types";

export type Business = {
  id: string; name: string; slug: string; category: string | null; address: string | null; description: string | null;
  phone: string | null; hours: string | null; logo_emoji: string | null; accent_color: string | null;
};
export type Program = { id: string; reward_name: string; required_visits: number };
export type Reward = { id: string; name: string; points_cost: number; active: boolean };
export type Cashier = { id: string; name: string; active: boolean };

export type MerchantState = {
  status: "loading" | "unconfigured" | "ready" | "error";
  error: string;
  business: Business | null;
  program: Program | null;
  /** Toutes les récompenses, actives ou non. */
  rewards: Reward[];
  cashiers: Cashier[];
  type: BusinessType;
  reload: () => Promise<void>;
};

const COLUMNS = "id,name,slug,category,address,description,phone,hours,logo_emoji,accent_color";

/**
 * Charge une seule fois l’identité du commerçant connecté (commerce, programme, récompenses, équipe).
 * Redirige vers la connexion ou la création de commerce si nécessaire.
 */
export function useMerchant(): MerchantState {
  const [status, setStatus] = useState<MerchantState["status"]>(configured ? "loading" : "unconfigured");
  const [error, setError] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const request = useRef(0);

  const reload = useCallback(async () => {
    if (!configured) return;
    const current = ++request.current;
    try {
      const client = supabase();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError && !/session missing/i.test(authError.message)) throw authError;
      if (!user) {
        location.replace(`/business/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      const billing = await billingRequest("status");
      if (!billing.access) { location.replace("/business/abonnement"); return; }
      const { data: b, error: be } = await client.from("businesses").select(COLUMNS).eq("owner_id", user.id).maybeSingle();
      if (be) throw be;
      if (!b) { location.replace("/business/new"); return; }
      const { data: p, error: pe } = await client.from("programs").select("id,reward_name,required_visits").eq("business_id", b.id).eq("active", true).maybeSingle();
      if (pe) throw pe;
      let rw: Reward[] = [];
      if (p) {
        const { data, error: re } = await client.from("rewards").select("id,name,points_cost,active").eq("program_id", p.id).order("points_cost");
        if (re) throw re;
        rw = (data || []) as Reward[];
      }
      const { data: cs, error: ce } = await client.from("cashiers").select("id,name,active").eq("business_id", b.id).order("name");
      if (ce) throw ce;
      if (current !== request.current) return;
      setBusiness(b as Business); setProgram((p as Program | null) || null); setRewards(rw); setCashiers((cs || []) as Cashier[]);
      setError(""); setStatus("ready");
    } catch (e) {
      if (current !== request.current) return;
      setError(errorMessage(e)); setStatus("error");
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { status, error, business, program, rewards, cashiers, type: resolveType(business?.category), reload };
}

/** Crée un programme si le commerce n’en a plus d’actif (cas d’anciennes données). */
export async function createProgram(business: Business, type: BusinessType): Promise<void> {
  const client = supabase();
  const first = type.rewards[0];
  const { data, error } = await client.from("programs")
    .insert({ business_id: business.id, reward_name: first.name, required_visits: Math.max(1, Math.round(first.points / 10)) })
    .select("id").single();
  if (error) throw error;
  for (const reward of type.rewards) {
    const { error: re } = await client.rpc("add_reward", { p_program: data.id, p_name: reward.name, p_points: reward.points });
    if (re) throw re;
  }
}
