# Valorya — nouvelle identité

Cette archive reprend le projet PME v13 fourni et applique le nom **Valorya**, avec la palette « Confiance & croissance ».

## Palette

- Bleu nuit : `#102D46` — titres, navigation et grandes sections de l’accueil.
- Émeraude : `#109B81` — symbole, accents et illustrations.
- Blanc cassé : `#F7FAFC` — fonds clairs.
- Émeraude foncé : `#0B806C` — boutons et petits textes pour une meilleure lisibilité.
- Gris ardoise : `#526174` — textes secondaires.

## Changements

Nom, métadonnées, textes de l’accueil, navigation, pieds de page, espace commerçant, espace client et documents actualisés. Emblème V vectoriel partagé, favicon et icônes Wallet actualisés. Les couleurs personnalisées des commerçants restent disponibles. Les identifiants techniques historiques sont conservés pour la compatibilité avec les préférences locales et les classes Google Wallet existantes.

## Remplacer le projet sur Vercel

1. Décompressez le ZIP.
2. Copiez son contenu dans le dossier local de votre dépôt, en conservant les sous-dossiers.
3. Avec GitHub Desktop, enregistrez les changements (Commit), puis publiez-les (Push origin).
4. Le dépôt doit afficher `app/`, `components/`, `lib/`, `supabase/` et `package.json` côte à côte.
5. Vercel : Root Directory = `./` si ces éléments sont à la racine du dépôt.

Conservez les variables d’environnement de votre installation. Cette mise à jour graphique ne nécessite pas de migration SQL ni de réinitialisation de base. Pour une première installation, consultez `MISE-EN-SERVICE.md`.

## Vérifications

- TypeScript : OK.
- Tests existants de logique et Wallet : OK.
- Compilation Next.js de production : OK, avec un contournement local de l’indisponibilité des statistiques mémoire du système de test ; ce contournement n’est pas inclus dans le projet.
- Aucun déploiement ni test sur une base Supabase réelle n’a été effectué.
- Le navigateur de contrôle n’a pas pu démarrer dans cet environnement : la vérification visuelle sur ordinateur et mobile reste à effectuer après déploiement.
