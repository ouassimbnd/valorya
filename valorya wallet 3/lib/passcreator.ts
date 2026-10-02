const PASSCREATOR_BASE = "https://app.passcreator.com";

export type PasscreatorLinks = {
  identifier: string;
  downloadPage: string;
  appleUrl: string;
  googleUrl: string;
};

type TemplateField = {
  type?: string;
  key?: string;
  required?: boolean;
  label?: string;
};

type PasscreatorPass = {
  identifier?: string;
  userProvidedId?: string;
  linkToPassPage?: string;
  barcodeValue?: string | null;
};

export function passcreatorConfigured() {
  return Boolean(process.env.PASSCREATOR_API_KEY && process.env.PASSCREATOR_TEMPLATE_ID);
}

function config() {
  const apiKey = process.env.PASSCREATOR_API_KEY;
  const templateId = process.env.PASSCREATOR_TEMPLATE_ID;
  if (!apiKey || !templateId) throw new Error("Passcreator n’est pas configuré.");
  return { apiKey, templateId };
}

async function api(path: string, init: RequestInit = {}) {
  const { apiKey } = config();
  const headers = new Headers(init.headers);
  headers.set("Authorization", apiKey); // Passcreator attend la clé sans préfixe Bearer.
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${PASSCREATOR_BASE}${path}`, { ...init, headers, cache: "no-store" });
}

async function messageOf(response: Response) {
  const body = await response.clone().json().catch(() => null) as { description?: string; ErrorMessage?: string; errors?: unknown[] } | null;
  if (response.status === 401) return "Clé API Passcreator invalide ou sans accès à ce modèle.";
  if (response.status === 403) return "L’accès API Passcreator est bloqué pour ce compte. Vérifiez l’activation du compte et votre offre.";
  if (response.status === 404) return "Modèle Passcreator introuvable. Vérifiez PASSCREATOR_TEMPLATE_ID.";
  const detail = body?.ErrorMessage || body?.description;
  return detail || `Passcreator a répondu avec le code ${response.status}.`;
}

async function describeTemplate(): Promise<TemplateField[]> {
  const { templateId } = config();
  const response = await api(`/api/pass-template/${encodeURIComponent(templateId)}?zapierStyle=true`);
  if (!response.ok) throw new Error(await messageOf(response));
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data as TemplateField[] : [];
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || name, last: parts.slice(1).join(" ") || "" };
}

function valueForField(field: TemplateField, input: { customerName: string; businessName: string; email?: string | null; barcodeValue: string }) {
  const label = `${field.label || ""} ${field.key || ""}`.toLowerCase();
  const { first, last } = splitName(input.customerName);
  if (/barcode/.test(label)) return input.barcodeValue;
  if (/(first|prénom|prenom)/.test(label)) return first;
  if (/(last|nom de famille|surname)/.test(label)) return last || input.customerName;
  if (/(email|e-mail|mail)/.test(label)) return input.email || "";
  if (/(commerce|entreprise|company|business|retailer|merchant)/.test(label)) return input.businessName;
  if (/(status|statut|tier|niveau)/.test(label)) return "Membre";
  if (/(member|membre|client|name|nom)/.test(label)) return input.customerName;
  if (field.type === "datetime") return new Date().toISOString().slice(0, 16).replace("T", " ");
  return field.required ? input.customerName : undefined;
}

async function getDirectUris(identifier: string) {
  const response = await api(`/api/pass/geturis/${encodeURIComponent(identifier)}`);
  if (!response.ok) return { appleUrl: "", googleUrl: "" };
  const data = await response.json().catch(() => ({})) as { iPhoneUri?: string; AndroidUri?: string };
  return { appleUrl: data.iPhoneUri || "", googleUrl: data.AndroidUri || "" };
}

async function existingPass(userProvidedId: string): Promise<PasscreatorLinks | null> {
  const response = await api(`/api/pass/${encodeURIComponent(userProvidedId)}?zapierStyle=true`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await messageOf(response));
  const data = await response.json() as PasscreatorPass;
  if (!data.identifier) return null;
  const uris = await getDirectUris(data.identifier);
  return {
    identifier: data.identifier,
    downloadPage: data.linkToPassPage || `${PASSCREATOR_BASE}/p/${encodeURIComponent(userProvidedId)}`,
    ...uris,
  };
}

export async function passcreatorHealth() {
  if (!passcreatorConfigured()) return { configured: false, connected: false, error: "Variables Passcreator absentes." };
  try {
    await describeTemplate();
    return { configured: true, connected: true, error: "" };
  } catch (error) {
    return { configured: true, connected: false, error: error instanceof Error ? error.message : "Connexion Passcreator impossible." };
  }
}

/**
 * Crée au maximum un pass Passcreator par adhésion Valorya.
 * membershipId est utilisé comme identifiant externe unique et le QR contient uniquement
 * l’URL caisse avec le jeton aléatoire de la carte digitale.
 */
export async function createOrGetPass(input: {
  membershipId: string;
  barcodeValue: string;
  customerName: string;
  businessName: string;
  email?: string | null;
}): Promise<PasscreatorLinks> {
  const already = await existingPass(input.membershipId);
  if (already) return already;

  const { templateId } = config();
  const fields = await describeTemplate();
  const dynamic: Record<string, string> = {};
  for (const field of fields) {
    if (!field.key || field.key === "barcodeValue" || field.key === "userProvidedId" || field.key === "templateId") continue;
    const value = valueForField(field, input);
    if (typeof value === "string" && (value || field.required)) dynamic[field.key] = value;
  }

  const payload = {
    data: {
      templateId,
      userProvidedId: input.membershipId,
      enforceUniqueUserProvidedId: true,
      barcodeValue: input.barcodeValue,
      ...dynamic,
    },
  };

  const response = await api("/api/v3/pass?async=false", { method: "POST", body: JSON.stringify(payload) });
  if (!response.ok) {
    // Deux clics simultanés peuvent faire gagner une requête et provoquer le contrôle d’unicité.
    if (response.status === 400) {
      const existing = await existingPass(input.membershipId);
      if (existing) return existing;
    }
    throw new Error(await messageOf(response));
  }

  const json = await response.json() as {
    data?: { identifier?: string; downloadPage?: string; iPhoneUri?: string; androidUri?: string };
  };
  const data = json.data;
  if (!data?.identifier || !data.downloadPage) throw new Error("Passcreator n’a pas retourné de carte exploitable.");

  return {
    identifier: data.identifier,
    downloadPage: data.downloadPage,
    appleUrl: data.iPhoneUri || "",
    googleUrl: data.androidUri || "",
  };
}
