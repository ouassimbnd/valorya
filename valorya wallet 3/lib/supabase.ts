import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let instance: SupabaseClient | null = null;
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function supabase() {
  if (!configured) throw new Error("Supabase n’est pas configuré. Ajoutez les deux variables NEXT_PUBLIC_SUPABASE_* dans Vercel.");
  if (!instance) {
    instance = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return instance;
}

/** Messages d’erreur lisibles : les erreurs techniques de la base et du réseau sont traduites. */
const FRIENDLY: [RegExp, string][] = [
  [/failed to fetch|networkerror|load failed|network request failed/i, "Connexion impossible. Vérifiez votre réseau puis réessayez."],
  [/jwt expired|invalid jwt|refresh token/i, "Votre session a expiré. Reconnectez-vous."],
  [/invalid login credentials/i, "Email ou mot de passe incorrect."],
  [/email not confirmed/i, "Confirmez d’abord votre adresse email grâce au lien reçu à l’inscription."],
  [/user already registered|already been registered/i, "Un compte existe déjà avec cet email. Connectez-vous."],
  [/rate limit|only request this after|too many requests/i, "Trop de tentatives. Patientez une minute avant de réessayer."],
  [/token has expired or is invalid|otp.*expired|invalid.*otp/i, "Code invalide ou expiré. Demandez-en un nouveau."],
  [/businesses_slug_key|duplicate key.*slug/i, "Cette adresse de page est déjà utilisée. Choisissez-en une autre."],
  [/un commerce existe déjà/i, "Un commerce existe déjà pour ce compte."],
  [/passage déjà enregistré/i, "Ce client vient déjà d’être validé il y a moins de 10 minutes. Réessayez dans quelques instants."],
  [/points insuffisants/i, "Ce client n’a pas assez de points pour cette récompense."],
  [/carte indisponible/i, "Cette carte n’est plus disponible : elle est déjà associée, désactivée ou appartient à un autre commerce."],
  [/aucune visite à évaluer/i, "Une nouvelle visite est nécessaire avant de laisser un avis."],
  [/accès refusé/i, "Action non autorisée avec ce compte."],
];

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  if (!raw) return "Une erreur est survenue. Réessayez.";
  for (const [pattern, text] of FRIENDLY) if (pattern.test(raw)) return text;
  return raw;
}
