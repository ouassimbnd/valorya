# Validation de la livraison v13

## Contrôles effectués

- Analyse syntaxique TypeScript/TSX de tous les fichiers du projet (0 erreur).
- `npm run test:logic` : points (identiques aux formules SQL), prochaine récompense, pourcentages, slug, protection CSV, 8 types de commerce (récompenses valides pour les contraintes de la base), reconnaissance des anciennes catégories libres.
- Rendu visuel de la feuille de style sur des maquettes statiques (caisse en bureau et mobile, carte client mobile).

## Non effectué (à faire de votre côté)

- `npm ci`, `npm run typecheck`, `npm run build` : l'environnement de préparation n'avait pas accès au réseau, les dépendances n'ont pas pu être installées. **Lancez-les avant de déployer** et corrigez les éventuelles erreurs de typage remontées.
- Aucun test avec votre base Supabase, vos emails, vos certificats Apple ou votre compte Google Wallet.
- Les requêtes de la vue d'ensemble (comptages avec jointure `memberships!inner`) sont écrites d'après la structure du schéma : à vérifier avec des données réelles.
- Le lecteur caméra, l'impression de l'affiche et les boutons Wallet demandent un test sur appareil réel.
- `tests/wallet.cjs` (v12) n'a pas pu être rejoué ici (dépendances absentes) ; la route Apple n'a reçu qu'un ajout de couleur de commerce.
