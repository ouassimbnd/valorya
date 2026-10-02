import { NextResponse } from "next/server";
import { walletServerConfigured } from "@/lib/passcreator";
import { authorizeWallet, processWalletJob, readWallet, requestWallet, walletAdmin, WalletError } from "@/lib/wallet-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization", "Referrer-Policy": "no-referrer" };
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers });
// Public capability check: no external API call on every client page load.
export async function GET() { return json({ configured: walletServerConfigured(), connected: walletServerConfigured() }); }
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const membershipId = await authorizeWallet(request, body);
    if (!walletServerConfigured()) return json({ error: "Le service Wallet n’est pas encore configuré." }, 503);
    const admin = walletAdmin();
    await requestWallet(admin, membershipId);
    const result = await processWalletJob(admin, membershipId);
    const row = await readWallet(admin, membershipId);
    if (row?.download_page && row.operation === "sync") {
      return json({ url: row.download_page, appleUrl: row.apple_url || row.download_page, googleUrl: row.google_url || row.download_page,
        pending: row.desired_version > row.synced_version, message: result.error });
    }
    return json({ pending: true, error: result.error || "Votre carte est en préparation. Réessayez dans quelques instants." }, 202);
  } catch (e) {
    return json({ error: e instanceof WalletError ? e.message : "Impossible de préparer la carte Wallet." }, e instanceof WalletError ? e.status : 502);
  }
}
