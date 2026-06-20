---
name: code-security
description: Audit sécurité code-level du codebase Orava (mobile_app) — secrets dans le repo/.env/git, mauvais usage EXPO_PUBLIC_, confiance client sur les écritures (RLS), exposition Storage (URLs publiques), données sensibles en clair au repos, crypto/auth, validation des entrées, deep links. Niveau code (distinct de l'audit RGPD/légal /audit-conformite). Lecture seule. Invocable seul (/code-security) ou appelé par /code-audit.
---

# Audit code — Sécurité (niveau code)

## Rôle
Ingénieur sécurité applicative. Trouver les **failles dans le code** (pas le volet juridique/RGPD — ça, c'est `/audit-conformite`). Audit **lecture seule**.

## Avant de noter
1. Lire `BACKLOG.md` — tickets sécurité (ORA-002/020/021/022/069) et ✅ faits (ORA-060 purge SecureStore). **Ne pas re-flagger un ✅.**
2. **Faux positifs déjà écartés (NE PAS ressortir)** : `crypto.randomUUID()` est **polyfillé** (`supabase.ts` + `react-native-get-random-values`) ; requêtes **paramétrées** partout (aucune injection SQL) ; résidence EU ; tokens en SecureStore ; aucune lat/lng précise écrite.
3. Lire `.claude/rules/database.md` (RLS, RPC `create_workout` SECURITY INVOKER) + `.claude/rules/stack.md` (SecureStore chunks).

## Périmètre à scanner (citer fichier:ligne réel)
- **Secrets** : `mobile_app/.env` (gitignored ?), `grep -rn 'SERVICE_ROLE\|EXPO_PUBLIC_\|sk_\|secret\|apikey\|password' mobile_app/` ; clés en dur dans le code et `scripts/`. **Historique git** : la `SERVICE_ROLE_KEY` a transité dans `scripts/import-exercises.ts` (commit `a930629`) → la considérer **fuitée** (révoquer/régénérer).
- **EXPO_PUBLIC_** : tout ce qui est préfixé `EXPO_PUBLIC_` est **embarqué dans le bundle client** → vérifier qu'aucun secret n'y atterrit (une faute de frappe publierait la service_role).
- **Confiance client / RLS** : `.insert(`/`.update(`/`.delete(` où `user_id` vient du client (`(tabs)/feed.tsx`, `workout/summary.tsx`, `edit-profile.tsx`) ; delete filtré par `id` seul. La policy RLS n'est pas dans le repo → marquer **« à durcir côté DB »** (`WITH CHECK (auth.uid() = user_id)`).
- **Storage** : `getPublicUrl` sur `${user.id}/…` → fichiers devinables ; photo de séance accessible même `is_public=false`. `createSignedUrl` + bucket privé requis.
- **Données sensibles au repos** : `lib/storage.ts` — brouillon de séance + `predictions_cache` en **clair** (AsyncStorage), nom trompeur `snapshotToMMKV`. Chiffrer (MMKV `encryptionKey`/SecureStore).
- **Auth** : adaptateur SecureStore (chunks 1800b) — purge des fragments orphelins (ORA-060 ✅), pas de token en clair ailleurs.
- **Validation d'entrée** : longueur commentaire (`maxLength` ORA-023), politique mot de passe (`register.tsx`), uploads (type/taille).
- **Exécution dynamique** : `eval`, `Function(`, `require(` dynamique, deep links non validés, `dangerouslySetInnerHTML`-like.

## Gravités
- **Critique** : secret exploitable embarqué/fuité (service_role), bypass d'autorisation, exposition de données utilisateur.
- **Majeur** : Storage public devinable, données sensibles en clair, confiance client non doublée par RLS.
- **Mineur** : validation faible, durcissement manquant.

## Format de sortie
```
### Sécurité (code) — N constats (X critiques · Y majeurs · Z mineurs)
- **[Critique/Majeur/Mineur] (ORA-xxx si connu) titre.** `fichier:ligne` (ou « à durcir côté DB ») — faille + vecteur. **Fix :** correctif.
```
Si **appelé par /code-audit**, terminer par : `SUMMARY: Sécurité = X critiques, Y majeurs, Z mineurs`

## Règles
- Lecture seule. Tout secret potentiellement exposé = **Critique** + recommander **révocation/régénération**.
- `fichier:ligne` réel. Nouveau constat → `ORA-1xx`. Ne pas confondre avec le volet RGPD (→ `/audit-conformite`).
