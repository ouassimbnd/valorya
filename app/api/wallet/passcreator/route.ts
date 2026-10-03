import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOrGetPass, passcreatorConfigured } from "@/lib/passcreator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: noCache });

export async function GET() {
  return json({ configured: passcreatorConfigured() });
}

export async function POST(request: NextRequest) {
  if (!passcreatorConfigured()) return json({ error: "Wallet non configuré. Ajoutez PASSCREATOR_API_KEY et PASSCREATOR_TEMPLATE_ID dans Vercel." }, 503);

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: "Connectez-vous pour ajouter votre carte." }, 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase n’est pas configuré." }, 503);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Demande invalide." }, 400); }
  const membershipId = (body as { membershipId?: unknown })?.membershipId;
  if (typeof membershipId !== "string" || !UUID.test(membershipId)) return json({ error: "Carte invalide." }, 400);

  try {
    // Le JWT de l’utilisateur est réutilisé : toutes les lectures passent encore par les RLS Supabase.
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return json({ error: "Votre session a expiré. Reconnectez-vous." }, 401);

    const { data: customer, error: customerError } = await client
      .from("customers")
      .select("id,display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return json({ error: "Profil client introuvable." }, 404);

    const { data: membership, error: membershipError } = await client
      .from("memberships")
      .select("id,card_token,program:programs(business:businesses(name))")
      .eq("id", membershipId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Carte introuvable." }, 404);
    if (!membership.card_token) return json({ error: "Jeton de carte manquant. Exécutez la migration upgrade-digital-cards-wallet.sql." }, 409);

    const program = membership.program as unknown as { business: { name: string } } | null;
    if (!program?.business?.name) return json({ error: "Programme indisponible." }, 404);

    const baseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");
    const barcodeValue = `${baseUrl}/business/caisse?card=${membership.card_token}`;
    const pass = await createOrGetPass({
      membershipId: membership.id,
      barcodeValue,
      customerName: customer.display_name,
      businessName: program.business.name,
      email: user.email,
    });

    return json({
      url: pass.downloadPage,
      appleUrl: pass.appleUrl || pass.downloadPage,
      googleUrl: pass.googleUrl || pass.downloadPage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de préparer la carte Wallet.";
    return json({ error: message }, 502);
  }
}
