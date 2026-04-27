-- ============================================================
-- ORAVA — Session 09 — RLS fix + table comments
-- À appliquer dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── GRANTS ──────────────────────────────────────────────────
-- "permission denied for table" = problème de GRANT, pas de RLS.
-- Le rôle authenticated doit avoir les droits de base avant que
-- les policies RLS puissent s'appliquer.

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON workouts           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_exercises  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workout_sets       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON likes              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users              TO authenticated;
GRANT SELECT                          ON exercises         TO authenticated;
GRANT SELECT                          ON gyms              TO authenticated;

-- ─── ENABLE RLS (idempotent) ─────────────────────────────────

ALTER TABLE workouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes                 ENABLE ROW LEVEL SECURITY;

-- ─── WORKOUTS — drop + recreate ──────────────────────────────

DROP POLICY IF EXISTS "workouts_select" ON workouts;
DROP POLICY IF EXISTS "workouts_insert" ON workouts;
DROP POLICY IF EXISTS "workouts_update" ON workouts;
DROP POLICY IF EXISTS "workouts_delete" ON workouts;

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

-- ─── WORKOUT_EXERCISES — drop + recreate ─────────────────────

DROP POLICY IF EXISTS "workout_exercises_select" ON workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_insert" ON workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_delete" ON workout_exercises;

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

-- ─── WORKOUT_SETS — drop + recreate ──────────────────────────

DROP POLICY IF EXISTS "workout_sets_select" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_insert" ON workout_sets;
DROP POLICY IF EXISTS "workout_sets_delete" ON workout_sets;

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

-- ─── LIKES — drop + recreate ─────────────────────────────────

DROP POLICY IF EXISTS "likes_select" ON likes;
DROP POLICY IF EXISTS "likes_insert" ON likes;
DROP POLICY IF EXISTS "likes_delete" ON likes;

CREATE POLICY "likes_select"
  ON likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "likes_insert"
  ON likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete"
  ON likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── COMMENTS — create table + RLS ───────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  uuid        NOT NULL REFERENCES workouts(id)  ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON comments TO authenticated;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comments_workout ON comments(workout_id, created_at);

DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;

-- Visible si la séance est publique ou appartient à l'utilisateur
CREATE POLICY "comments_select"
  ON comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

-- Poster un commentaire : la séance doit être visible
CREATE POLICY "comments_insert"
  ON comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_id
        AND (w.user_id = auth.uid() OR w.is_public = true)
    )
  );

-- Supprimer uniquement ses propres commentaires
CREATE POLICY "comments_delete"
  ON comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
