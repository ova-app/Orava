---
name: audit-produit
description: Audit expert Produit, Vision & Expérience de l'entreprise Ova — proposition de valeur, les 4 piliers de différenciation (Myo, Fantôme, Prédictif, ADN), product-market fit, maturité de la roadmap, qualité d'expérience, et surtout l'écart entre l'ambition promise (Master Plan) et ce qui est réellement livré. Produit une sous-note /20. Invocable seul (/audit-produit) ou appelé par /audit.
---

# Audit — Produit, Vision & Expérience

## Rôle
Expert produit / CPO. Auditer la **solidité du produit en tant qu'actif d'entreprise**, pas la dette de code. Audit **lecture seule**. Barème : une startup qui vise une **valorisation type Strava**. Note sur **20**.

## Périmètre — RÈGLE ABSOLUE
On note **uniquement ce qui est évaluable depuis le repo** (docs, code, config, git, mémoire). Pas de données externes. Ce qui devrait exister mais **est absent du repo** (beta, mesure de PMF, retours users) = un **constat (angle mort)**, pas une recherche externe. Le cœur de l'audit = l'**écart entre l'ambition documentée (Master Plan) et ce qui est réellement codé**.

## Sources à lire (obligatoire)
1. `Ova___Master_Plan_v4.md` — §1 Vision & proposition de valeur, §4 Ambitions écosystème (les 4 piliers), §7 Feuille de route, §12 UX Guidelines, §13 KPIs produit.
2. `BACKLOG.md` — état réel du dev (ce qui est ✅ codé vs ⏳ à faire).
3. `onboarding/01-cest-quoi-ova.md` + `05-concepts-metier.md` — le produit raconté simplement.
4. Le repo (`mobile_app/app/`) pour vérifier ce qui **existe vraiment** vs promis.

## Ce qu'on évalue
- **Clarté de la proposition de valeur** : « transforme chaque séance en œuvre de données ». Tient-elle ? Compréhensible en 1 phrase ?
- **Les 4 piliers de différenciation** — pour chacun : ambition Master Plan vs **réalité livrée** :
  - Myo 3D (codé et câblé sur vraies données ? baseline encore mockée — ORA-026, le moat ?)
  - Mode Fantôme (livré Phase 1 ✅ ?)
  - Moteur Prédictif (livré ? affiché à l'utilisateur ?)
  - ADN Athlétique (Phase 3 — encore inexistant ?)
- **Product-Market Fit** : y a-t-il une **preuve** (beta, rétention réelle, retours users) ou seulement des hypothèses ? (Signaler l'absence de signal PMF = angle mort.)
- **Maturité roadmap** : phases réalistes ? Phase 2 en cours, dépendances (paywall, sons, Rive) tenables ?
- **Qualité d'expérience** : la promesse « frictionless / effet Wow » — onboarding < 60 s tenu ? log de série instantané ? Ou friction résiduelle (a11y absente, etc.) ?
- **Risque produit** : Master Plan §14 (Myo trop complexe, Fantôme anxiogène, prédictions imprécises) — mitigés ?

## Grille de notation /20
- **16-20** : vision claire + 4 piliers livrés et différenciants + signal PMF réel + roadmap maîtrisée.
- **10-15** : vision forte et différenciation réelle, mais piliers partiellement livrés (ex. moat Myo mocké, ADN absent) et **zéro preuve de PMF**.
- **< 10** : promesse non tenue par le produit réel, ou différenciation non défendable.

## Format de sortie
```
### Produit, Vision & Expérience — XX/20
> verdict une ligne.

**Forces (atouts vérifiés)**
- …

**Faiblesses & angles morts**
- **[Critique/Majeur/Mineur] titre.** Constat (preuve : §Master Plan / fichier / ou « non documenté »). **Reco :** action.

**Écart ambition ↔ réalité**
- Promesse : … | Réalité livrée : …
```
Si **appelé par /audit**, terminer par : `SCORE: Produit, Vision & Expérience = XX/20`

## Règles
- Lecture seule. Aucun fichier modifié.
- Distinguer **ce qui est promis** (Master Plan) de **ce qui existe** (code/BACKLOG). L'écart est le cœur de l'audit.
- Une absence de donnée (pas de beta, pas de PMF mesuré) = constat à part entière, pas un silence.
