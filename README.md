# Valorya PME — identité Confiance & croissance

Interface produit repensée : espaces adaptés à chaque métier, parcours client complet, caisse rapide, Apple Wallet et Google Wallet.
**Mise à jour de marque : [CHANGEMENTS-VALORYA.md](CHANGEMENTS-VALORYA.md).**

**Commencez par [MISE-EN-SERVICE.md](MISE-EN-SERVICE.md).** Ce guide décrit les changements, les validations et les étapes encore nécessaires avant lancement.

Les instructions ci-dessous décrivent la base existante et ses limites. Aucun accès au Supabase de production ni aucun déploiement Vercel n’a été effectué pendant cette livraison.

---

# Valorya V6 — MVP connecté à Supabase

## Nouvelle landing responsive

La page d'accueil `/` utilise Next.js et Tailwind CSS 4. Elle comprend un hero bleu nuit avec accents émeraude, une comparaison avant/après, un calculateur interactif, les fonctionnalités réellement présentes dans ce MVP, trois étapes, des chiffres d'exemple, un prix indicatif avec bascule mensuel/annuel et un appel à l'action. Le parcours Supabase des autres pages n'a pas été remplacé.

Modifiez toutes les valeurs commerciales et les hypothèses dans **`lib/landing-config.ts`** : prix, chiffres du calculateur, points d'exemple et maquettes. Le calculateur représente une simulation de chiffre d'affaires, pas une prédiction ou un bénéfice. Les prix ne déclenchent aucun paiement. La section Wallet précise que l'intégration synchronisée n'est pas encore disponible.

Pour afficher les polices Anton et Inter, la page charge Google Fonts ; si le réseau du visiteur les bloque, les polices de secours prévues par le CSS sont utilisées. Les animations respectent la préférence système de réduction du mouvement.

Cette version sépare les comptes commerçants et clients. Le commerçant crée un établissement et un programme, le client rejoint le programme depuis `/join/[slug]`, reçoit un lien email et retrouve ses points dans `/customer`. Les visites, récompenses et avis privés sont enregistrés dans Supabase. Les cartes physiques ont chacune un QR unique (`/card/[token]`) et peuvent être déclarées perdues puis remplacées.

## Mise en place

1. Créer ou sélectionner un projet Supabase. Faire une sauvegarde avant toute migration d'une base existante.
2. Exécuter **tout** `supabase/schema.sql` dans SQL Editor. Ce script crée les tables, remplace toutes les anciennes politiques RLS sur ces huit tables et installe les fonctions métier. Vérifiez les éventuelles applications qui utilisaient les anciennes politiques avant la migration. Sur une base qui contient déjà des établissements, attribuer `owner_id` manuellement à un compte Auth vérifié après contrôle de l'identité ; les anciennes lignes sans propriétaire ne sont pas administrables.
3. Exécuter `supabase/checks.sql` : le contrôle doit afficher une notice de succès. Puis effectuer les tests d'isolation avec de vrais comptes distincts ; le contrôle structurel seul ne suffit pas.
4. Dans Supabase > Authentication, activer Email. Pour le lien magique, conserver un modèle d'email utilisant `{{ .ConfirmationURL }}`. Configurer `Site URL` sur l'URL du site et ajouter `https://votre-domaine/auth/callback*` dans la liste des Redirect URLs. Ajouter l'URL Preview uniquement si nécessaire. Configurer l'envoi SMTP adapté avant un usage réel.
5. Dans Vercel, preset **Next.js**, Root Directory `./`, ajouter :

| Nom | Valeur |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (publishable) Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role, **secrète et seulement côté serveur**, utilisée uniquement pour la suppression complète d'un compte |

6. Redéployer après toute modification de variable. Ne jamais mettre la clé service role dans une variable `NEXT_PUBLIC_`, un commit ou une capture d'écran.
7. Ouvrir `/business/login`, créer un compte, confirmer l'email, puis créer un commerce. Partager le lien `/join/son-slug` du tableau de bord.

Sans les deux variables publiques, les parcours connectés affichent « Configuration requise » ; l'accueil reste consultable. Sans la clé service role, la suppression complète est désactivée. Ne pas ouvrir les inscriptions clients avant d'avoir validé cette configuration et la politique de confidentialité.

## Vérifications avant ouverture

