/** Règles de fidélité et petits utilitaires communs (aucune dépendance, utilisables partout). */
export const POINTS_PER_VISIT = 10;
export const POINTS_PER_FEEDBACK = 5;
export const VISIT_COOLDOWN_MINUTES = 10;

export type RewardLite = { id: string; name: string; points_cost: number };

/** Solde = visites × 10 + avis × 5 − points dépensés. Identique aux fonctions SQL. */
export function computePoints(visits: number, feedback: number, spent: number): number {
  return Math.max(0, visits * POINTS_PER_VISIT + feedback * POINTS_PER_FEEDBACK - spent);
}

/** Prochaine récompense à atteindre (ou la plus chère si toutes sont déjà accessibles). */
export function nextReward<T extends RewardLite>(rewards: T[], points: number): { reward: T | null; remaining: number; ready: boolean } {
  const sorted = [...rewards].sort((a, b) => a.points_cost - b.points_cost);
  if (!sorted.length) return { reward: null, remaining: 0, ready: false };
  const upcoming = sorted.find(r => r.points_cost > points);
  if (upcoming) {
    const affordable = sorted.some(r => r.points_cost <= points);
    return { reward: upcoming, remaining: upcoming.points_cost - points, ready: affordable };
  }
  return { reward: sorted[sorted.length - 1], remaining: 0, ready: true };
}

export function visitsFor(points: number): number {
  return Math.max(1, Math.ceil(points / POINTS_PER_VISIT));
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${Math.abs(n) > 1 ? many : one}`;
}

export function percent(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export function initials(name: string): string {
  const clean = (name || "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toUpperCase()).join("");
}

export function normalizeText(value: string): string {
  return (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function slugify(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && HEX.test(value) ? value : fallback;
}

/** Assombrit (amount < 0) ou éclaircit (amount > 0) une couleur hexadécimale, amount entre -1 et 1. */
export function shade(hex: string, amount: number): string {
  const color = safeColor(hex, "#109B81").slice(1);
  const channels = [0, 2, 4].map(i => parseInt(color.slice(i, i + 2), 16));
  const mixed = channels.map(c => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount));
  return "#" + mixed.map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("");
}

export function withAlpha(hex: string, alpha: number): string {
  const color = safeColor(hex, "#109B81").slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(color.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatDate(value: string | Date, withTime = false): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return withTime
    ? date.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function relativeTime(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return formatDate(date);
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function csvCell(value: string | number): string {
  const text = String(value ?? "");
  // Neutralise l'injection de formules dans les tableurs.
  const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return /[",;\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}
