export const TRIAL_DAYS = 15;
export const BILLING_PLANS = [
  { id: "essentiel", name: "Essentiel", monthly: 19, yearly: 190, description: "La fidélité simple au quotidien", features: ["1 établissement", "Carte client sur le web et QR", "Points et récompenses", "Caisse, clients et statistiques", "Suivi des validations par caissier"] },
  { id: "wallet", name: "Wallet", monthly: 29, yearly: 290, description: "Votre commerce dans le téléphone du client", features: ["Tout Essentiel", "Apple Wallet et Google Wallet", "Prénom et points synchronisés", "Jusqu’à 200 cartes Wallet émises", "1 établissement"] },
] as const;
export type Plan = "essentiel" | "wallet";
export type Cycle = "month" | "year";
export function isPlan(p: unknown): p is Plan { return p === "essentiel" || p === "wallet"; }
export function isCycle(c: unknown): c is Cycle { return c === "month" || c === "year"; }
