-- Session 11 — migrations
-- Adds rest tracking and 3-tier PR level to workout data

ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS rest_seconds integer NULL;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS pr_level text NULL; -- 'gold' | 'silver' | 'bronze'

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_rest_seconds integer NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS photo_url text NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS location_city text NULL;
