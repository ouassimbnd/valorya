import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { googleWalletConfigured, createGoogleSaveUrl } from "@/lib/google-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: noCache });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() { return json({ configured: googleWalletConfigured() }, 200); }

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: "Connectez-vous pour ajouter votre carte." }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json({ error: "Service indisponible." }, 503);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Demande invalide." }, 400); }
  const id = (body as { membershipId?: unknown })?.membershipId;
  if (typeof id !== "string" || !UUID.test(id)) return json({ error: "Carte invalide." }, 400);
  try {
    // Le jeton du client s’applique à chaque requête : la sécurité par ligne (RLS) reste en vigueur.
    const c = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await c.auth.getUser(token);
    if (authError || !user) return json({ error: "Votre session a expiré. Reconnectez-vous." }, 401);
    const { data: customer, error: ce } = await c.from("customers").select("id,display_name").eq("auth_user_id", user.id).maybeSingle();
    if (ce) throw ce;
    if (!customer) return json({ error: "Carte introuvable." }, 404);
    const { data: m, error: me } = await c.from("memberships").select("id,card_token,program:programs(business:businesses(id,name,accent_color))").eq("id", id).eq("customer_id", customer.id).maybeSingle();
    if (me) throw me;
    if (!m) return json({ error: "Carte introuvable." }, 404);
    if (!googleWalletConfigured()) return json({ error: "Google Wallet n’est pas encore activé par Valorya. Votre carte reste disponible dans votre espace." }, 503);
    const program = m.program as unknown as { business: { id: string; name: string; accent_color: string | null } } | null;
    if (!program?.business) return json({ error: "Ce programme n’est plus disponible." }, 404);
    const saveUrl = createGoogleSaveUrl({
      membershipId: m.id, cardToken: m.card_token, businessId: program.business.id, customerName: customer.display_name,
      businessName: program.business.name, accentColor: program.business.accent_color,
    });
    return json({ url: saveUrl }, 200);
  } catch {
    return json({ error: "Impossible de générer la carte. Réessayez ou contactez Valorya." }, 500);
  }
}
