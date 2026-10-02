import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deletePass, PasscreatorError, syncPass, type PasscreatorLinks, type WalletSnapshot } from "./passcreator";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class WalletError extends Error { constructor(public status: number, message: string) { super(message); } }
export function walletAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new WalletError(503, "La configuration serveur Wallet est incomplète.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function publicClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new WalletError(503, "Le service client est indisponible.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}) });
}
export async function authorizeWallet(request: Request, body: unknown): Promise<string> {
  if (!body || typeof body !== "object") throw new WalletError(400, "Demande invalide.");
  const { membershipId, accessToken } = body as { membershipId?: unknown; accessToken?: unknown };
  if (accessToken !== undefined) {
    if (typeof accessToken !== "string" || !UUID.test(accessToken)) throw new WalletError(400, "Carte invalide.");
    const result = await publicClient().rpc("public_card_view", { p_token: accessToken });
    if (result.error) throw new WalletError(503, "La carte client est momentanément indisponible.");
    if (!result.data?.membership_id || !UUID.test(result.data.membership_id)) throw new WalletError(404, "Carte introuvable.");
    return result.data.membership_id; // Ignore all supplied names, points and membershipId.
  }
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) throw new WalletError(401, "Reconnectez-vous pour accéder à la carte.");
  if (typeof membershipId !== "string" || !UUID.test(membershipId)) throw new WalletError(400, "Carte invalide.");
  const client = publicClient(bearer);
  const { data: { user }, error } = await client.auth.getUser(bearer);
  if (error || !user) throw new WalletError(401, "Votre session a expiré. Reconnectez-vous.");
  const found = await client.from("memberships").select("id,customer:customers(auth_user_id),program:programs(business:businesses(owner_id))").eq("id", membershipId).maybeSingle();
  if (found.error || !found.data) throw new WalletError(404, "Carte introuvable.");
  const data = found.data as unknown as { customer: { auth_user_id: string } | null; program: { business: { owner_id: string } | null } | null };
  if (data.customer?.auth_user_id !== user.id && data.program?.business?.owner_id !== user.id) throw new WalletError(404, "Carte introuvable.");
  return membershipId;
}
export type WalletRow = {
  membership_id: string; provider_id: string | null; template_id: string | null;
  download_page: string | null; apple_url: string | null; google_url: string | null;
  desired_version: number; synced_version: number; lock_token: string; operation: "sync" | "delete";
  last_error: string | null; synced_at: string | null;
};
function databaseError() { return new WalletError(503, "La synchronisation Wallet est indisponible. Vérifiez l’installation SQL Wallet."); }
export async function readWallet(admin: SupabaseClient, membershipId: string): Promise<WalletRow | null> {
  const r = await admin.from("wallet_passes").select("*").eq("membership_id", membershipId).maybeSingle();
  if (r.error) throw databaseError();
  return r.data;
}
export async function assertWalletPlan(admin: SupabaseClient, membershipId: string) {
  const r = await admin.rpc("billing_wallet_access", { p_membership: membershipId });
  if (r.error) throw new WalletError(503, "Vérifiez l’installation des abonnements.");
  if (!r.data) throw new WalletError(403, "L’ajout au Wallet nécessite un forfait Wallet actif pour ce commerce.");
}
export async function requestWallet(admin: SupabaseClient, membershipId: string) {
  await assertWalletPlan(admin, membershipId);
  const reservation = await admin.rpc("billing_reserve_wallet", { p_membership: membershipId });
  if (reservation.error) throw new WalletError(409, "La carte Wallet ne peut pas être réservée. Vérifiez le forfait et la limite de 200 cartes auprès du commerce.");
  const r = await admin.rpc("wallet_request_pass", { p_membership: membershipId });
  if (r.error) throw databaseError();
}
export type SyncResult = { status: "idle" | "synced" | "pending" | "deleted"; error?: string };
export async function processWalletJob(admin: SupabaseClient, membershipId?: string): Promise<SyncResult> {
  const claim = await admin.rpc("wallet_claim_job", { p_membership: membershipId || null });
  if (claim.error) throw databaseError();
  const job = claim.data as WalletRow | null;
  if (!job) return { status: "idle" };
  let links: PasscreatorLinks | null = null, deleted = false, errorCode: string | null = null, errorMessage: string | undefined;
  try {
    const snapshot = await admin.rpc("wallet_snapshot", { p_membership: job.membership_id });
    if (snapshot.error) throw databaseError();
    const data = snapshot.data as WalletSnapshot | null;
    if (job.operation === "delete" || !data || !data.active) {
      // External ID also recovers a creation whose response was lost before provider_id was saved.
      await deletePass(job.provider_id || job.membership_id);
      deleted = !data || job.operation === "delete";
    } else {
      await assertWalletPlan(admin, job.membership_id);
      const known = job.provider_id && job.download_page && job.template_id ? {
        identifier: job.provider_id, templateId: job.template_id, downloadPage: job.download_page,
        appleUrl: job.apple_url || "", googleUrl: job.google_url || "",
      } : undefined;
      links = await syncPass(data, known);
    }
  } catch (e) {
    errorCode = e instanceof PasscreatorError ? e.code : "sync_unavailable";
    errorMessage = e instanceof PasscreatorError ? e.message : "La carte sera actualisée dès que le service sera disponible.";
  }
  const finish = await admin.rpc("wallet_finish_job", {
    p_membership: job.membership_id, p_lock: job.lock_token, p_version: job.desired_version,
    p_links: links, p_error: errorCode, p_deleted: deleted,
  });
  if (finish.error) throw databaseError();
  if (!finish.data) return { status: "pending" };
  return errorCode ? { status: "pending", error: errorMessage } : { status: deleted ? "deleted" : "synced" };
}
