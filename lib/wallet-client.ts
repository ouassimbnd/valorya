"use client";
import { supabase } from "./supabase";
/** Best effort only: a successful points operation must never be reported as failed because of Wallet. */
export async function syncWallet(membershipId: string): Promise<"pending" | "ok"> {
  try {
    const { data: { session } } = await supabase().auth.getSession();
    if (!session) return "pending";
    const r = await fetch("/api/wallet/sync", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ membershipId }), signal: AbortSignal.timeout(45_000) });
    const data = await r.json();
    return r.ok && data.status !== "pending" ? "ok" : "pending";
  } catch { return "pending"; }
}
