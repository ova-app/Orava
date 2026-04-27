-- ============================================================
-- ORAVA — Session 07 — RLS complet + index
-- À appliquer dans : Supabase Dashboard > SQL Editor
-- Supprimer les anciennes policies avant si besoin :
--   DROP POLICY IF EXISTS "nom_policy" ON table;
-- ============================================================

-- ─── WORKOUTS ────────────────────────────────────────────────

CREATE POLICY "workouts_select"
  ON workouts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "workouts_insert"
  ON workouts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "workouts_update"
  ON workouts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "workouts_delete"
  ON workouts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── WORKOUT_EXERCISES ───────────────────────────────────────

CREATE POLICY "workout_exercises_select"
  ON workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "workout_exercises_insert"
  ON workout_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_exercises_delete"
  ON workout_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

-- ─── WORKOUT_SETS ────────────────────────────────────────────

CREATE POLICY "workout_sets_select"
  ON workout_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

CREATE POLICY "workout_sets_insert"
  ON workout_sets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_sets_delete"
  ON workout_sets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = workout_exercise_id AND w.user_id = auth.uid()
    )
  );

-- ─── LIKES ───────────────────────────────────────────────────

CREATE POLICY "likes_select"
  ON likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "likes_insert"
  ON likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete"
  ON likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── INDEX FEED ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workouts_feed
  ON workouts(started_at DESC)
  WHERE is_public = true;
