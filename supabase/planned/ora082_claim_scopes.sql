-- ORA-082 — Échéances de claim étendues.
--
-- Le claim de charge peut désormais viser, en plus de « prochaine séance » :
--   - 'week'   → J-7  (cette semaine)
--   - 'month'  → J-30 (ce mois-ci)
--   - 'custom' → date choisie par l'utilisateur (deadline arbitraire)
-- La résolution reste pilotée par `deadline` (succès dès la cible atteinte avant
-- l'échéance ; échec quand l'échéance passe — cron ORA-077 + expireOverdueClaims).
-- 'next_session' garde sa résolution au prochain save (deadline NULL).
--
-- ⚠️ À APPLIQUER À LA MAIN (SQL Editor) — idempotent.

ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_scope_check;
ALTER TABLE public.claims ADD CONSTRAINT claims_scope_check
  CHECK (scope IN ('next_session', 'week', 'month', 'custom'));
