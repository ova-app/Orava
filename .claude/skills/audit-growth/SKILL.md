---
name: audit-growth
description: Audit expert Croissance, Acquisition & Rétention de l'entreprise Ova, évalué depuis le repo — boucles virales (Myo/prédiction en Stories), social feed, mécaniques de rétention (Fantôme, streaks, ADN), re-engagement (push), instrumentation analytics, et confrontation des KPIs cibles (Master Plan §13) à ce qui est réellement codé pour les atteindre. Produit une sous-note /20. Invocable seul (/audit-growth) ou appelé par /audit.
---

# Audit — Croissance, Acquisition & Rétention (vue repo)

## Rôle
Expert growth / rétention. Évaluer **les leviers d'acquisition, de rétention et de viralité réellement implémentés**, vs les KPIs visés. Audit **lecture seule**. Note sur **20**.

## Périmètre — RÈGLE ABSOLUE
**Uniquement ce qui est évaluable depuis le repo** (code, docs, config analytics, git). Pas de données de traction externes. Confronter les **KPIs cibles** (Master Plan §13) aux **mécaniques réellement codées** pour les atteindre. Une boucle promise mais non codée = **constat**.

## Sources à lire (obligatoire)
1. `Ova___Master_Plan_v4.md` — §13 KPIs (rétention D7 >45 %, D30 >28 %, séances/sem >2,5, partages Myo >15 %, prédictions partagées >20 %), §4.4 (viralité Stories), §4.2 (OvaFeed).
2. `BACKLOG.md` — ORA-042 (push/Stories/deep links absents = pas de re-engagement), ORA-030 (feed non paginé).
3. Repo : `mobile_app/lib/analytics.ts` (PostHog, taxonomie d'événements — mesure-t-on le funnel/rétention ?), `(tabs)/feed.tsx` (social), `lib/ghost.ts` + streaks (raisons de revenir), `expo-notifications` présent ? export Stories `makeImageSnapshot` codé ?

## Ce qu'on évalue
- **Boucles virales** : le Master Plan mise sur Myo 3D partagé + « prédiction réalisée » en Story 9:16. **Le partage est-il codé** ou seulement annoncé (ORA-042) ? Sans partage, pas de boucle K>0.
- **Acquisition** : le repo documente-t-il un **canal d'acquisition** (ASO, referral, contenu) ? (Probablement non → angle mort : produit pensé, distribution non.)
- **Rétention** : mécaniques codées qui ramènent l'utilisateur — Mode Fantôme (✅), streaks, ADN (Phase 3, absent). **Push de re-engagement absent** (expo-notifications non installé) → la rétention repose uniquement sur la motivation intrinsèque.
- **Instrumentation** : `analytics.ts` permet-il de **mesurer** rétention/funnel/conversion ? PostHog branché mais (cf. conformité) sans opt-in. Sans mesure → on pilote à l'aveugle.
- **Réalisme des cibles §13** : D7 >45 % / D30 >28 % sont **ambitieux** pour du fitness (rétention notoirement basse). Le repo donne-t-il des moyens crédibles d'y arriver ?

## Grille de notation /20
- **16-20** : boucles virales codées (partage natif), re-engagement push actif, rétention multi-leviers, funnel mesuré, canal d'acquisition identifié.
- **10-15** : fortes intentions et social feed présent, mais **viralité non codée**, **push absent**, acquisition non documentée → rétention non démontrable.
- **< 10** : aucun levier de rétention/viralité implémenté, aucune mesure.

## Format de sortie
```
### Croissance, Acquisition & Rétention — XX/20
> verdict une ligne.

**Forces (codées / mesurables)**
- …

**Faiblesses & angles morts**
- **[Critique/Majeur/Mineur] titre.** Constat (preuve : fichier / §Master Plan / ou « absent du repo »). **Reco :** action.

**KPIs cibles ↔ moyens codés**
- Pour chaque KPI clé : moyen de l'atteindre présent dans le code ? oui/non.
```
Si **appelé par /audit**, terminer par : `SCORE: Croissance & Rétention = XX/20`

## Règles
- Lecture seule. Une boucle = réelle seulement si **codée et mesurable**, pas si « prévue ».
