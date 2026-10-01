// Server-only. Ne jamais importer ce module depuis un composant client.
import { createSign } from "node:crypto";

export function googleWalletConfigured(): boolean {
  return ["GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL", "GOOGLE_WALLET_PRIVATE_KEY_BASE64", "APP_URL"].every(key => Boolean(process.env[key]));
}

export type GoogleWalletIdentity = { membershipId: string; cardToken: string; businessId: string; customerName: string; businessName: string; accentColor?: string | null };

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Construit le lien « Enregistrer dans Google Wallet » : un JWT signé (RS256) contenant la classe de carte du commerce
 * et la carte du client. Aucun solde n’y figure : le QR identifie le client, ses points restent dans son espace Valorya.
 */
export function createGoogleSaveUrl(identity: GoogleWalletIdentity): string {
  const origin = new URL(process.env.APP_URL!);
  if (origin.protocol !== "https:") throw new Error("APP_URL must use HTTPS");
  const issuer = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = Buffer.from(process.env.GOOGLE_WALLET_PRIVATE_KEY_BASE64!, "base64").toString("utf8");
  const classId = `${issuer}.valorya-${identity.businessId}`;
  const objectId = `${issuer}.${identity.membershipId}`;
  const background = identity.accentColor && HEX.test(identity.accentColor) ? identity.accentColor : "#0FA3A0";

  const payload = {
    iss: email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [origin.origin],
    payload: {
      loyaltyClasses: [{
        id: classId,
        issuerName: identity.businessName.slice(0, 40),
        programName: "Carte de fidélité",
        programLogo: { sourceUri: { uri: new URL("/wallet-logo.png", origin).href } },
        hexBackgroundColor: background,
        reviewStatus: "UNDER_REVIEW",
      }],
      loyaltyObjects: [{
        id: objectId,
        classId,
        state: "ACTIVE",
        accountId: identity.membershipId,
        accountName: identity.customerName.slice(0, 60),
        barcode: {
          type: "QR_CODE",
          value: new URL(`/business/caisse?card=${identity.cardToken}`, origin).href,
          alternateText: "À présenter en caisse",
        },
      }],
    },
  };
  const header = { alg: "RS256", typ: "JWT" };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `https://pay.google.com/gp/v/save/${unsigned}.${b64url(signature)}`;
}