- Avec deux comptes commerçants A et B, vérifier que A ne peut lire ni modifier les clients, visites, cartes et récompenses de B, y compris via l'API Supabase.
- Avec deux comptes clients, vérifier qu'un client ne peut lire que ses adhésions et ne peut appeler `record_visit` ou `redeem_reward`.
- Scanner une carte vierge, l'associer à un client, enregistrer une visite avec le commerçant, déclarer la carte perdue et associer une nouvelle carte ; le QR perdu doit cesser de fonctionner.
- Vérifier l'email de confirmation et le lien magique en production, le QR et le bouton « Copier le lien » sur mobile.
- Tester la suppression du compte client, y compris ses visites et cartes liées. Compléter `/privacy` avec l'identité du responsable, son contact et les durées de conservation définies pour ce service.

Les appels `record_visit`, `redeem_reward`, `submit_feedback`, `claim_card` et `issue_card` sont vérifiés par l'identité Auth et les fonctions SQL. La clé publique est prévue pour le navigateur ; le contrôle d'accès repose sur RLS. La v12 émet les cartes Apple Wallet côté serveur, après vérification de la session et de la propriété de la carte. Elles identifient le client par QR ; aucun solde n’y est inscrit, car la mise à jour automatique n’est pas encore implémentée.

## Cartes physiques et prix

Le tableau de bord crée un token UUID aléatoire lié à l'ID unique de l'établissement. La carte imprimée porte l'URL `/card/[token]`. Chaque QR est téléchargeable en SVG depuis le tableau de bord pour préparer le fichier fabricant. Pour fixer le tarif, demander des devis fournisseurs et calculer : **coût unitaire complet = fabrication + impression/QR + livraison + pertes/remplacements + préparation**, puis ajouter le temps de mise en place et la marge. Vérifier la quantité minimale de commande et les échantillons avant d'annoncer un prix. Les 19 € HT/mois sur l'accueil sont une **hypothèse de lancement**, sans paiement intégré.

## Limites connues

Le tableau de bord charge 25 clients par page avec des totaux calculés côté base. Les 20 dernières cartes physiques sont affichées ; prévoir un inventaire paginé pour une production à grand volume. Il n'y a pas de paiement, de campagnes marketing, de témoignages inventés ni de Wallet synchronisé. La page de confidentialité est un modèle à compléter avec les informations réelles et la durée de conservation avant un lancement public. Cette livraison ne contient pas les identifiants de votre projet Supabase et le SQL n'a pas été exécuté sur votre base.

## Évolutions V7

- **Identité visuelle** : bleu nuit `#0F2A5F`, bleu confiance `#2563EB`, teal `#14B8A6`, ambre `#F59E0B` (points et récompenses). Polices : Plus Jakarta Sans (titres) et Inter (texte).
- **Tarifs** : trois offres (Essentiel 9 €, Pro 19 €, Multi-boutiques 39 € HT/mois ; 7, 15 et 31 € en annuel), essai de 30 jours sans carte bancaire, remise annuelle. Tout se modifie dans `lib/landing-config.ts`. Aucun paiement n'est intégré.
- **Section confiance** sur l'accueil (anti-fraude, RGPD, sans engagement) et arguments de différenciation.
- **Anti-fraude** : `record_visit` refuse un second passage sur la même adhésion en moins de 10 minutes (à rejouer dans SQL Editor : réexécuter `supabase/schema.sql`).

## Prochaines étapes recommandées

1. Paiement des abonnements (Stripe) et essai réel de 30 jours.
2. Wallet synchronisé : compte Apple Developer payant + certificats pass, API Google Wallet, émission et mise à jour côté serveur.
3. Comptes employés avec code PIN, scan code-barres (Code 128) en plus du QR.
4. Notifications de rappel, parrainage, paliers Bronze/Argent/Or.
5. Compléter `/privacy` (responsable, contact, durées de conservation).

## V8 — identité « Graphite et abricot » et espace caisse

