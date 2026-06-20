-- ORA-077 — Résolution SERVEUR des claims expirés (cron horaire).
--
-- Passe en 'failed' tout claim 'active' dont la deadline est dépassée, MÊME si l'utilisateur
-- n'a pas rouvert l'app. Côté client, expireOverdueClaims() ne s'exécute qu'à l'ouverture
-- profil/feed → un claim 'sessions' raté ne basculait en échec qu'au retour de l'user.
-- Ce cron garantit la cohérence du track record + des events feed pour les inactifs.
--
-- Choix (cf. .claude/rules/database.md, section « Vitrine sociale ») : la résolution
-- 'succeeded' reste CÔTÉ CLIENT au save (immédiateté, célébration). Le serveur ne gère QUE
-- les expirations (échec doux). Idempotent côté résolution : ne touche que status='active'.
--
-- ⚠️ Prérequis : migration `claims_and_featured_pr.sql` (ORA-075) appliquée.
-- ⚠️ À APPLIQUER À LA MAIN (SQL Editor du dashboard). Idempotent (ré-exécutable).
-- Chemin zéro-infra (pas de déploiement Edge Function). Pour le hook push (ORA-078),
-- voir l'alternative Edge Function : supabase/functions/resolve-claims/index.ts.

-- ─── 1. Fonction de résolution (atomique) ─────────────────────────────────────
-- SECURITY DEFINER : le cron tourne hors session utilisateur → on doit ignorer la RLS
-- (écriture serveur légitime, distincte d'ORA-002 = clé service_role dans le client).
CREATE OR REPLACE FUNCTION public.resolve_overdue_claims()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.claims
  SET status         = 'failed',
      resolved_value = progress_current,  -- valeur réellement atteinte (near-miss, ORA-081)
      resolved_at    = now()
  WHERE status = 'active'
    AND deadline IS NOT NULL
    AND deadline < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_overdue_claims() FROM public, anon, authenticated;

-- ─── 2. Planification horaire via pg_cron ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotence : déprogramme l'ancien job homonyme avant de (re)programmer.
SELECT cron.unschedule('resolve-overdue-claims')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resolve-overdue-claims');

SELECT cron.schedule(
  'resolve-overdue-claims',
  '0 * * * *',                              -- toutes les heures, à la minute 0
  $cron$SELECT public.resolve_overdue_claims();$cron$
);

-- Vérifier : SELECT * FROM cron.job WHERE jobname = 'resolve-overdue-claims';
-- Historique : SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
