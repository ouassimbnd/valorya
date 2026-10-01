import type { IconName } from "@/lib/business-types";

/** Jeu d’icônes trait fin (24×24), cohérent dans toute l’application. */
const PATHS: Record<string, string> = {
  overview: "M4 4h6v7H4z M14 4h6v4h-6z M14 12h6v8h-6z M4 15h6v5H4z",
  cash: "M3 6h18v12H3z M3 10h18 M7 15h3",
  users: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20 M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35 M15.5 5.2a3.5 3.5 0 0 1 0 6.6",
  gift: "M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-2.5 0-4-1-4-2.5S9.5 2.5 12 7z M12 7c2.5 0 4-1 4-2.5S14.5 2.5 12 7z",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z",
  wallet: "M4 7a2 2 0 0 1 2-2h12v3 M4 7v11a2 2 0 0 0 2 2h14V8H6a2 2 0 0 1-2-1z M16 14h2",
  team: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1 M17 8h4 M19 6v4",
  store: "M4 9l1.5-5h13L20 9 M4 9h16v1a3 3 0 0 1-6 0 3 3 0 0 1-4 0 3 3 0 0 1-6 0z M5 13v7h14v-7 M10 20v-4h4v4",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M8.1 7.9L20 18 M8.1 16.1L20 6",
  utensils: "M6 3v7a2 2 0 0 0 2 2v9 M10 3v7 M6 3v7 M18 21V3c-2 1-3.5 3.5-3.5 7 0 1.5 1 2.5 3.5 2.5",
  coffee: "M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z M17 10h1.5a2.5 2.5 0 0 1 0 5H17 M8 3v3 M12 3v3",
  bread: "M5 11a4 4 0 0 1 3-6.5h8A4 4 0 0 1 19 11v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M9 9l1.5 3 M13 9l1.5 3",
  perfume: "M8 11h8v9H8z M10 11V8h4v3 M11 8V5h2v3 M8 15h8",
  bag: "M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14 M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4",
  scan: "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M4 12h16",
  arrow: "M7 17L17 7 M8 7h9v9",
  back: "M15 5l-7 7 7 7",
  logout: "M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4 M16 8l4 4-4 4 M20 12H9",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  star: "M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z",
  copy: "M9 9h10v11H9z M5 15V4h10",
  print: "M7 9V4h10v5 M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2 M7 14h10v6H7z",
  share: "M12 4v11 M8 8l4-4 4 4 M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6",
  download: "M12 4v11 M8 11l4 4 4-4 M5 20h14",
  card: "M3 6h18v12H3z M3 10h18 M6 15h4",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 18h2",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  history: "M4 12a8 8 0 1 0 2.5-5.8L4 8 M4 4v4h4 M12 8v4l3 2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 20a8 8 0 0 1 16 0",
  alert: "M12 4l9 16H3z M12 10v4 M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01",
  trash: "M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  more: "M6 12h.01 M12 12h.01 M18 12h.01",
};

export type IconKey = keyof typeof PATHS | IconName;

export function Icon({ name, size = 20, strokeWidth = 1.7 }: { name: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] || PATHS.card} />
    </svg>
  );
}
