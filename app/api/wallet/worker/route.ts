import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { walletServerConfigured } from "@/lib/passcreator";
import { processWalletJob, walletAdmin, UUID } from "@/lib/wallet-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`), received = Buffer.from(request.headers.get("authorization") || "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
async function work(request: Request, membershipId?: string) {
  if (!authorized(request)) return reply({ error: "Accès refusé." }, 401);
  if (!walletServerConfigured()) return reply({ error: "Wallet non configuré." }, 503);
  try {
    const admin = walletAdmin();
    // One job per invocation bounds external calls to the route execution limit.
    const result = await processWalletJob(admin, membershipId);
    return reply({ status: result.status });
  } catch { return reply({ error: "Synchronisation indisponible." }, 503); }
}
// Callable by an external scheduler / Supabase Cron with an Authorization header.
export async function GET(request: Request) { return work(request); }
// Supabase Database Webhook: only the key is used; never trust a posted balance or name.
export async function POST(request: Request) {
  if (!authorized(request)) return reply({ error: "Accès refusé." }, 401);
  const body = await request.json().catch(() => null);
  const row = body?.record;
  if (body?.table !== "wallet_passes" || body?.schema !== "public" || !row || !UUID.test(row.membership_id || "")) return reply({ error: "Événement invalide." }, 400);
  if (Number(row.desired_version) <= Number(row.synced_version) || row.lock_token) return reply({ status: "ignored" });
  return work(request, row.membership_id);
}
