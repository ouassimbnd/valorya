# Valorya + Passcreator — mise en service Wallet

## 1. Variables Vercel

Dans **Vercel → Settings → Environment Variables**, ajouter :

```text
PASSCREATOR_API_KEY=...
PASSCREATOR_TEMPLATE_ID=...
APP_URL=https://votre-domaine.fr
```

Les deux variables Passcreator sont **privées** : ne jamais ajouter `NEXT_PUBLIC_` devant leur nom.

## 2. Réglage indispensable dans le modèle Passcreator

Dans **Barcode & NFC** :

- Barcode type : **QR-Code**
- Message encoding : **Default**
- **désactiver** `Insert unique pass ID as value`

Valorya fournit lui-même la valeur du QR à l’API. Elle ressemble à :

```text
https://votre-domaine.fr/business/caisse?card=JETON_ALEATOIRE
```

Le QR ne contient ni nom, ni email, ni points. Le scan ouvre seulement la fiche côté caisse ; une validation du commerçant reste nécessaire pour créditer un passage.

## 3. Fonctionnement

- Le commerce possède **un seul QR/NFC d’inscription** (`/join/slug-du-commerce`).
- Chaque client possède une adhésion Supabase et un `card_token` aléatoire.
- Aucune carte Passcreator n’est créée en masse.
- Le pass Passcreator est créé **uniquement lorsque le client appuie sur Ajouter au Wallet**.
- `membershipId` est utilisé comme identifiant externe unique chez Passcreator : plusieurs clics ne créent pas plusieurs cartes.
- Le même pass peut ensuite proposer Apple Wallet ou Google Wallet selon la configuration du template et l’appareil.

## 4. Supabase

Exécuter une seule fois `supabase/upgrade-digital-cards-wallet.sql` si la colonne `memberships.card_token` n’existe pas encore.

## 5. Test

1. Créer un client depuis le QR d’un commerce.
2. Ouvrir son espace client.
3. Cliquer sur **Ajouter à Apple Wallet** sur iPhone ou **Ajouter à Google Wallet** sur Android.
4. Présenter le QR Wallet devant la caisse Valorya.
5. Vérifier que le scan ouvre le bon client mais n’ajoute aucun point automatiquement.

## Note Passcreator

Le compte Passcreator doit être activé et l’accès API disponible. Le modèle doit aussi être configuré pour la plateforme Wallet souhaitée. En mode gratuit/démo, certaines limitations du fournisseur peuvent s’appliquer.
