import type { Metadata } from "next";
import Link from "next/link";
import { passcreatorConfigured } from "@/lib/passcreator";
import { PageHead } from "@/components/states";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Wallet mobile" };
export const dynamic = "force-dynamic";

export default function Wallet() {
  const ready = passcreatorConfigured();
  return (
    <div className="ws-page">
      <PageHead kicker="DIFFUSION" title="Votre commerce dans leur Wallet." subtitle="Un seul QR d’inscription pour votre commerce. Chaque client crée ensuite sa carte digitale personnelle à la demande." actions={<Link className="btn btn-primary" href="/business/cartes">Inviter mes clients</Link>} />
      <div className="grid grid-2">
        <section className="card"><span className="kicker">PARCOURS AUTOMATISÉ</span><h2>Un support, des cartes à la demande</h2>
          <ol className="steps">
            <li><span>1</span><div><strong>Votre commerce garde un seul QR / NFC</strong><small>Il ouvre votre page d’inscription Valorya.</small></div></li>
            <li><span>2</span><div><strong>Le client rejoint votre programme</strong><small>Valorya crée son adhésion et son QR personnel automatiquement.</small></div></li>
            <li><span>3</span><div><strong>Il ajoute sa carte au Wallet</strong><small>Passcreator génère le pass uniquement à ce moment-là.</small></div></li>
          </ol>
        </section>
        <section className="card"><span className="kicker">ÉTAT DU SERVICE</span><h2>Wallet géré par Passcreator</h2>
          <ul className="status-list">
            <li><Icon name="wallet" size={20} /><div><strong>Passcreator API</strong><small>Création de cartes à la demande, sans stock de cartes pré-générées.</small></div><span className={`badge ${ready ? "badge-green" : "badge-gray"}`}>{ready ? "Configuré" : "À configurer"}</span></li>
            <li><Icon name="wallet" size={20} /><div><strong>Apple Wallet</strong><small>Distribué via le pass créé par Passcreator.</small></div><span className={`badge ${ready ? "badge-green" : "badge-gray"}`}>{ready ? "Via Passcreator" : "En attente"}</span></li>
            <li><Icon name="wallet" size={20} /><div><strong>Google Wallet</strong><small>Distribué via le même pass lorsque le modèle Passcreator le permet.</small></div><span className={`badge ${ready ? "badge-green" : "badge-gray"}`}>{ready ? "Via Passcreator" : "En attente"}</span></li>
          </ul>
          <p className="hint">Variables serveur requises : <code>PASSCREATOR_API_KEY</code> et <code>PASSCREATOR_TEMPLATE_ID</code>. La clé API reste privée et n’est jamais envoyée au navigateur.</p>
        </section>
      </div>
    </div>
  );
}
