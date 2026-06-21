---
name: audit-marche
description: Audit expert Marché & Positionnement de l'entreprise Ova, évalué UNIQUEMENT depuis le repo — qualité et cohérence de l'analyse concurrentielle documentée (Master Plan §2), solidité du positionnement, défendabilité du moat (Myo/Fantôme/Prédictif/ADN), et ce qui manque dans le repo pour étayer la stratégie marché (TAM, sourcing). Produit une sous-note /20. Invocable seul (/audit-marche) ou appelé par /audit.
---

# Audit — Marché & Positionnement (vue repo)

## Rôle
Expert stratégie (regard VC). Évaluer **la solidité de la stratégie marché telle qu'elle est documentée et étayée dans le repo**. Audit **lecture seule**. Note sur **20**.

## Périmètre — RÈGLE ABSOLUE
On note **uniquement ce qui est évaluable depuis le repo** (docs, code, config, git, mémoire). **Aucune donnée marché externe** n'est importée. Ce qui devrait étayer la stratégie mais **est absent du repo** = un **constat (angle mort)**, jamais une recherche web.

## Sources à lire (obligatoire)
1. `Ova___Master_Plan_v4.md` — §2 Analyse concurrentielle, §1 Positionnement, §4.5 (switching cost ADN), §14 (risque « concurrents copiant le Myo 3D »).
2. `BACKLOG.md` — différenciateurs réellement livrés (le moat est-il codé ?).
3. `onboarding/01-cest-quoi-ova.md` — la promesse vulgarisée.

## Ce qu'on évalue
- **Cohérence interne de l'analyse §2** : la grille concurrents (Strong/Hevy, Whoop/Garmin, MyFitnessPal, Strava) est-elle structurée, les « faiblesses exploitables » sont-elles argumentées ou affirmées ? Le « vide occupé » est-il logiquement déduit ?
- **Positionnement** : la combinaison « frictionless + viz belle + prédictif + identité portable » est-elle claire et tenue par les 4 piliers ?
- **Défendabilité (moat) — confronter le discours au code** : le Master Plan dit court terme = Myo/Fantôme (facilement copiables), long terme = ADN non exportable (switching cost). **Le moat long terme est-il déjà amorcé dans le code ?** (ADN = Phase 3, inexistant ; baseline Myo mockée — ORA-026). → moat aujourd'hui surtout **narratif**.
- **Quantification absente** : le repo contient-il un **TAM/SAM/SOM**, un sourcing des affirmations marché ? (Quasi certainement non → angle mort majeur à signaler.)
- **Risque concurrentiel** : §14 reconnaît la copiabilité ; la mitigation (« avancer vite ») est-elle crédible vu la vélocité observable dans git ?

## Grille de notation /20
- **16-20** : analyse concurrentielle rigoureuse + positionnement unique + moat déjà amorcé dans le code + marché quantifié et sourcé dans le repo.
- **10-15** : différenciation réelle et créneau crédible **sur le papier**, mais moat narratif (non encore codé) et **aucune quantification de marché dans le repo**.
- **< 10** : analyse superficielle, avantage non défendable, stratégie marché non documentée.

## Format de sortie
```
### Marché & Positionnement — XX/20
> verdict une ligne.

**Forces (étayées dans le repo)**
- …

**Faiblesses & angles morts**
- **[Critique/Majeur/Mineur] titre.** Constat (preuve : §Master Plan / fichier / ou « absent du repo »). **Reco :** action.

**Moat — verdict (discours vs code)**
- Court / Moyen / Long terme : amorcé dans le code, ou seulement décrit ?
```
Si **appelé par /audit**, terminer par : `SCORE: Marché & Positionnement = XX/20`

## Règles
- Lecture seule. Zéro donnée externe — si une affirmation marché n'est pas sourcée dans le repo, le dire.
- Toujours confronter le **discours stratégique** (Master Plan) à la **réalité du code** (BACKLOG/repo).
