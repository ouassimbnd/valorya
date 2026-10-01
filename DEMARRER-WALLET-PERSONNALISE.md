# Valorya — carte élégante et personnalisation automatique

Cette livraison ajoute la personnalisation Passcreator et la synchronisation des points. Le code est prêt à configurer ; aucun changement n’a été effectué dans votre Supabase, votre compte Passcreator ou votre hébergement.

## 1. Installer la mise à jour SQL

Sur la base existante, exécuter **`supabase/wallet-personnalisation.sql`** dans Supabase → SQL Editor. Le script est additif, conserve les données et peut être réexécuté. Il suppose que `schema.sql`, `upgrade-digital-cards-wallet.sql` et `upgrade-frictionless-client.sql` sont déjà installés. Ne pas réexécuter le schéma complet uniquement pour installer cette mise à jour.

La nouvelle table `wallet_passes` est réservée au serveur. Elle garde les créations, mises à jour et suppressions à réessayer, même si une requête est interrompue. Les changements de points, prénom, commerce et récompenses déclenchent automatiquement une tâche pour les cartes déjà demandées.

## 2. Configurer le modèle Passcreator

Conserver le même identifiant de modèle pour les cartes existantes. Dans **Personalization**, ajouter les propriétés ci-dessous, puis insérer leurs placeholders dans **Frontfields**. Utiliser les placeholders proposés par l’éditeur : leur casse et leur nom doivent correspondre exactement.

| Propriété | Type | Valeur envoyée automatiquement |
| --- | --- | --- |
| `prenom` | Texte | Prénom du client |
| `commerce` | Texte | Nom de son commerce |
| `points` | Nombre | Solde réel, calculé dans Supabase |
| `avantage` | Texte | Meilleure récompense disponible, sinon prochaine récompense |
| `points_restants` | Nombre | Points nécessaires, ou zéro si une récompense est disponible |
| `identifiant_carte` | Texte | Identifiant technique de l’adhésion |

`prenom`, `commerce` et `points` sont indispensables pour cette intégration. `nom`, `nom_complet`, `statut` et `email` sont également reconnus si vous en avez besoin. Ne demandez pas d’email dans le modèle si vous ne l’affichez pas. Le statut envoyé est « Membre » ; aucun niveau VIP n’est déduit des points.

### Présentation recommandée

- **Fond :** bleu nuit `#102D46`.
- **Texte principal :** blanc cassé `#F7FAFC`.
- **Accent et logo :** émeraude `#109B81`. Pour les petites étiquettes sur fond bleu, préférer un vert très clair `#C5EEE5` afin de garder une bonne lisibilité.
- **Logo :** importer `public/wallet/valorya-logo-dark.png`, conçu pour le fond bleu nuit. Retirer « Retailer » et « 2026 ».
- **Header field :** libellé « MES POINTS », valeur `{points}`.
- **Primary field :** valeur `{commerce}`, sans libellé superflu.
- **Secondary field :** libellé « MEMBRE », valeur `{prenom}`.
- **Auxiliary field :** libellé « VOTRE AVANTAGE », valeur `{avantage}`.
- Retirer la texture à petits points de votre capture. Garder de l’espace et un QR très contrasté, sur fond blanc.
- Au verso : règles du programme et coordonnées du commerce. Ne pas afficher le jeton privé du lien client.

Apple et Google peuvent répartir les champs différemment. Vérifier la longueur des noms et récompenses dans les deux aperçus. Les couleurs et le contenu du modèle se configurent dans Passcreator ; cette livraison ne modifie pas votre modèle distant.

Dans **Barcode & NFC**, choisir QR-Code et désactiver **Insert unique pass ID as value**. L’application fournit `barcodeValue` sous la forme `card:UUID`. Ce QR identifie le client dans la caisse Valorya ; un appareil photo générique ne doit pas nécessairement ouvrir une page web. Le QR d’inscription du commerce reste un lien `/join/slug` distinct.

Enregistrer puis **publier** le modèle. Conserver la génération Apple/Google et les certificats selon la configuration de votre compte Passcreator.

### Si les noms de propriétés sont différents

L’application lit les champs du modèle et reconnaît notamment « First Name », « Business Name » et « Points ». Un champ obligatoire inconnu bloque la création avec une erreur explicite. Si besoin, ajouter `PASSCREATOR_FIELD_MAP` : objet JSON dont les clés sont les clés exactes renvoyées par le modèle et les valeurs les propriétés Valorya ci-dessus. Exemple avec des clés fictives :

```json
{"customer_first":"prenom","store_name":"commerce","loyalty_balance":"points"}
```

## 3. Variables serveur et déploiement

Dans votre hébergement, conserver les deux variables publiques Supabase et ajouter/vérifier :

| Variable | Usage |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Accès serveur à la file et au solde de référence |
| `PASSCREATOR_API_KEY` | Clé API privée Passcreator |
| `PASSCREATOR_TEMPLATE_ID` | Identifiant du modèle publié |
| `CRON_SECRET` | Secret aléatoire d’au moins 32 caractères pour le travailleur |
| `PASSCREATOR_FIELD_MAP` | Facultatif, correspondances particulières |

