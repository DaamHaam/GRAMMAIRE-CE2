# Repository Guidelines

## Project Structure & Module Organization
`index.html` is the single-page entry point and must always reference the current app version. Interactive logic lives in `src/main.js` (UI flow) and `src/storage.js` (progress persistence), while shared styles sit in `src/styles.css`. Pedagogical data is defined in `data/phrases.json` (annotated segments) and `data/maths.json` (défis arithmétiques). Static assets such as role pictograms are stored under `public/pictos`. Long-form documentation, including the project roadmap, is maintained in `docs/`.

## Build, Test, and Development Commands
The app is static. Open `index.html` directly in a modern browser for local testing. When you need a local server (for service worker validation), run `python3 -m http.server 4173` from the repository root and navigate to `http://localhost:4173/`. Use `git status` before and after each task to confirm the working tree, and `npx prettier --check "src/**/*.js"` if you introduce Prettier locally—do not commit formatting-only runs.

## Coding Style & Naming Conventions
Follow the existing ES module structure (`import { … } from './storage.js'`). Use two spaces for indentation in JavaScript and CSS. Roles and keys must reuse the canonical labels `SUBJECT`, `VERB`, `COMPLEMENT`, and `GS`/`VERBE`/`GN` when updating data files. Keep UI copy concise, in French, and age-appropriate (CE2). Avoid introducing new global state; extend `appState` and renderer helpers instead.

## Testing Guidelines
There is no automated test suite—rely on manual verification. Confirm level progression, badge streak handling, and data persistence after each change (refresh and reopen to ensure `localStorage` logic remains intact). Test interaction both with mouse and touch, and verify keyboard focus states along with `aria-hidden` toggles when panels change. For data updates, ensure every `part` entry in JSON files validates by running a quick `node -e "require('./data/phrases.json')"` check.

## Commit & Pull Request Guidelines
Craft concise commits using the existing pattern (`feat:`, `fix:`, `refactor:`, `docs:`). Group related modifications and mention the affected module (`feat: niveau 4 feedback`). Update `changelog.md` when the change is user-visible. Pull requests should reiterate the goal, list key impacts, link any tracker issue, and include screenshots or short clips for UI tweaks. Always highlight manual test coverage in the PR body.

## Versioning & Release Notes
At every shipped change, bump the visible version string in `index.html` (`v0.09` → `v0.10`) and document the reason in the PR or delivery log, mirroring the guidance in `VERSIONING.md`. Keep `docs/consignes.md` in sync when workflows evolve so incoming contributors can follow the same release path.
