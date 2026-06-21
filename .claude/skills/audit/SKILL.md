---
name: audit
description: Audit complet de l'entreprise Ova (due diligence), évalué UNIQUEMENT depuis le repo. Orchestre 7 audits experts en parallèle (produit · marché · business · croissance · technologie · conformité · exécution), puis agrège une note de santé globale /20, un tableau de sous-notes par dimension, les forces, les risques critiques et un plan priorisé. Invoquer pour « analyser toute la boîte comme un panel d'experts » et obtenir une note sur 20.
---

# Audit entreprise Ova — panel multi-experts (due diligence)

## Rôle
Diriger un **panel d'experts** qui audite **toute l'entreprise Ova telle qu'elle est évaluable depuis le repo**, en détermine forces et faiblesses, et rend une **note de santé / d'investment-readiness sur 20**. Barème : startup visant une **valorisation type Strava**.

## Principe directeur — RÈGLE ABSOLUE
On évalue **uniquement ce qui est présent dans le repo** : docs (`Master Plan`, `BACKLOG`, `onboarding`, `rules`), code, config, CI, git, mémoire projet. **Aucune donnée externe** (marché, finances, traction) n'est inventée. Ce qui **manque dans le repo** mais devrait y être = un **constat (angle mort)**, pas une recherche web. Le fil rouge de chaque dimension = l'**écart entre l'ambition documentée et la réalité livrée**.

## Procédure

### 1. Lancer
Annoncer : 7 audits experts en parallèle, périmètre = repo uniquement.

### 2. Fan-out (7 sous-agents EN PARALLÈLE)
Dans **un seul message**, lancer **7 appels Agent** (`subagent_type: general-purpose`). Chaque sous-agent reçoit ce prompt (adapter `<dim>`) :

> « Tu es un auditeur expert de l'entreprise Ova (repo courant, **lecture seule**). Lis `.claude/skills/audit-<dim>/SKILL.md` et **exécute-le intégralement**. Périmètre strict : **uniquement ce qui est évaluable depuis le repo** (docs, code, config, git, mémoire) — aucune donnée externe ; ce qui manque dans le repo est un constat. Confronte toujours l'**ambition documentée** (Master Plan) à la **réalité du code** (BACKLOG/repo). Retourne : (a) sous-note /20 + verdict une ligne, (b) **forces** vérifiées, (c) **faiblesses & angles morts** (gravité + preuve `fichier`/`§` + reco). Termine **impérativement** par la ligne `SCORE: <dimension> = XX/20`. »

Les 7 dimensions / dossiers :
| `<dim>` | dimension |
|---|---|
| `audit-produit` | Produit, Vision & Expérience |
| `audit-marche` | Marché & Positionnement |
| `audit-business` | Business model & Monétisation |
| `audit-growth` | Croissance, Acquisition & Rétention |
| `audit-tech` | Technologie, Architecture & Scalabilité |
| `audit-conformite` | Conformité, Sécurité & RGPD |
| `audit-execution` | Exécution, Process & Organisation |

### 3. Collecte
Récupérer les 7 retours + parser chaque ligne `SCORE: … = XX/20`.

### 4. Note globale /20
Moyenne **pondérée**, arrondie à 0,5 (ambition Strava, phase pré-lancement) :

| Dimension | Poids |
|---|---|
| Produit, Vision & Expérience | ×1,5 |
| Conformité, Sécurité & RGPD | ×1,5 |
| Technologie & Scalabilité | ×1,5 |
| Business model & Monétisation | ×1 |
| Croissance & Rétention | ×1 |
| Marché & Positionnement | ×1 |
| Exécution & Organisation | ×1 |

**Garde-fou** : s'il existe un **bloquant critique** (app non lançable légalement/store, monétisation impossible aujourd'hui, corruption de données possible, build prod cassé), **plafonner la note globale à 11/20** et l'expliquer — une boîte non lançable ne dépasse pas la moyenne, quelle que soit la qualité du reste.

### 5. Rapport (Markdown)
```
# Audit entreprise Ova — <date du jour>
_Périmètre : ce qui est évaluable depuis le repo._
## Note de santé globale : XX/20
> Verdict 3-4 lignes : où en est la boîte, ce qui débloque, ce qui plafonne.

### Sous-notes par dimension
| Dimension | Note | Verdict |
|---|---|---|
| Produit, Vision & Expérience | XX/20 | … |
| Marché & Positionnement | XX/20 | … |
| Business model & Monétisation | XX/20 | … |
| Croissance, Acquisition & Rétention | XX/20 | … |
| Technologie, Architecture & Scalabilité | XX/20 | … |
| Conformité, Sécurité & RGPD | XX/20 | … |
| Exécution, Process & Organisation | XX/20 | … |

### Forces majeures (atouts de la boîte)
- … (consolidées des 7 audits)

### Risques critiques (bloquants)
- **titre** (dimension) — constat + impact entreprise. **Action.**

### Angles morts (ce que le repo ne permet pas d'évaluer)
- … (ex. traction réelle, TAM, finances, CAC — absents du repo)

### Plan priorisé
1. Déblocage lancement (conformité/sécurité) · 2. Revenu & rétention · 3. Scalabilité tech · 4. Le reste.
```

### 6. Proposer un rendu visuel
À la fin, proposer (sans imposer) un **Artifact** HTML présentable (tableau + jauges /20) si l'utilisateur veut.

## Règles
- **Lecture seule** — aucun fichier modifié, aucun ticket écrit sans demande.
- Périmètre repo strict ; séparer toujours **ce qui est prouvé** de **ce qui est affirmé** dans le Master Plan, et lister les **angles morts** non évaluables.
- Réutiliser les IDs `ORA-xxx` ; ne pas re-flagger un ✅ (cf. `BACKLOG.md`).
- Si un sous-agent échoue/renvoie vide : le signaler, ne pas inventer sa note.
- Date du jour fournie par l'environnement — ne pas l'inventer.
