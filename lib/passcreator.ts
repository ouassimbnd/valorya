// Server-only integration. Never import this module into a client component.
const BASE = "https://app.passcreator.com";
export type PasscreatorLinks = { identifier: string; templateId: string; downloadPage: string; appleUrl: string; googleUrl: string };
export type WalletSnapshot = {
  membershipId: string; businessId: string; cardToken: string; active: boolean;
  customerName: string; firstName: string; lastName: string; email: string;
  businessName: string; joinedAt: string; points: number;
  rewards: { name: string; points_cost: number }[];
};
export type TemplateField = { key?: string; label?: string; type?: string; required?: boolean };
export class PasscreatorError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "PasscreatorError"; }
}
export function passcreatorConfigured() {
  return Boolean(process.env.PASSCREATOR_API_KEY && process.env.PASSCREATOR_TEMPLATE_ID);
}
export function walletServerConfigured() {
  return passcreatorConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}
function config() {
  if (!passcreatorConfigured()) throw new PasscreatorError("configuration", "Le service Wallet n’est pas configuré.");
  return { apiKey: process.env.PASSCREATOR_API_KEY!, templateId: process.env.PASSCREATOR_TEMPLATE_ID! };
}
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", config().apiKey);
  if (init.body) headers.set("Content-Type", "application/json");
  try {
    return await fetch(BASE + path, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    throw new PasscreatorError("network", "Passcreator ne répond pas pour le moment. La mise à jour sera réessayée.");
  }
}
function providerError(status: number): PasscreatorError {
  if (status === 401 || status === 403) return new PasscreatorError("provider_access", "L’accès Passcreator doit être vérifié par l’administrateur.");
  if (status === 404) return new PasscreatorError("template_missing", "Le modèle Wallet est introuvable.");
  if (status === 429) return new PasscreatorError("rate_limit", "Le service Wallet est occupé. Réessayez dans quelques instants.");
  return new PasscreatorError("provider_error", "Le service Wallet n’a pas pu terminer la demande. La mise à jour sera réessayée.");
}
async function checkedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw providerError(response.status);
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object" || data.success === false || Number(data.statusCode || 200) >= 400) throw providerError(Number(data?.statusCode) || 502);
  return data;
}
// Positive cache only, isolated by API key + template. Never cache a configuration failure.
let templateCache: { identity: string; expires: number; fields: TemplateField[] } | undefined;
export async function describeTemplate(templateId = config().templateId): Promise<TemplateField[]> {
  const identity = config().apiKey + ":" + templateId;
  if (templateCache?.identity === identity && templateCache.expires > Date.now()) return templateCache.fields;
  const response = await api(`/api/pass-template/${encodeURIComponent(templateId)}?zapierStyle=true`);
  if (!response.ok) throw providerError(response.status);
  const fields = await response.json().catch(() => null);
  if (!Array.isArray(fields)) throw new PasscreatorError("template_fields", "Les champs du modèle Wallet sont indisponibles.");
  templateCache = { identity, expires: Date.now() + 60_000, fields };
  return fields;
}
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  prenom: ["prenom", "firstname", "givenname"],
  nom: ["nom", "lastname", "surname", "nomdefamille"],
  nom_complet: ["nomcomplet", "fullname", "name", "member", "membre", "client", "customername"],
  commerce: ["commerce", "business", "businessname", "merchant", "retailer", "company", "entreprise"],
  points: ["points", "mespoints", "solde", "balance", "pointbalance", "loyaltypoints"],
  avantage: ["avantage", "prochainavantage", "reward", "nextreward", "recompense"],
  points_restants: ["pointsrestants", "remainingpoints"],
  statut: ["statut", "status", "tier", "niveau"],
  identifiant_carte: ["identifiantcarte", "cardid", "id", "memberid", "membershipid"],
  email: ["email", "mail", "emailaddress"],
};
export function personalValues(input: WalletSnapshot): Record<string, string | number> {
  if (!Number.isSafeInteger(input.points) || input.points < 0) throw new PasscreatorError("invalid_snapshot", "Solde de points indisponible.");
  const sorted = [...input.rewards].sort((a, b) => a.points_cost - b.points_cost);
  const available = sorted.filter(r => r.points_cost <= input.points).at(-1);
  const upcoming = sorted.find(r => r.points_cost > input.points);
  const reward = available || upcoming;
  return {
    prenom: input.firstName || input.customerName, nom: input.lastName || "", nom_complet: input.customerName,
    commerce: input.businessName, points: input.points,
    avantage: reward ? `${reward.name} · ${available ? "disponible" : `à ${reward.points_cost} points`}` : "Découvrez les avantages en boutique",
    points_restants: available ? 0 : Math.max(0, (upcoming?.points_cost || 0) - input.points),
    statut: "Membre", identifiant_carte: input.membershipId, email: input.email || "",
  };
}
const reserved = new Set(["templateId", "userProvidedId", "enforceUniqueUserProvidedId", "barcodeValue", "storedValue", "barcodeAlternativeText", "__proto__", "constructor", "prototype"]);
export function mapTemplateFields(fields: TemplateField[], input: WalletSnapshot) {
  const values = personalValues(input);
  let explicit: Record<string, string> = {};
  if (process.env.PASSCREATOR_FIELD_MAP) {
    try { explicit = JSON.parse(process.env.PASSCREATOR_FIELD_MAP); } catch { throw new PasscreatorError("field_mapping", "PASSCREATOR_FIELD_MAP n’est pas un objet JSON valide."); }
    if (!explicit || typeof explicit !== "object" || Array.isArray(explicit)) throw new PasscreatorError("field_mapping", "Correspondance des champs Wallet invalide.");
    for (const [key, value] of Object.entries(explicit)) {
      if (reserved.has(key) || typeof value !== "string" || !Object.hasOwn(values, value)) throw new PasscreatorError("field_mapping", "Correspondance des champs Wallet invalide.");
    }
  }
  const output: Record<string, string | number> = {};
  const matched = new Set<string>();
  for (const field of fields) {
    if (!field.key || reserved.has(field.key)) continue;
    const names = [normalize(field.label || ""), normalize(field.key.replace(/^(?:header|primary|secondary|auxiliary|back)Fields_\d+_/i, ""))];
    const key = explicit[field.key] || Object.keys(aliases).find(k => names.some(n => aliases[k].includes(n)));
    if (!key) {
      if (field.required) throw new PasscreatorError("field_mapping", "Un champ obligatoire du modèle n’est pas relié à Valorya. Consultez le guide de personnalisation.");
      continue;
    }
    output[field.key] = values[key]; matched.add(key);
  }
  // Avoid delivering a card that silently omits the customer's name, business or live balance.
  if (!matched.has("points") || !matched.has("commerce") || !(matched.has("prenom") || matched.has("nom_complet"))) {
    throw new PasscreatorError("field_mapping", "Ajoutez les champs prenom, commerce et points au modèle Passcreator, puis publiez-le.");
  }
  return output;
}
const safeUrl = (value: unknown): string => {
  if (typeof value !== "string") return "";
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
};
async function getExisting(membershipId: string, templateId: string): Promise<PasscreatorLinks | null> {
  const response = await api(`/api/pass/${encodeURIComponent(membershipId)}?zapierStyle=true`);
  if (response.status === 404) return null;
  const data = await checkedJson(response);
  if (typeof data.identifier !== "string") throw new PasscreatorError("invalid_response", "Réponse Wallet incomplète.");
  const downloadPage = safeUrl(data.linkToPassPage || data.downloadPage);
  if (!downloadPage) throw new PasscreatorError("invalid_response", "Le lien de la carte Wallet est indisponible.");
  // Never invent a /p/{membershipId} link: only use URLs returned by Passcreator.
  return { identifier: data.identifier, templateId, downloadPage, appleUrl: "", googleUrl: "" };
}
export async function syncPass(input: WalletSnapshot, known?: PasscreatorLinks): Promise<PasscreatorLinks> {
  const templateId = known?.templateId || config().templateId;
  const fields = await describeTemplate(templateId);
  const properties = mapTemplateFields(fields, input);
  const data = { ...properties, barcodeValue: `card:${input.cardToken}`, storedValue: input.points };
  let existing = known || await getExisting(input.membershipId, templateId);
  if (existing) {
    const response = await api(`/api/v3/pass/${encodeURIComponent(existing.identifier)}?async=false`, { method: "PATCH", body: JSON.stringify({ data }) });
    if (response.status !== 404) { await checkedJson(response); return existing; }
    existing = null; // Deleted externally; recreating uses the same unique external identifier.
  }
  const response = await api("/api/v3/pass?async=false", {
    method: "POST", body: JSON.stringify({ data: { ...data, templateId, userProvidedId: input.membershipId, enforceUniqueUserProvidedId: true } }),
  });
  if (response.status === 400 || response.status === 409) {
    // A previous timed-out creation may have succeeded, or an older instance raced this one.
    const recovered = await getExisting(input.membershipId, templateId);
    if (recovered) {
      await checkedJson(await api(`/api/v3/pass/${encodeURIComponent(recovered.identifier)}?async=false`, { method: "PATCH", body: JSON.stringify({ data }) }));
      return recovered;
    }
  }
  const body = await checkedJson(response);
  const result = body.data as Record<string, unknown> | undefined;
  if (!result || typeof result.identifier !== "string" || !safeUrl(result.downloadPage)) throw new PasscreatorError("invalid_response", "La carte Wallet ne contient pas de lien utilisable.");
  return { identifier: result.identifier, templateId, downloadPage: safeUrl(result.downloadPage), appleUrl: safeUrl(result.iPhoneUri), googleUrl: safeUrl(result.androidUri) };
}
export async function deletePass(identifier: string) {
  const response = await api(`/api/v3/pass/${encodeURIComponent(identifier)}`, { method: "DELETE" });
  if (response.status === 404 || response.status === 204) return;
  await checkedJson(response);
}
export async function passcreatorHealth() {
  if (!walletServerConfigured()) return { configured: false, connected: false, error: "Configuration serveur Wallet incomplète." };
  try { await describeTemplate(); return { configured: true, connected: true, error: "" }; }
  catch (e) { return { configured: true, connected: false, error: e instanceof PasscreatorError ? e.message : "Service Wallet indisponible." }; }
}
