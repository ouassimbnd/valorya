# Valorya — activation Apple Wallet et Google Wallet

Le code est déjà préparé pour générer une carte digitale par client. Aucune carte n'est créée manuellement : chaque ligne `memberships` reçoit automatiquement un `card_token` aléatoire après la migration `supabase/upgrade-digital-cards-wallet.sql`.

## 1. À faire d'abord dans Supabase

Dans **Supabase > SQL Editor > New query**, exécuter le fichier :

`supabase/upgrade-digital-cards-wallet.sql`

Cette migration est non destructive. Elle ajoute uniquement un jeton QR aléatoire à chaque adhésion existante et future.

Le fonctionnement devient :

- QR/NFC du commerce : `https://votre-domaine/join/slug-du-commerce`
- carte digitale client : créée automatiquement après adhésion
- QR personnel client : `https://votre-domaine/business/caisse?card=JETON_ALEATOIRE`
- le QR ne contient ni nom, ni email, ni téléphone, ni solde
- le scan ouvre la fiche en caisse ; aucune visite/point n'est ajouté sans validation du commerçant

## 2. Variable commune Vercel

Dans **Vercel > Project > Settings > Environment Variables** :

`APP_URL=https://votre-domaine-production.fr`

Utiliser l'URL HTTPS finale, sans slash à la fin. Exemple : `https://valorya.fr`.

Après toute modification des variables Vercel : **Redeploy**.

---

# Apple Wallet

## Prérequis

Il faut un compte Apple Developer permettant de créer un Pass Type ID et un certificat de signature Wallet.

## Étape A — créer le Pass Type ID

Dans Apple Developer > Certificates, Identifiers & Profiles :

1. **Identifiers**
2. bouton **+**
3. **Pass Type IDs**
4. Description : `Valorya Loyalty Card`
5. Identifier conseillé : `pass.fr.valorya.loyalty`
6. Register

La valeur exacte devient :

`APPLE_PASS_TYPE_IDENTIFIER=pass.fr.valorya.loyalty`

## Étape B — récupérer le Team ID

Dans le compte Apple Developer > Membership, copier le **Team ID**.

Vercel :

`APPLE_TEAM_IDENTIFIER=VOTRE_TEAM_ID`

## Étape C — créer le certificat de signature

1. Apple Developer > **Certificates** > **+**
2. choisir **Pass Type ID Certificate**
3. sélectionner `pass.fr.valorya.loyalty`
4. Apple demande un CSR (`.certSigningRequest`)
5. Sur macOS : ouvrir **Trousseaux d'accès > Assistant de certification > Demander un certificat à une autorité de certification**
6. créer le CSR et l'envoyer à Apple
7. télécharger le certificat `.cer`
8. l'importer dans le Trousseau macOS ; il doit apparaître avec sa **clé privée**
9. exporter certificat + clé privée en `.p12`

Le serveur Valorya utilise séparément le certificat PEM et la clé privée PEM. Par exemple avec OpenSSL :

```bash
openssl pkcs12 -in valorya-wallet.p12 -clcerts -nokeys -out signer-cert.pem
openssl pkcs12 -in valorya-wallet.p12 -nocerts -nodes -out signer-key.pem
```

Si le P12 a un mot de passe, OpenSSL le demandera. La clé PEM générée par la seconde commande n'a normalement plus besoin de mot de passe. Si vous choisissez de conserver une clé chiffrée, renseignez aussi `APPLE_SIGNER_KEY_PASSPHRASE`.

## Étape D — certificat WWDR

Télécharger le certificat Apple Worldwide Developer Relations (WWDR) depuis Apple, puis le convertir en PEM si nécessaire :

```bash
openssl x509 -inform DER -in AppleWWDRCAG*.cer -out wwdr.pem
```

## Étape E — transformer les PEM en base64

Sur macOS/Linux :

```bash
base64 < signer-cert.pem | tr -d '\n'
base64 < signer-key.pem | tr -d '\n'
base64 < wwdr.pem | tr -d '\n'
```

Ajouter dans Vercel :

- `APPLE_SIGNER_CERT_BASE64=...`
- `APPLE_SIGNER_KEY_BASE64=...`
- `APPLE_WWDR_CERT_BASE64=...`
- `APPLE_SIGNER_KEY_PASSPHRASE=...` uniquement si la clé est chiffrée

Puis **Redeploy**.

## Test Apple

Sur un iPhone :

1. rejoindre un commerce test
2. ouvrir l'espace client
3. appuyer sur **Ajouter à Apple Wallet**
4. Valorya télécharge un `.pkpass` signé
5. iOS affiche la fiche d'ajout Wallet

La carte Wallet contient le QR personnel mais pas le solde comme source de vérité. Les points et récompenses restent calculés dans Supabase / l'espace client.

---

# Google Wallet

## Étape A — créer le compte émetteur

Dans Google Pay & Wallet Console :

1. créer un compte **Google Wallet API Issuer** au nom de Valorya
2. accepter les conditions
3. noter votre **Issuer ID**

Vercel :

`GOOGLE_WALLET_ISSUER_ID=VOTRE_ISSUER_ID`

Les nouveaux comptes démarrent en mode démo : seules les personnes autorisées/testeurs peuvent ajouter les passes avant l'obtention de l'accès de publication.

## Étape B — créer un projet Google Cloud et un service account

Dans Google Cloud Console :

1. créer ou choisir un projet Valorya
2. activer **Google Wallet API**
3. **IAM & Admin > Service Accounts > Create service account**
4. créer une clé **JSON** pour ce service account
5. conserver ce JSON hors de GitHub

Le JSON contient `client_email` et `private_key`.

## Étape C — autoriser le service account dans Wallet

Dans Google Pay & Wallet Console :

1. **Users**
2. **Invite a user**
3. saisir le `client_email` du service account
4. rôle **Developer**

Vercel :

`GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=...@...iam.gserviceaccount.com`

## Étape D — convertir la clé privée en base64

Copier exactement la valeur `private_key` du JSON dans un fichier `google-private-key.pem`, puis :

```bash
base64 < google-private-key.pem | tr -d '\n'
```

Vercel :

`GOOGLE_WALLET_PRIVATE_KEY_BASE64=...`

Puis **Redeploy**.

## Étape E — mode production

Dans le Google Wallet API Dashboard, demander **publishing access** pour pouvoir émettre des cartes à tous vos clients. Tant que le compte est en demo mode, utilisez un compte Google ajouté comme testeur.

## Test Google

Sur Android ou avec un compte Google autorisé :

1. rejoindre un commerce test
2. ouvrir l'espace client
3. appuyer sur **Ajouter à Google Wallet**
4. le serveur génère un JWT signé
5. Google affiche la page d'ajout de la carte

---

# Variables Vercel finales

## Communes
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL`

## Apple Wallet
- `APPLE_PASS_TYPE_IDENTIFIER`
- `APPLE_TEAM_IDENTIFIER`
- `APPLE_SIGNER_CERT_BASE64`
- `APPLE_SIGNER_KEY_BASE64`
- `APPLE_WWDR_CERT_BASE64`
- `APPLE_SIGNER_KEY_PASSPHRASE` (optionnel)

## Google Wallet
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_WALLET_PRIVATE_KEY_BASE64`

## Sécurité
Les certificats, clés privées et JSON Google ne doivent jamais être ajoutés à GitHub ou à une variable `NEXT_PUBLIC_*`.
