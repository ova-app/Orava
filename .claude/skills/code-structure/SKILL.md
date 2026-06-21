---
name: code-structure
description: Audit ingénierie de la structure et des choix de code du codebase Ova (mobile_app) — god-objects, duplication, couplage, séparation des responsabilités (lib/hooks vs UI), TypeScript strict, dead code, respect de l'arborescence app/, anti-patterns. Lecture seule, ligne par ligne, tout le codebase. Produit une liste de constats par gravité. Invocable seul (/code-structure) ou appelé par /code-audit.
---

# Audit code — Structure & choix techniques

## Rôle
Architecte logiciel. Audit **ligne par ligne, tout le codebase** (pas le diff). Évaluer la **qualité structurelle et les choix de code**. Audit **lecture seule**.

## Avant de noter
1. Lire `BACKLOG.md` — ce qui est déjà ✅ (ORA-009/033/031/034/035/036/068) : **ne pas re-flagger**. Réutiliser les IDs.
2. Lire `.claude/rules/files.md` (arborescence, `components/` pure, types inline) + `.claude/CLAUDE.md` (règles impératives) + `.claude/rules/ui.md` (anti-patterns).

## Méthode (faire réellement)
- **Mesurer les god-objects** : lister les plus gros fichiers (`mobile_app/app/`, `mobile_app/lib/`) par nombre de lignes (`wc -l`), repérer les écrans/contextes surchargés (`summary.tsx`, `session.tsx`, `(tabs)/feed.tsx`, `workout/myo-orb.tsx`, `WorkoutContext.tsx`).
- **Typage strict** : `grep -rn ': any\| as \|as unknown\|@ts-ignore\|@ts-expect-error' mobile_app/` (hors `node_modules`/tests). Régression vs ORA-036 (0 `any`) ?
- **Duplication** : les helpers `lib/muscles.ts`, `lib/weights.ts`, `lib/utils.ts`, `lib/logger.ts` sont-ils utilisés partout, ou recopies locales subsistantes ?
- **Séparation des responsabilités** : data extraite en `lib/hooks/` (ORA-034) ou fetch + logique métier inline dans les écrans ? Logique pure isolée et testable ?
- **Respect structure** : `components/` reste pur (pas de hook/Context, exception `RulerPicker`) ? `types/index.ts` et `constants/Colors.ts` vides (par règle) ? dossiers hors spec ?
- **Hooks** : appels conditionnels / dans des helpers (rules-of-hooks, ORA-033) ?
- **Dead code / imports** : exports inutilisés, code mort, deps importées non utilisées (`@react-three/fiber` ?).
- **Cohérence** : conventions de nommage (kebab fichiers, PascalCase composants, camelCase fns, snake_case DB).

## Gravités
- **Critique** : choix structurant qui bloque l'évolution ou casse une règle impérative.
- **Majeur** : god-object, duplication large, couplage fort, `any`/`as` nombreux.
- **Mineur** : smell, dead code, incohérence de nommage.

## Format de sortie
```
### Structure & choix de code — N constats (X critiques · Y majeurs · Z mineurs)
- **[Critique/Majeur/Mineur] (ORA-xxx si connu) titre.** `fichier:ligne` — constat + impact. **Fix :** correctif concret.
```
Si **appelé par /code-audit**, terminer par : `SUMMARY: Structure = X critiques, Y majeurs, Z mineurs`

## Règles
- Lecture seule. `fichier:ligne` réel (le lire). Nouveau défaut → `ORA-1xx`. Ne pas re-flagger un ✅.