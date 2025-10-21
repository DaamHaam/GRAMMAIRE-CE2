# DEV

## Objectif du repo
Entraînement CE2 au repérage du groupe sujet (GS), du verbe noyau du groupe verbal et d'un groupe nominal complément.

## Structure
- `/public` : assets statiques (pictogrammes GS / Verbe / GN).
- `/src` : logique UI et composants (fichiers JavaScript et feuilles de style).
- `/data/phrases.json` : phrases annotées avec les segments interactifs.
- `/docs` : documentation (ce fichier et LATER.md).

## Lancer en local
1. Ouvrir `index.html` dans un navigateur moderne (desktop, mobile ou tablette).
2. Aucun serveur n'est requis, tout est statique.

## Conventions
- Rôles : utiliser les libellés `GS`, `VERBE`, `GN` pour les segments et les clés de données.
- Format de données : chaque entrée dans `phrases.json` contient `id`, `level`, `text` et un tableau `parts` avec des objets `{ type: 'text' | 'segment', role?, text }`.
- Messages de commit : courts et descriptifs (ex : `feat: ajouter mode drag tactile`).

## Itération
- Ajouter 5 à 10 phrases tests supplémentaires par niveau avant d'élargir le périmètre.
- Vérifier le comportement tactile (tablette/smartphone) à chaque ajout d'interaction.
- Garder les feedbacks textuels courts et positifs.