- **Identité** : graphite `#181818`, abricot `#FF8A3D`, violet `#7C5CFF`, pêche `#FFE4CC`, jaune points `#FFD23F`. Polices Sora (titres) et Inter (texte). Logo dans `components/ui.tsx` et `app/icon.svg`.
- **Créer mon compte** (`/business/login`) : page en deux volets, arguments à gauche, formulaire à droite. Elle s'ouvre en mode inscription.
- **Chiffres clés** sur l'accueil (`landingStats` dans `lib/landing-config.ts`), avec mention qu'il s'agit d'ordres de grandeur, pas d'une garantie.
- **Espace caisse** (`/business/caisse`) : ajout et désactivation de caissiers, fidélisations par caissier (total, 30 jours, 7 jours). Le tableau de bord permet de choisir le caissier avant de valider un passage.
- **Pages légales** : `/privacy`, `/legal` (mentions), `/terms` (CGU et CGV), `/cookies`, liées dans le pied de page. Les champs surlignés sont à compléter, et le tout est à faire valider par un juriste.
- **À exécuter** : réexécuter tout `supabase/schema.sql` (nouvelle table `cashiers`, fonction `record_visit(uuid, uuid)`, `cashier_stats`).

## V9 — audit complet et fonctionnalités commerçant / client

### Ce qui fonctionne réellement (vérifié à la lecture du code, non testé faute de réseau ici)
- Authentification commerçant par email/mot de passe (Supabase Auth), confirmation d'email, déconnexion.
- Authentification client par lien magique (sans mot de passe), ce qui est volontaire et reste inchangé.
- Création du commerce et du programme (`create_business`), adhésion client (`/join/[slug]`), cartes physiques (émission, association, perte).
- Sécurité : RLS sur toutes les tables, aucune écriture directe sur les points/visites/récompenses — tout passe par des fonctions `security definer` qui vérifient la propriété du commerce ou l'identité du client.

### Ce qui était incomplet et a été complété dans cette version
- **Réinitialisation du mot de passe commerçant** : `/business/forgot-password` et `/business/reset-password`, absentes jusqu'ici.
- **Profil du commerce** (`/business/profil`) : description, téléphone, adresse, horaires, catégorie, « logo » (emoji/initiale) et couleur d'accent. Le vrai logo image est noté comme nécessitant Supabase Storage (non configuré ici).
- **Catalogue de récompenses (paliers)** (`/business/programme`) : remplace le seuil unique par plusieurs récompenses indépendantes, chacune avec son propre coût en points, activables/désactivables. Table `rewards`, fonctions `add_reward`, `set_reward_active`, `redeem_reward` réécrite. Migration automatique : l'ancienne récompense unique devient la première entrée du catalogue.
- **Recherche client** sur le tableau de bord (par prénom), via `business_overview(p_search)`.
- **Historique par client** : bouton « Historique » sur chaque client, affiche visites, récompenses et avis avec date, via `member_history`.
- **Confirmations** : une confirmation est demandée avant de donner une récompense (dépense de points) et avant de désactiver une récompense du catalogue. Le crédit d'une visite reste instantané (action fréquente, faible risque, doit rester rapide au comptoir).
- **États vides et de chargement** : présents sur toutes les nouvelles pages (« Chargement… », listes vides explicites).

### Correction de sécurité importante faite pendant cette passe
La première version de l'espace client permettait au client de valider lui-même sa récompense (bouton « Utiliser »), en appelant la même fonction que le commerçant. Comme `redeem_reward` ne vérifie que la propriété du commerce, un client aurait pu se l'attribuer sans validation. **Corrigé** : le client voit seulement que sa récompense est disponible et doit présenter l'écran au commerçant, qui seul peut la valider depuis son tableau de bord.

### Ce qui reste incomplet ou non testé
- **Compilation non vérifiée** : cet environnement n'a pas accès au réseau, donc `npm install` et `npm run build` n'ont pas pu être exécutés. Lancez `npm install && npm run build` avant de déployer.
- **Comptes caissiers réels avec code PIN** : les caissiers sont de simples noms d'attribution choisis par le commerçant connecté, pas des comptes de connexion séparés.
- **Apple Wallet** : émission signée implémentée, à activer avec les certificats Apple. Synchronisation automatique et **Google Wallet** non implémentés.
- **Paiement des abonnements** : aucune intégration Stripe.
- **Upload d'image de logo** : nécessite la configuration d'un bucket Supabase Storage, non fait ici.
- **Migration à exécuter** : réexécutez tout `supabase/schema.sql` (idempotent) puis `supabase/checks.sql`.

## Direction commerciale V11
La landing page a été repositionnée pour les PME et professionnels autour de la promesse Valorya : support NFC + QR, adhésion mobile, programme personnalisable, espace client et pilotage professionnel. Les textes ont été réécrits spécifiquement pour Valorya et ne reprennent pas les formulations du site de référence.
