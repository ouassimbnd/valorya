import { NextResponse } from "next/server";
import { walletServerConfigured } from "@/lib/passcreator";
import { authorizeWallet, processWalletJob, readWallet, walletAdmin, WalletError } from "@/lib/wallet-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
export async function POST(request: Request) {
  try {
    const id = await authorizeWallet(request, await request.json().catch(() => null));
    if (!walletServerConfigured()) return reply({ status: "disabled" });
    const admin = walletAdmin();
    if (!await readWallet(admin, id)) return reply({ status: "not_requested" });
    const result = await processWalletJob(admin, id);
    const row = await readWallet(admin, id);
    return reply({ status: row && row.desired_version > row.synced_version ? "pending" : result.status, message: result.error });
  } catch (e) { return reply({ status: "pending", error: e instanceof WalletError ? e.message : "Mise à jour Wallet en attente." }, e instanceof WalletError ? e.status : 502); }
}
