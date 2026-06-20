---
name: code-audit
description: Audit ingénierie complet de tout le codebase Orava (mobile_app) — structure & choix de code, bugs réels (vérifiés), versions/dépendances, sécurité code-level. Orchestre 4 audits experts en parallèle, dédoublonne et priorise les constats en un rapport unique actionnable (Critique/Majeur/Mineur, fichier:ligne, fix). Distinct de /audit (entreprise) et de /code-review (diff). Invoquer pour « audit complet du code ».
---

# Code-audit — audit ingénierie complet du codebase

## Rôle
Diriger un **panel d'ingénieurs** qui auditent **tout le code** de `mobile_app/` (pas le diff, pas la boîte) et produisent **un rapport unique, priorisé, actionnable** : structure, bugs, versions, sécurité.

## Périmètre
- Cible : `mobile_app/` (+ `supabase/`, config, `.github/`). **Lecture seule.**
- Cohérence dette : lire `BACKLOG.md` → **ne pas re-flagger un ✅**, réutiliser les IDs `ORA-xxx`, respecter les **faux positifs déjà écartés** (crypto polyfillé, race addExercise inexistante, computePodium strict = voulu).
- Différence avec les autres : `/audit` = entreprise (altitude business) ; `/code-review` & `/security-review` = **diff** courant ; **ici = tout le codebase, ligne par ligne**.

## Procédure

### 1. Lancer
Annoncer : 4 audits code experts en parallèle sur tout le codebase.

### 2. Fan-out (4 sous-agents EN PARALLÈLE)
Dans **un seul message**, lancer **4 appels Agent** (`subagent_type: general-purpose`). Donner à `code-bugs` un effort élevé (`effort: high`) — c'est le plus exigeant. Prompt par sous-agent (adapter `<dim>`) :

> « Tu es un auditeur ingénieur du codebase Orava (`mobile_app/`, **lecture seule**). Lis `.claude/skills/<dim>/SKILL.md` et **exécute-le intégralement sur tout le codebase** (pas seulement le diff). Lis `BACKLOG.md` pour ne pas re-flagger un ✅ ni ressortir un faux positif écarté. Cite des `fichier:ligne` réels (lis les fichiers). Retourne tes constats au format du skill, avec gravité (Critique/Majeur/Mineur) et un **fix** concret. Termine **impérativement** par la ligne `SUMMARY: <aire> = X critiques, Y majeurs, Z mineurs`. »

Les 4 : `code-structure`, `code-bugs`, `code-versions`, `code-security`.

### 3. Consolidation
- Récupérer les 4 retours + parser les lignes `SUMMARY:`.
- **Dédoublonner** les constats qui se recoupent (un même `fichier:ligne` peut être à la fois bug + sécurité → fusionner, garder la gravité max + tagger les axes).
- **Prioriser** : Critique → Majeur → Mineur ; à gravité égale, trier par impact (data/sécurité d'abord).

### 4. Rapport (Markdown)
```
# Code-audit Orava — <date du jour>
_Périmètre : tout le codebase mobile_app/ (lecture seule)._

## Synthèse
| Aire | Critiques | Majeurs | Mineurs |
|---|---|---|---|
| Structure | … | … | … |
| Bugs | … | … | … |
| Versions | … | … | … |
| Sécurité | … | … | … |
| **Total** | … | … | … |
> Verdict 2-3 lignes : santé du code, ce qui doit être corrigé en premier.

## 🔴 Critiques (à corriger avant tout)
- **[axe(s)] titre.** `fichier:ligne` — constat (+ repro si bug). **Fix :** …

## 🟠 Majeurs
- …

## 🟡 Mineurs (dette)
- … (regrouper si nombreux)
```

### 5. Proposer la suite (ne pas l'imposer)
- Proposer d'**écrire les constats comme tickets `ORA-1xx` dans `BACKLOG.md`** (uniquement si l'utilisateur confirme).
- Proposer un **Artifact** HTML présentable (tableau + filtres par gravité) si voulu.
- Proposer de **corriger** un lot (ex. tous les Critiques) — séparément, sur demande.

## Règles
- **Lecture seule** par défaut — aucune écriture (code ou `BACKLOG.md`) sans confirmation explicite.
- `fichier:ligne` réels uniquement. Réutiliser les IDs `ORA-xxx` ; nouveaux → `ORA-1xx`.
- Un bug non reproductible après relecture **ne figure pas** dans le rapport (zéro faux positif).
- Si un sous-agent échoue/renvoie vide : le signaler, ne pas inventer ses constats.
- Date du jour fournie par l'environnement — ne pas l'inventer.
