# Valorya PME — v13 — mise en service

## Ce qui change dans cette version

Thème conservé : vert profond et sauge dans les espaces connectés, abricot sur le site public. Aucune migration obligatoire.

**Pour tous les métiers.** À la création du compte (et dans « Mon établissement »), le commerçant choisit son activité : coiffeur/barbier, restaurant, café, boulangerie, parfumerie, boutique, institut/spa, autre. Le vocabulaire s'adapte (rendez-vous, repas, achat, passage), l'équipe se nomme selon le métier (coiffeurs, serveurs, conseillers…), et des récompenses de départ adaptées sont proposées en un clic. Les anciens commerces sont reconnus d'après leur catégorie saisie librement.

**Parcours client.** Scan du QR → prénom et email (lien de connexion, sans mot de passe) → page à la couleur du commerce → espace client en trois onglets : *Ma carte* (points, prochaine récompense, QR, Wallet, avis privé), *Historique*, *Mon profil* (prénom modifiable, infos du commerce, carte physique, suppression du compte). Boutons **Apple Wallet** et **Google Wallet**.

**Espace commerçant.**
- *Vue d'ensemble* : passages du jour, 7 jours, clients, récompenses, graphique de fréquentation, activité en direct, checklist de démarrage.
- *Caisse* : recherche par prénom, scan caméra du QR (navigateurs compatibles), lecture des liens de carte Wallet **et de carte physique**, choix mémorisé de la personne qui valide, confirmation claire avec le nouveau solde, récompense débloquée signalée, minuteur anti-doublon de 10 minutes, derniers événements du client.
- *Clients* : recherche, barre de progression, historique, ouverture en caisse, **export CSV**.
- *Récompenses* : suggestions par métier, coût converti en nombre de visites.
- *QR & cartes* : **affiche A4 imprimable** aux couleurs du commerce, lien à partager (WhatsApp, partage natif), cartes physiques par lot de 10, filtres par statut.
- *Équipe* : ajout et désactivation des membres, classement, aide.
- *Mon établissement* : aperçu client en direct, couleur et logo, avertissement si des modifications ne sont pas enregistrées.
- Navigation mobile en barre du bas, messages de confirmation à la place des fenêtres du navigateur, écrans de chargement, vides et d'erreur partout, messages d'erreur en français clair.

**Corrections.** Écrans vides remplacés par des états utiles (aucun programme actif : création en un clic) ; navigation du site public utilisable sur mobile ; suppression de fichiers inutilisés ; formulaires d'inscription avec renvoi du lien ; chargement du commerce factorisé (moins de requêtes répétées) ; export CSV protégé contre l'injection de formules.

## Installer

1. Sauvegarder le dépôt et la base. Remplacer les fichiers par ceux de l'archive, sur une branche dédiée. Ne pas écraser vos variables privées.
2. `npm ci`, puis `npm run typecheck`, `npm run build`, `npm test`.
3. Déployer un aperçu Vercel et dérouler la recette ci-dessous.
4. Optionnel : exécuter `supabase/optional-v13.sql` (index de performance). **Le schéma existant n'est pas modifié** : ne réexécutez pas `schema.sql` pour cette version.

## Variables d'environnement

Inchangées pour Supabase et Apple Wallet (voir `.env.example`). Nouveau, optionnel : **Google Wallet**.

| Variable | Valeur |
| --- | --- |
| `GOOGLE_WALLET_ISSUER_ID` | Identifiant émetteur (Google Pay & Wallet Console) |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | E-mail du compte de service autorisé sur l'API Wallet |
| `GOOGLE_WALLET_PRIVATE_KEY_BASE64` | Clé privée du compte de service (champ `private_key` du JSON), encodée en base64 |
| `APP_URL` | URL HTTPS du site (déjà utilisée pour Apple) |

Tant que ces variables sont absentes, le bouton Google Wallet est désactivé avec un message clair. Google exige de créer l'émetteur et de passer les cartes en revue avant une diffusion publique ; la classe de carte est créée en « revue » (`UNDER_REVIEW`), utilisable en mode test avec des comptes testeurs.

## Recette avant ouverture

1. Créer un compte commerçant, choisir un métier (ex. coiffeur) : vérifier le vocabulaire (« rendez-vous ») et les 3 récompenses créées.
2. Ouvrir *QR & cartes* : imprimer l'affiche (aperçu d'impression), copier le lien.
3. Depuis un téléphone, scanner le QR, s'inscrire, ouvrir le lien reçu par email : la carte apparaît aux couleurs du commerce.
4. En caisse : rechercher le client, valider un rendez-vous (+10 points, nouveau solde affiché), constater le blocage de 10 minutes.
5. Scanner en caisse le QR de la carte du client (Wallet ou page « Mon QR ») et celui d'une carte physique associée.
6. Atteindre un seuil, remettre la récompense, vérifier la déduction côté client et côté commerçant.
7. Ajouter un membre d'équipe, le sélectionner en caisse, vérifier le classement.
8. Modifier l'établissement (couleur, horaires) : vérifier l'aperçu et la page publique.
9. Exporter le CSV des clients et l'ouvrir dans un tableur.
10. Avec deux commerçants et deux clients, vérifier l'isolation des données (voir README).
11. Tester sur iPhone (Apple Wallet) et Android (Google Wallet) une fois configurés, ainsi que la caméra de la caisse sur Chrome Android.

## Limites connues (honnêtes)

- Le lecteur de QR intégré à la caisse utilise l'API `BarcodeDetector` (Chrome/Android, Edge). Sur iPhone/Safari, scanner avec l'appareil photo du téléphone : le QR ouvre directement la caisse.
- Les caissiers sont des profils de suivi, pas des comptes de connexion : la caisse s'ouvre avec le compte propriétaire. Des comptes avec code PIN nécessitent une évolution de la base (v14).
- Un logo image (PNG) nécessite Supabase Storage : le logo reste un emoji pour l'instant.
- Cartes Passcreator synchronisées après installation de DEMARRER-WALLET-PERSONNALISE.md. Le solde Supabase reste la référence. Les anciennes routes Wallet directes restent distinctes de cette intégration ; pas de campagnes push promotionnelles.
- Pas de facturation d'abonnement, ni de multi-établissements réel (inchangé). Les mentions légales et engagements commerciaux sont à compléter.
- Le nombre de points par visite (10) et par avis (5) est fixé par la base : le rendre configurable demande une migration.
