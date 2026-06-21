---
name: audit-business
description: Audit expert Business model, Monétisation & Finances de l'entreprise Ova — structure tarifaire Free/Pro/Coach, logique d'upsell, revenus additionnels (marketplace, B2B, nutrition), objectifs ARR, unit economics (LTV/CAC), réalisme des hypothèses, et état réel de l'implémentation monétisation. Produit une sous-note /20. Invocable seul (/audit-business) ou appelé par /audit.
---

# Audit — Business model, Monétisation & Finances

## Rôle
Expert business model / finance startup (regard CFO + VC). Évaluer **la capacité à générer du revenu et sa viabilité**. Audit **lecture seule**. Note sur **20**.

## Périmètre — RÈGLE ABSOLUE
On note **uniquement ce qui est évaluable depuis le repo** (Master Plan, code, config, git). Pas de données externes ni benchmark inventé. Confronter systématiquement le **modèle documenté** (Master Plan §3) à son **implémentation réelle dans le code** (RevenueCat, gating `plan`). Ce qui manque (modèle financier détaillé, CAC, unit economics) = **constat**, pas recherche externe.

## Sources à lire (obligatoire)
1. `Ova___Master_Plan_v4.md` — §3 Modèle de monétisation (tarifs, upsells, revenus additionnels, objectifs ARR), §4 (gating Free/Pro/Coach par feature), §13 KPI conversion.
2. `BACKLOG.md` — ORA-010 (RevenueCat absent = revenu 0), ORA-063 (gating ghost Pro jamais appliqué).
3. Repo : `react-native-purchases` dans `mobile_app/package.json` ? `app/paywall.tsx` existe ? `users.plan` réellement **lu** pour gater une feature ?

## Ce qu'on évalue
- **Structure tarifaire** : Free / Pro (9,99 €/mois · 79 €/an) / Coach (24,99 €/mois) — cohérente vs concurrence (Hevy/Strong ~ même gamme) ? Le découpage Free/Pro crée-t-il une frustration douce vendeuse (Fantôme 30 j, Prédictif verrouillé) ?
- **Logique d'upsell** : les déclencheurs (Prédictif verrouillé, ADN Coach partageable) sont-ils réellement implémentés ou seulement décrits ?
- **Revenus additionnels** : commission marketplace 15 %, Pass Ova B2B salles, OvaFeed 3,99 € — crédibles à ce stade ou Phase 3+ lointaine/spéculative ?
- **Objectifs financiers** : 10k users → 8 % → ~95k € ARR à 12 mois ; 150k → 12 % → ~1,8 M€ à 36 mois. **Hypothèses réalistes ?** Le taux de conversion 8-12 % est **agressif** pour du freemium consumer (benchmark courant 2-5 %). ARR = users × conv × prix — vérifier la cohérence arithmétique et signaler l'optimisme.
- **Unit economics** : LTV/CAC mentionnés ? CAC inconnu (aucun canal d'acquisition chiffré) → **angle mort majeur**. Coûts variables (Supabase, RevenueCat 1 % fee, EAS, PostHog) vs ARPU.
- **Réalité d'implémentation** : monétisation **non branchée** aujourd'hui → revenu actuel = 0. C'est l'écart le plus dur.

## Grille de notation /20
- **16-20** : pricing validé par le marché, gating implémenté, hypothèses ARR sourcées et prudentes, unit economics positifs documentés.
- **10-15** : modèle clair et plausible sur le papier, mais **conversion optimiste**, CAC inconnu, et **monétisation pas encore branchée**.
- **< 10** : aucun revenu possible à court terme, hypothèses non étayées, pas de chemin clair vers la rentabilité.

## Format de sortie
```
### Business model, Monétisation & Finances — XX/20
> verdict une ligne.

**Forces (atouts vérifiés)**
- …

**Faiblesses & angles morts**
- **[Critique/Majeur/Mineur] titre.** Constat (preuve : §Master Plan / fichier / ou « non documenté »). **Reco :** action.

**Réalité d'implémentation**
- Monétisation branchée ? Gating `plan` actif ? Revenu possible aujourd'hui ?
```
Si **appelé par /audit**, terminer par : `SCORE: Business & Monétisation = XX/20`

## Règles
- Lecture seule. Re-vérifier l'arithmétique des objectifs ARR ; signaler tout optimisme non justifié.
- Un revenu structurellement impossible aujourd'hui (RevenueCat absent) = constat **Critique**.
