---
name: code-versions
description: Audit des dépendances du codebase Ova (mobile_app) — paquets obsolètes/dépréciés, vulnérabilités connues (npm audit), conflits de peer-deps et dette --legacy-peer-deps, alignement Expo SDK 54 / React Native 0.81.5, versions de TypeScript/Jest/Three/Skia, et risques des bumps majeurs Dependabot. Lecture seule. Invocable seul (/code-versions) ou appelé par /code-audit.
---

# Audit code — Versions & dépendances

## Rôle
Expert gestion de dépendances mobile. Auditer la **santé du graphe de dépendances** et les **risques de version**. Audit **lecture seule** (ne rien installer/mettre à jour).

## Avant de noter
1. Lire `BACKLOG.md` + `.claude/rules/stack.md` : la stack utilise systématiquement `--legacy-peer-deps` ; TypeScript a été bumpé 5→6 par Dependabot (vérifier qu'il ne casse rien) ; `expo install` (pas `npm install`) doit fixer les versions alignées Expo.
2. Lire `mobile_app/package.json` (deps + devDeps + `engines` + scripts) et la présence de `mobile_app/package-lock.json`.

## Méthode (faire réellement, depuis mobile_app/)
- **État obsolète** : tenter `cd mobile_app && npm outdated --json` (si réseau dispo). Sinon, analyse **statique** des versions dans `package.json` vs versions attendues pour Expo SDK 54.
- **Vulnérabilités** : tenter `cd mobile_app && npm audit --json` ; classer par sévérité ; distinguer prod vs dev, et corrigeable vs breaking.
- **Alignement Expo/RN** : Expo 54 + React Native 0.81.5 — chaque paquet `expo-*` et natif (`react-native-reanimated`, `react-native-worklets`, `@shopify/react-native-skia 2.2.12`, `expo-gl 16`, `three 0.184`, `react-native-mmkv`, `expo-sqlite`) est-il à la version **recommandée par le SDK 54** ? (un mismatch = crash natif/EAS).
- **Peer-deps** : repérer ce qui force `--legacy-peer-deps` (conflits non résolus masqués) → dette de version réelle.
- **Majeurs risqués** : TypeScript 6 (bump récent) — `tsc --noEmit` toujours vert ? `jest-expo` aligné avec jest 29 ? Autres majeurs en attente côté Dependabot.
- **Paquets dépréciés / non utilisés** : `@react-three/fiber` installé mais non utilisé (Myo = Three raw) ; tout paquet déprécié signalé par npm.
- **Cohérence lockfile** : `package.json` ↔ `package-lock.json` cohérents ? `.nvmrc` (20) ↔ `engines` (>=20) ?

## Gravités
- **Critique** : vulnérabilité exploitable en prod, mismatch natif Expo/RN cassant le build/runtime.
- **Majeur** : paquet déprécié central, peer-dep cassé masqué, majeur en retard à fort risque.
- **Mineur** : patch/minor en retard sans risque, dev-dep obsolète.

## Format de sortie
```
### Versions & dépendances — N constats (X critiques · Y majeurs · Z mineurs)
- **[Critique/Majeur/Mineur] paquet@version.** Constat (obsolète X→Y / CVE / mismatch SDK / peer-dep) — risque. **Action :** `expo install …` ou montée de version ciblée (préciser si breaking).
```
Si `npm outdated`/`npm audit` échouent (offline), le **dire explicitement** et basculer en analyse statique.
Si **appelé par /code-audit**, terminer par : `SUMMARY: Versions = X critiques, Y majeurs, Z mineurs`

## Règles
- Lecture seule — **ne jamais** lancer `npm install`/`update`/`audit fix`. Seulement `outdated`/`audit` (lecture).
- Toujours recommander `expo install` (pas `npm install`) pour les paquets gérés par le SDK. Nouveau constat → `ORA-1xx`.
