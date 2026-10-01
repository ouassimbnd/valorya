# Valorya — parcours client sans connexion au premier scan

## Ce qui change

Le QR/NFC du commerce ouvre directement `/join/<slug>`.

Le premier parcours est maintenant :

1. Scan du QR ou contact NFC du commerce.
2. Prénom + nom + email, téléphone facultatif.
3. Consentement fidélité obligatoire ; marketing email/push facultatif et décoché.
4. Création immédiate de l'adhésion.
5. Redirection vers `/c/<jeton-secret>` : la carte digitale s'affiche sans mot de passe.
6. Le client peut ajouter la carte à Apple Wallet / Google Wallet via Passcreator.
7. Le QR personnel contient seulement `card:<uuid>` : il n'ouvre plus une page Vercel protégée avec la caméra classique.
8. En caisse Valorya, le scanner comprend `card:<uuid>` et ouvre la fiche du client. Le caissier doit toujours confirmer l'opération.

Si une carte existe déjà pour le même email et le même commerce, Valorya ne révèle jamais l'ancien lien. Le client passe par « Retrouver ma carte » et reçoit un lien sécurisé par email.

## À faire dans Supabase

Exécuter dans **SQL Editor** :

`supabase/upgrade-frictionless-client.sql`

Cette migration est non destructive.

## À faire dans Vercel

Variables nécessaires :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `PASSCREATOR_API_KEY`
- `PASSCREATOR_TEMPLATE_ID`
- `APP_URL=https://votre-domaine-valorya...`

Puis redéployer.

## Corriger l'ancien domaine Supabase

Dans **Supabase > Authentication > URL Configuration** :

- `Site URL` = l'URL actuelle de Valorya.
- Ajouter dans `Redirect URLs` : `https://VOTRE-DOMAINE/auth/callback`
- Retirer l'ancien domaine comme URL principale.

Cela empêche les liens email de renvoyer vers l'ancien site.

## Passcreator

Dans le modèle Passcreator, ne forcez pas « Insert unique pass ID as value » si Valorya fournit déjà `barcodeValue` par API. Le QR du Wallet reçoit `card:<token>`.
