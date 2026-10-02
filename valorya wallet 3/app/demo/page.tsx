import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "@/components/ui";
export const metadata: Metadata = { title: "Découvrir Valorya" };
const steps = [
  ["01", "Le client scanne", "Il scanne le QR affiché au comptoir avec l’appareil photo de son téléphone. Aucune application à installer."],
  ["02", "Il s’identifie", "Prénom et email : un lien de connexion lui est envoyé, sans mot de passe à retenir."],
  ["03", "Il retrouve sa carte", "Un petit profil avec ses points, ses récompenses, son historique et le QR à présenter en caisse."],
  ["04", "Il l’ajoute au Wallet", "Un bouton pour Apple Wallet ou Google Wallet : sa carte est toujours dans son téléphone."],
  ["05", "Le commerçant valide", "En caisse, un scan ou une recherche, puis un bouton : +10 points, avec le nom du membre de l’équipe."],
] as const;
export default function Demo() {
  return <div className="container page"><div className="page-heading"><span className="kicker">DÉCOUVRIR VALORYA</span><h1>Du QR code<br/><em>à la prochaine visite.</em></h1><p>Le même parcours pour un salon de coiffure, un restaurant, une parfumerie ou une boutique : vocabulaire et récompenses s’adaptent à votre métier.</p></div>
    <div className="journey">{steps.map(([n, t, d]) => <div key={n} className="journey-card"><span className="journey-number">{n}</span><h2>{t}</h2><p>{d}</p></div>)}</div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}><Link href="/business/login?mode=signup" className="button dark"><Arrow>Créer mon espace</Arrow></Link><Link href="/customer/login" className="button outline">Retrouver ma carte client</Link></div>
  </div>;
}
