---
name: code-bugs
description: Chasse aux vrais bugs dans le codebase Ova (mobile_app) — erreurs de logique, races, async/await mal géré, null/undefined, divisions par zéro, closures périmées (RAF/setInterval), pièges Reanimated/expo-gl/SQLite, edge cases. Chaque bug candidat est vérifié de façon adversariale (tenter de le réfuter en lisant le chemin réel) avant d'être retenu. Lecture seule. Invocable seul (/code-bugs) ou appelé par /code-audit.
---

# Audit code — Bugs

## Rôle
Ingénieur QA adversarial. Trouver les **vrais bugs de correction** dans **tout le codebase**, pas du style. Audit **lecture seule**.

## Avant de chasser
1. Lire `BACKLOG.md` — section « Faux positifs écartés » et tickets ✅ : **ne pas les ressortir**. Notamment : `crypto.randomUUID()` est **polyfillé** (`supabase.ts`) ; la « race addExercise » est **inexistante** (ajout au state après l'`await`). Comportement **voulu** (pas un bug) : `computePodium` utilise des comparaisons strictes `>` (égaler un PR ne donne pas gold — documenté).
2. Lire `.claude/rules/workout.md` (save, PR, ghost), `.claude/rules/myo.md` (normalisation), `.claude/rules/stack.md` (pièges expo-gl/Reanimated).

## Où chasser (fichiers à forte logique — les lire vraiment)
- `context/WorkoutContext.tsx` — machine d'état, détection PR temps réel, `rest_seconds` (delta ms), top-3.
- `lib/myo.ts` — `computeMuscleDims`, normalisation (`raw 0 → dim 0`, garde `|| 1`), accumulation par dim.
- `app/workout/summary.tsx` — save transactionnel (RPC, idempotence `workoutId` ref), `setsByExercise` (filtrage warmup), insert SQLite après succès, best-effort non bloquants.
- `lib/predictor.ts` — régression pondérée, seuil confiance, extrapolation `daysUntilPR`.
- `lib/ghost.ts` / `lib/db.ts` — requêtes SQLite, migrations `PRAGMA user_version`, idempotence PK.
- `app/workout/session.tsx` — timer, rest timer (250/2500ms), flash PR, ghost.
- `app/workout/myo-orb.tsx` — closures RAF/`setInterval` (`prevSel`, `sceneRotYRef`), allocations hors boucle, raycasting.
- `(tabs)/feed.tsx` / `feed/[id].tsx` — likes optimistes + revert, agrégats.

## Classes de bugs à traquer
- **Async** : `await` manquant, promesse non gérée, ordre d'effets, double-fire, état mis à jour après unmount.
- **Null/undefined** : accès non gardé, `?? 0` masquant une vraie absence, `NaN` propagé.
- **Maths** : division par zéro (dénominateurs), arrondis, `tabular`/parsing de nombres, fuseaux/timestamps (UNIX ms vs s).
- **State** : closures périmées (RAF, `setInterval`, `useCallback`/deps), mutation directe, `setState` dans un worklet Reanimated.
- **Concurrence/retry** : double-save, double-comptage SQLite, race au focus (TTL feed).
- **expo-gl** : `onContextCreate` async, matériau WebGL2, `endFrameEXP` manquant, fuite GPU.
- **Edge cases** : 1re séance (ghost null), 0 set, warmup-only, liste vide, valeurs extrêmes.

## Vérification adversariale (obligatoire avant de retenir un bug)
Pour **chaque** bug candidat : relire le **chemin de code réel** et tenter de le **réfuter** (garde existante ? polyfill ? ordre garanti ?). Ne retenir que ceux qui **survivent**. Indiquer le **scénario de reproduction** concret. En cas de doute non levé → marquer `confiance: à confirmer`.

## Gravités
- **Critique** : crash, perte/corruption de données, calcul faux silencieux (PR/Myo/save).
- **Majeur** : comportement faux dans un cas courant, fuite mémoire, jank fonctionnel.
- **Mineur** : edge case rare, dégradation cosmétique.

## Format de sortie
```
### Bugs — N confirmés (X critiques · Y majeurs · Z mineurs)
- **[Critique/Majeur/Mineur] titre.** `fichier:ligne` — bug + **repro** (étapes/scénario) + **pourquoi** (chemin réel). **Fix :** correctif. _(confiance: confirmé / à confirmer)_
```
Si **appelé par /code-audit**, terminer par : `SUMMARY: Bugs = X critiques, Y majeurs, Z mineurs`

## Règles
- Lecture seule. **Zéro faux positif** : un bug non reproductible après relecture n'est pas listé.
- Toujours un `fichier:ligne` réel + un scénario. Nouveau bug → `ORA-1xx`.
