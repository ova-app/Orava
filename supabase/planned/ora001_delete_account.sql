-- ORA-001 · [CONFORMITÉ] Suppression de compte (Apple Guideline 5.1.1(v) + RGPD art. 17)
--
-- RPC `delete_account()` : efface TOUTES les données de l'utilisateur courant
-- (auth.uid()) en une transaction, puis supprime son compte d'authentification.
--
-- ⚠️ SECURITY DEFINER : la suppression de `auth.users` exige des droits que
--    l'utilisateur n'a pas → la fonction s'exécute avec les droits de son
--    propriétaire (postgres). On borne strictement au seul `auth.uid()` : un
--    utilisateur ne peut effacer QUE son propre compte.
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor
--    du dashboard Supabase. Voir supabase/README.md.
-- Idempotent : CREATE OR REPLACE + DELETE bornés par user_id (re-jouable sans effet).
--
-- Storage : on supprime ici les LIGNES `storage.objects` du dossier de l'utilisateur
--    (`${uid}/...` dans `avatars` + `workout-photos`). Le client (delete-account.tsx)
--    supprime EN AMONT les blobs via l'API Storage (best-effort) tant qu'il est encore
--    authentifié — la double passe garantit qu'aucune donnée ne survit.

CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- ── Interactions sociales émises par l'utilisateur ──────────────────────────
  DELETE FROM likes    WHERE user_id = v_uid;
  DELETE FROM comments WHERE user_id = v_uid;
  DELETE FROM follows  WHERE follower_id = v_uid OR following_id = v_uid;

  -- ── Claims + dérivés (tables optionnelles selon l'état des migrations) ───────
  IF to_regclass('public.claim_votes')    IS NOT NULL THEN DELETE FROM claim_votes    WHERE user_id = v_uid; END IF;
  IF to_regclass('public.claim_likes')    IS NOT NULL THEN DELETE FROM claim_likes    WHERE user_id = v_uid; END IF;
  IF to_regclass('public.claim_comments') IS NOT NULL THEN DELETE FROM claim_comments WHERE user_id = v_uid; END IF;
  IF to_regclass('public.claims')         IS NOT NULL THEN DELETE FROM claims         WHERE user_id = v_uid; END IF;
  IF to_regclass('public.profile_photos') IS NOT NULL THEN DELETE FROM profile_photos WHERE user_id = v_uid; END IF;

  -- ── Métriques / signatures Myo ──────────────────────────────────────────────
  DELETE FROM myo_signatures WHERE user_id = v_uid;
  DELETE FROM body_metrics   WHERE user_id = v_uid;
  DELETE FROM workout_metrics
   WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = v_uid);

  -- ── Séances : sets → exercises → interactions des autres → workouts ─────────
  DELETE FROM workout_sets WHERE workout_exercise_id IN (
    SELECT we.id FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = v_uid
  );
  DELETE FROM workout_exercises
   WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = v_uid);

  -- Likes/commentaires posés par d'AUTRES sur mes séances (sinon FK bloque le DELETE workout)
  DELETE FROM likes    WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = v_uid);
  DELETE FROM comments WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = v_uid);

  DELETE FROM workouts WHERE user_id = v_uid;

  -- ── Gyms créées par l'utilisateur ───────────────────────────────────────────
  -- On dissocie (created_by → NULL) plutôt que supprimer : d'autres séances peuvent
  -- référencer ce gym (workouts.gym_id). Prérequis : gyms.created_by nullable.
  UPDATE gyms SET created_by = NULL WHERE created_by = v_uid;

  -- ── Photos Storage (lignes objets ; blobs purgés côté client en amont) ──────
  DELETE FROM storage.objects
   WHERE bucket_id IN ('avatars', 'workout-photos')
     AND (storage.foldername(name))[1] = v_uid::text;

  -- ── Profil applicatif puis compte d'authentification ───────────────────────
  DELETE FROM public.users WHERE id = v_uid;
  DELETE FROM auth.users   WHERE id = v_uid;
END;
$$;

-- Réservé aux utilisateurs authentifiés (chacun ne peut effacer que son propre compte).
REVOKE ALL ON FUNCTION public.delete_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
