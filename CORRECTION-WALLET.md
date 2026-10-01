# Correction Wallet Valorya

- Correction de la lecture d’un pass existant : Passcreator exige `?zapierStyle=true` sur `GET /api/pass/{id}`.
- Le statut Wallet teste maintenant réellement l’API et le template Passcreator au lieu de vérifier uniquement la présence des variables Vercel.
- Les erreurs API (clé invalide, compte non activé, template inaccessible) sont affichées dans l’interface.

Après déploiement, ouvrez **Wallet mobile** :
- `Connecté` = API et template réellement accessibles.
- `Erreur API` = lire le message affiché sous le bloc.
