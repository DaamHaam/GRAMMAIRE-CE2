# Consignes étape par étape

Cette fiche récapitule les actions à mener à chaque évolution de l'application pour garder un flux de travail clair.

## 1. Préparation
- [ ] Lire les instructions globales (`AGENTS.md`, consignes du client, versionnement).
- [ ] Vérifier l'état du dépôt avec `git status` et identifier la branche de travail.
- [ ] Lancer une exploration rapide des fichiers concernés pour comprendre l'architecture.

## 2. Conception
- [ ] Lister le comportement attendu et les cas limites (navigation, accessibilité, compatibilité mobile).
- [ ] Confirmer les données à mettre à jour (JSON, textes, journal de version).
- [ ] Prévoir les impacts sur l'interface (HTML/CSS) et sur la logique (JavaScript).

## 3. Implémentation
- [ ] Modifier les composants concernés en respectant le style existant.
- [ ] Ajouter les états nécessaires dans `appState` et rendre l'interface réactive via `render*`.
- [ ] Garder les textes français clairs et adaptés au public visé (élèves de CE2).

## 4. Vérifications
- [ ] Tester les parcours clés : sélection de matière, de défi mathématique, retour en arrière.
- [ ] Vérifier le rendu sur clavier (focus) et l'attribut `aria-hidden` lors des bascules.
- [ ] Relire le `changelog.md` et la version affichée dans `index.html`.

## 5. Finalisation
- [ ] Lancer les vérifications automatiques pertinentes (validation JSON, linters s'ils existent).
- [ ] Résumer les changements dans la Pull Request en français.
- [ ] S'assurer que la branche est propre avant de pousser ou d'ouvrir la PR.
