/** Types de commerce : vocabulaire, récompenses suggérées et repères adaptés à chaque métier. */
import { normalizeText } from "./loyalty";

export type TypeKey = "coiffeur" | "restaurant" | "cafe" | "boulangerie" | "parfumerie" | "boutique" | "institut" | "autre";
export type IconName = "scissors" | "utensils" | "coffee" | "bread" | "perfume" | "bag" | "sparkle" | "store";

export type BusinessType = {
  key: TypeKey;
  /** Libellé enregistré dans businesses.category et affiché aux clients. */
  label: string;
  short: string;
  icon: IconName;
  emoji: string;
  logos: string[];
  /** Ce que le client fait à chaque passage. */
  visit: { one: string; many: string; action: string; done: string; article: string };
  team: { one: string; many: string; placeholder: string; title: string };
  pitch: string;
  rewards: { name: string; points: number }[];
  hoursHint: string;
  descriptionHint: string;
};

export const BUSINESS_TYPES: BusinessType[] = [
  {
    key: "coiffeur", label: "Coiffeur / Barbier", short: "Coiffeur", icon: "scissors", emoji: "✂️",
    logos: ["✂️", "💈", "💇", "🪒", "✨"],
    visit: { one: "rendez-vous", many: "rendez-vous", action: "Valider le rendez-vous", done: "Rendez-vous validé", article: "un" },
    team: { one: "coiffeur·se", many: "coiffeurs·ses", placeholder: "Prénom du coiffeur ou de la coiffeuse", title: "Votre équipe" },
    pitch: "Chaque rendez-vous vous rapproche d’un soin ou d’une coupe offerte.",
    rewards: [{ name: "Soin capillaire offert", points: 30 }, { name: "Brushing offert", points: 50 }, { name: "Coupe offerte", points: 100 }],
    hoursHint: "Mar–Ven 9h–19h, Sam 9h–17h (sur rendez-vous)",
    descriptionHint: "Salon de coiffure mixte au cœur du quartier. Coupes, couleurs et soins, sur rendez-vous.",
  },
  {
    key: "restaurant", label: "Restaurant / Brasserie", short: "Restaurant", icon: "utensils", emoji: "🍽️",
    logos: ["🍽️", "🍝", "🍕", "🥘", "🍷"],
    visit: { one: "repas", many: "repas", action: "Valider le passage", done: "Passage validé", article: "un" },
    team: { one: "serveur·se", many: "serveurs·ses", placeholder: "Prénom du serveur ou de la serveuse", title: "Votre équipe en salle" },
    pitch: "Chaque repas compte : dessert, plat ou menu offert dès quelques passages.",
    rewards: [{ name: "Café ou thé offert", points: 30 }, { name: "Dessert offert", points: 60 }, { name: "Plat offert", points: 120 }],
    hoursHint: "Midi 12h–14h30, soir 19h–22h30, fermé le dimanche",
    descriptionHint: "Cuisine de saison, produits frais et ambiance chaleureuse. Réservation conseillée.",
  },
  {
    key: "cafe", label: "Café / Salon de thé", short: "Café", icon: "coffee", emoji: "☕",
    logos: ["☕", "🍵", "🧁", "🥐", "🫖"],
    visit: { one: "passage", many: "passages", action: "Valider le passage", done: "Passage validé", article: "un" },
    team: { one: "serveur·se", many: "serveurs·ses", placeholder: "Prénom du barista ou du serveur", title: "Votre équipe" },
    pitch: "À chaque passage, vos habitudes deviennent des cafés offerts.",
    rewards: [{ name: "Viennoiserie offerte", points: 40 }, { name: "Boisson offerte", points: 80 }, { name: "Petit-déjeuner offert", points: 150 }],
    hoursHint: "Lun–Sam 7h30–18h, dimanche 9h–13h",
    descriptionHint: "Café de quartier, torréfaction locale et pâtisseries maison.",
  },
  {
    key: "boulangerie", label: "Boulangerie / Pâtisserie", short: "Boulangerie", icon: "bread", emoji: "🥖",
    logos: ["🥖", "🥐", "🍞", "🎂", "🧁"],
    visit: { one: "passage", many: "passages", action: "Valider le passage", done: "Passage validé", article: "un" },
    team: { one: "vendeur·se", many: "vendeurs·ses", placeholder: "Prénom du vendeur ou de la vendeuse", title: "Votre équipe de vente" },
    pitch: "Vos passages du matin se transforment en gourmandises offertes.",
    rewards: [{ name: "Viennoiserie offerte", points: 50 }, { name: "Pâtisserie offerte", points: 80 }, { name: "Formule déjeuner offerte", points: 120 }],
    hoursHint: "Mar–Sam 6h30–19h30, dimanche 7h–13h",
    descriptionHint: "Pain au levain, viennoiseries et pâtisseries faites maison chaque jour.",
  },
  {
    key: "parfumerie", label: "Parfumerie / Cosmétique", short: "Parfumerie", icon: "perfume", emoji: "🌸",
    logos: ["🌸", "🧴", "✨", "💐", "🕯️"],
    visit: { one: "achat", many: "achats", action: "Valider l’achat", done: "Achat validé", article: "un" },
    team: { one: "conseiller·ère", many: "conseillers·ères", placeholder: "Prénom du conseiller ou de la conseillère", title: "Vos conseillers de vente" },
    pitch: "Chaque achat vous rapproche d’un échantillon, d’une miniature ou d’un coffret.",
    rewards: [{ name: "Échantillon premium offert", points: 30 }, { name: "Miniature offerte", points: 80 }, { name: "Coffret découverte offert", points: 150 }],
    hoursHint: "Lun–Sam 10h–19h",
    descriptionHint: "Parfums de créateurs, soins et cosmétiques sélectionnés avec conseil personnalisé.",
  },
  {
    key: "boutique", label: "Boutique / Concept store", short: "Boutique", icon: "bag", emoji: "🛍️",
    logos: ["🛍️", "👗", "👜", "👟", "🎁"],
    visit: { one: "achat", many: "achats", action: "Valider l’achat", done: "Achat validé", article: "un" },
    team: { one: "vendeur·se", many: "vendeurs·ses", placeholder: "Prénom du vendeur ou de la vendeuse", title: "Votre équipe de vente" },
    pitch: "Vos achats vous rapportent des avantages à utiliser en boutique.",
    rewards: [{ name: "Cadeau surprise offert", points: 50 }, { name: "5 € de remise sur votre prochain achat", points: 80 }, { name: "15 € de remise sur votre prochain achat", points: 150 }],
    hoursHint: "Mar–Sam 10h–19h, dimanche 11h–17h",
    descriptionHint: "Sélection de mode et d’objets pour la maison, choisis avec soin.",
  },
  {
    key: "institut", label: "Institut / Spa / Onglerie", short: "Institut", icon: "sparkle", emoji: "💅",
    logos: ["💅", "🧖", "🌿", "💆", "✨"],
    visit: { one: "rendez-vous", many: "rendez-vous", action: "Valider le rendez-vous", done: "Rendez-vous validé", article: "un" },
    team: { one: "praticien·ne", many: "praticiens·nes", placeholder: "Prénom du ou de la praticien·ne", title: "Votre équipe" },
    pitch: "À chaque rendez-vous, un pas de plus vers un soin offert.",
    rewards: [{ name: "Pose de vernis offerte", points: 40 }, { name: "Massage 20 min offert", points: 100 }, { name: "Soin visage offert", points: 150 }],
    hoursHint: "Mar–Sam 9h30–19h (sur rendez-vous)",
    descriptionHint: "Soins du visage et du corps, manucure et moments de détente, sur rendez-vous.",
  },
  {
    key: "autre", label: "Autre commerce ou service", short: "Autre", icon: "store", emoji: "⭐",
    logos: ["⭐", "🏪", "🎁", "💛", "✨"],
    visit: { one: "passage", many: "passages", action: "Valider le passage", done: "Passage validé", article: "un" },
    team: { one: "collaborateur·rice", many: "collaborateurs·rices", placeholder: "Prénom du collaborateur ou de la collaboratrice", title: "Votre équipe" },
    pitch: "Chaque passage compte et vous rapproche d’un avantage.",
    rewards: [{ name: "Petit cadeau offert", points: 50 }, { name: "Remise sur votre prochain passage", points: 80 }],
    hoursHint: "Lun–Ven 9h–18h",
    descriptionHint: "Présentez votre activité en quelques phrases.",
  },
];

const RULES: [TypeKey, string[]][] = [
  ["coiffeur", ["coiff", "barbier"]],
  ["parfumerie", ["parfum", "cosmet"]],
  ["institut", ["institut", "onglerie", "esthet", "spa", "beaute", "massage", "manucure"]],
  ["boulangerie", ["boulanger", "patiss"]],
  ["restaurant", ["restau", "brasserie", "pizz", "snack", "traiteur", "bistro"]],
  ["cafe", ["cafe", "coffee", "salon de the", "the ", "bar"]],
  ["boutique", ["boutique", "concept", "mode", "vetement", "magasin", "fleur", "cadeau"]],
];

export function getType(key: TypeKey): BusinessType {
  return BUSINESS_TYPES.find(t => t.key === key) || BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

/** Retrouve le type à partir de la catégorie enregistrée (libellé officiel ou texte libre d’une ancienne version). */
export function resolveType(category: string | null | undefined): BusinessType {
  if (!category) return getType("autre");
  const exact = BUSINESS_TYPES.find(t => t.label === category || t.key === category);
  if (exact) return exact;
  const text = normalizeText(category) + " ";
  for (const [key, words] of RULES) if (words.some(w => text.includes(w))) return getType(key);
  return getType("autre");
}
