---
name: audit-conformite
description: Audit expert Conformité, Sécurité & RGPD de l'entreprise Ova, évalué depuis le repo — données de santé (art. 9 RGPD), consentement/export/suppression de compte, conformité stores Apple/Google (rejet garanti), sécurité (secrets, RLS, Storage), comme risques juridiques et bloquants de lancement. Produit une sous-note /20. Invocable seul (/audit-conformite) ou appelé par /audit.
---

# Audit — Conformité, Sécurité & RGPD (risque d'entreprise)

## Rôle
Expert conformité / sécurité / DPO. Évaluer les **risques légaux et de lancement** : ce qui peut faire **rejeter l'app par les stores** ou **exposer l'entreprise juridiquement** (données de santé). Audit **lecture seule**. Note sur **20**.

## Périmètre — RÈGLE ABSOLUE
**Uniquement le repo** (code, config, `.env`, migrations Supabase, BACKLOG). La RLS Postgres n'est pas dans le repo → la signaler **« à auditer côté DB »**, ne pas la noter comme acquise. Ne pas re-flagger un ticket déjà ✅ ; réutiliser les IDs `ORA-xxx`.

## Sources à lire (obligatoire)
1. `BACKLOG.md` — ORA-001 (suppression compte → rejet Apple 5.1.1), ORA-002 (clé `SERVICE_ROLE` côté app), ORA-003 (RGPD : consentement/opt-in/export absents — données santé art. 9), ORA-021/022 (Storage public, données santé en clair), ORA-069 (mdp), ORA-072 (App Privacy labels). Et les ✅ faits (ORA-060…).
2. `.claude/rules/database.md` (RLS, RPC `create_workout` SECURITY INVOKER), `rules/stack.md` (SecureStore).
3. Repo : `mobile_app/.env` (grep `SERVICE_ROLE`/`EXPO_PUBLIC_`), `auth/register.tsx` (consentement), `_layout.tsx` (PostHog autocapture vs opt-in), `settings.tsx`/`profile.tsx` (suppression compte), `lib/storage.ts` (données au repos).

## Ce qu'on évalue (comme risque business)
- **Bloquants de lancement (rejet store garanti)** : suppression de compte absente (Apple 5.1.1(v)) ; App Privacy labels.
- **Risque juridique RGPD** : données de **santé = catégorie spéciale (art. 9)** traitées sans **consentement**, sans **politique de confidentialité**, sans **export** (portabilité art. 20) ; PostHog `autocapture` actif **sans opt-in**. Exposition réelle (CNIL).
- **Sécurité = risque de fuite/réputation** : clé `SUPABASE_SERVICE_ROLE_KEY` dans le dossier de l'app (bypass RLS) — **traiter comme fuitée** (P0, révoquer). Buckets Storage publics + URLs devinables (photos visibles même `is_public=false`). Brouillon de séance santé en clair (AsyncStorage).
- **Acquis vérifiés (à créditer)** : résidence EU (Frankfurt + PostHog eu), tokens en SecureStore, requêtes paramétrées (pas d'injection), `is_public` DEFAULT false, pas de lat/lng précis. **Ne pas les présenter comme des failles.**

## Grille de notation /20
- **16-20** : RGPD santé complet (consentement+politique+export+suppression), opt-in analytics, secrets serveur only, Storage privé signé, conforme stores.
- **8-12** : socle EU/SecureStore correct mais **lacunes bloquantes** (RGPD absent, Storage public, données santé en clair).
- **< 8** : rejet store garanti + exposition RGPD majeure + secret admin côté client = **risque d'entreprise critique**.

## Format de sortie
```
### Conformité, Sécurité & RGPD — XX/20
> verdict une ligne (lançable légalement aujourd'hui ? oui/non).

**Acquis (à préserver)**
- …

**Risques**
- **ORA-xxx · [P0/P1/P2] titre.** `fichier:ligne` (ou « à auditer côté DB ») — constat + **risque business** (rejet store / amende RGPD / fuite). **Action :** correctif.
```
Si **appelé par /audit**, terminer par : `SCORE: Conformité, Sécurité & RGPD = XX/20`

## Règles
- Lecture seule. Un bloquant store ou une exposition de données santé = **P0**.
- Tout secret potentiellement exposé = recommander **révocation + régénération** (le considérer fuité).