Ces variables ne doivent jamais avoir le préfixe `NEXT_PUBLIC_`. Pour créer le secret, exécuter localement `openssl rand -hex 32`, puis copier la valeur directement dans l’hébergement et les réglages Supabase suivants. Ne pas la partager dans un message.

Déployer ce projet, puis redéployer après toute modification des variables. L’URL du site doit être publique en HTTPS et accessible à Supabase. `APP_URL` peut être conservée pour les autres fonctionnalités ; le QR de cette intégration n’utilise pas le domaine.

## 4. Activer les mises à jour en arrière-plan

Ces deux réglages sont nécessaires pour que la synchronisation continue après la fermeture du navigateur.

### Déclenchement immédiat : Database Webhook Supabase

Créer un Database Webhook sur la table **`public.wallet_passes`**, événements **INSERT et UPDATE** :

- Méthode : `POST`.
- URL : `https://VOTRE-DOMAINE/api/wallet/worker`.
- En-tête `Authorization` : `Bearer VOTRE_CRON_SECRET`.
- En-tête `Content-Type` : `application/json`.
- Conserver le corps standard généré par Supabase, contenant `schema`, `table` et `record`.

Le serveur ignore les événements de verrouillage et d’acquittement pour éviter une boucle. Il relit lui-même les données avant d’appeler Passcreator.

### Reprise des erreurs : Cron Supabase

Dans Supabase → Cron, créer un job **toutes les minutes** (`* * * * *`) avec une requête HTTP :

- Méthode : `GET`.
- URL : `https://VOTRE-DOMAINE/api/wallet/worker`.
- En-tête `Authorization` : `Bearer VOTRE_CRON_SECRET`.

Activer Cron et l’envoi de requêtes HTTP si le Dashboard le demande. Les secrets placés dans ces réglages doivent être accessibles seulement aux administrateurs du projet.

Chaque appel traite **une carte en attente**. Le webhook et la caisse assurent les mises à jour courantes ; le Cron reprend les interruptions et les échecs avec un délai croissant, jusqu’à une heure. Si une panne a accumulé beaucoup de cartes, augmenter la fréquence ou le nombre d’appels du planificateur selon les limites de l’hébergement et de Passcreator. Une réponse `idle` indique qu’aucune tâche n’est due.

## Vérification sur votre compte

1. Rejoindre le programme avec un client de test, puis cliquer sur « Ajouter au Wallet » : vérifier prénom, commerce, QR et points. Pour une ancienne carte, cliquer une première fois afin de l’enregistrer dans la nouvelle file ; l’application retrouve le pass par son identifiant externe et le met à jour.
2. Scanner son QR dans la caisse connectée du bon commerce. Le scan doit ouvrir sa fiche sans créditer de points. Valider un passage : +10 points.
3. Vérifier l’actualisation du pass déjà installé. Le délai dépend aussi de Passcreator, du téléphone et de sa connexion.
4. Donner un avis privé : +5 points. Remettre une récompense : déduction de son coût. Modifier le prénom et vérifier sa mise à jour.
5. Tester un autre commerce et un autre compte client : ils ne doivent pas accéder à cette carte.
6. Vérifier les exécutions du webhook et du Cron. Une panne Wallet ne doit pas annuler un passage validé. Le solde Supabase reste la référence en caisse.

Lecture administrative utile dans SQL Editor :

```sql
select membership_id, operation, desired_version, synced_version,
       attempts, next_attempt_at, last_error, synced_at
from public.wallet_passes
where desired_version > synced_version
order by next_attempt_at;
```

Après suppression d’une adhésion ou d’un client, une tâche conserve l’identifiant du pass pour demander sa suppression chez Passcreator. Une copie affichée hors ligne sur un téléphone peut rester visible ; la caisse ne retrouvera plus l’adhésion supprimée.

## Validation livrée et limites

Les tests automatisés couvrent la création et la mise à jour avec une API simulée, les erreurs, les doublons, les accès, les rôles SQL, le calcul exact des points, les verrous, les reprises et les suppressions. Le SQL est exécuté sur PostgreSQL embarqué via PGlite. La compilation de production a réussi, y compris la vérification TypeScript et la génération des pages. Une adaptation locale a seulement contourné une métrique mémoire indisponible dans l’environnement de test ; elle n’est pas incluse dans le projet.

Aucun test n’a été effectué avec vos identifiants Passcreator, sur votre base distante ou sur un vrai téléphone. Les tests locaux ne valident pas les certificats Wallet, votre abonnement, les réglages du modèle ni la livraison des mises à jour par Apple/Google. Le script SQL autonome remplace ici une migration CLI : le binaire Supabase CLI ne fonctionnait pas dans l’environnement de préparation.

Commandes de validation : `npm ci`, `npm test`, `npm run build`.

Références officielles : [API Passcreator v3](https://developer.passcreator.com/en/api/v3/pass), [personnalisation Passcreator](https://service.passcreator.com/portal/en/kb/articles/personalisation), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Database Webhooks](https://supabase.com/docs/guides/database/webhooks).
