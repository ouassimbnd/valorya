// Serveur uniquement. API versionnée, aucun SDK ni secret côté navigateur.
import { createHmac, timingSafeEqual } from "node:crypto";
export class BillingError extends Error { constructor(public status: number, message: string) { super(message); } }
export const STRIPE_VERSION = "2025-03-31.basil";
export function stripeReady() { return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.APP_URL); }
export function appOrigin() {
  const u = new URL(process.env.APP_URL || "invalid");
  if (u.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && u.hostname === "localhost")) throw new BillingError(503, "Adresse du service de paiement non configurée.");
  return u.origin;
}
export async function stripe<T>(path: string, method = "GET", data?: Record<string, string>, idempotency?: string): Promise<T> {
  if (!process.env.STRIPE_SECRET_KEY) throw new BillingError(503, "Le paiement n’est pas encore activé.");
  let response: Response;
  try {
    response = await fetch("https://api.stripe.com/v1" + path, {
      method, cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Stripe-Version": STRIPE_VERSION,
        ...(data ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(idempotency ? { "Idempotency-Key": idempotency } : {}) },
      ...(data ? { body: new URLSearchParams(data) } : {}),
    });
  } catch { throw new BillingError(503, "Le paiement ne répond pas. Réessayez dans un instant."); }
  if (!response.ok) throw new BillingError(503, "Stripe n’a pas pu terminer la demande. Vérifiez la configuration ou réessayez.");
  return response.json();
}
export type StripeEvent = { id: string; type: string; livemode: boolean; data: { object: { customer?: string | {id:string}; [key:string]:unknown } } };
export function verifyStripeEvent(raw: string, signature: string | null, now = Date.now()): StripeEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new BillingError(503, "Webhook non configuré.");
  const parts = (signature || "").split(",").map(p => p.split("="));
  const timestamps = parts.filter(p=>p[0]==="t");
  const timestamp = timestamps.length === 1 ? Number(timestamps[0][1]) : NaN;
  if (!Number.isInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300) throw new BillingError(400, "Signature expirée ou invalide.");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  const valid = parts.filter(p=>p[0]==="v1" && /^[a-f0-9]{64}$/.test(p[1] || "")).some(p=>timingSafeEqual(Buffer.from(p[1],"hex"),expected));
  if (!valid) throw new BillingError(400, "Signature invalide.");
  let event: StripeEvent; try { event = JSON.parse(raw); } catch { throw new BillingError(400, "Événement invalide."); }
  if (!event.id || !event.type || !event.data?.object) throw new BillingError(400, "Événement invalide.");
  const live = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  if (event.livemode !== live) throw new BillingError(400, "Mode Stripe incohérent.");
  return event;
}
