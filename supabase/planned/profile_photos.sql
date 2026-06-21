-- Photos de profil (vitrine) — photos ajoutées directement au profil, hors séance.
--
-- La vitrine du profil agrège désormais DEUX sources :
--   • workouts.photo_url        — photo prise pendant une séance (déjà existant)
--   • profile_photos (ce fichier) — photo ajoutée à la main depuis la vitrine
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor
--    du dashboard Supabase. Voir supabase/README.md.
-- Idempotent : ré-applicable sans effet de bord (CREATE … IF NOT EXISTS + DROP/CREATE policies).
-- Storage : réutilise le bucket public `workout-photos` (path `${uid}/profile-<id>.jpg`).
--    ⚠️ Le bucket n'avait PAS de policy d'écriture owner → l'upload échouait en RLS
--    (« new row violates row-level security policy »). Les policies storage owner-scoped
--    sont donc créées ci-dessous (§ Storage) ; elles couvrent aussi la photo de séance
--    (`${uid}/<workoutId>.jpg`) qui partage le même bucket.
-- Client : best-effort isolé (lib/profilePhotos.ts) → no-op silencieux tant que la table
--    n'existe pas (même pattern que getManualFeaturedPr).

CREATE TABLE IF NOT EXISTS public.profile_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  photo_url  text NOT NULL,
  is_public  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_user
  ON public.profile_photos (user_id, created_at DESC);

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- Privilèges table : sinon « permission denied for table profile_photos » (42501).
-- La RLS ne s'applique qu'une fois le GRANT posé — les default privileges Supabase ne
-- couvrent pas toujours les tables créées via le SQL Editor (cf. claims).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO authenticated;

-- Lecture : publique si is_public, sinon owner only (cohérent feed/vitrine + ORA-020).
DROP POLICY IF EXISTS profile_photos_select ON public.profile_photos;
CREATE POLICY profile_photos_select ON public.profile_photos
  FOR SELECT USING (is_public OR auth.uid() = user_id);

-- Écriture : owner strict (insert · update · delete).
DROP POLICY IF EXISTS profile_photos_insert ON public.profile_photos;
CREATE POLICY profile_photos_insert ON public.profile_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_update ON public.profile_photos;
CREATE POLICY profile_photos_update ON public.profile_photos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_photos_delete ON public.profile_photos;
CREATE POLICY profile_photos_delete ON public.profile_photos
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Storage : bucket `workout-photos` (owner-scoped write) ────────────────────
-- Écriture réservée au propriétaire du 1er dossier du chemin = son user_id
-- (`${uid}/...`). Lecture publique (bucket public). Couvre photo de séance + vitrine.
-- INSERT pour le 1er upload, UPDATE pour `upsert: true`, DELETE pour le cleanup.

DROP POLICY IF EXISTS "workout_photos_owner_insert" ON storage.objects;
CREATE POLICY "workout_photos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workout-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "workout_photos_owner_update" ON storage.objects;
CREATE POLICY "workout_photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'workout-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'workout-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "workout_photos_owner_delete" ON storage.objects;
CREATE POLICY "workout_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'workout-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture publique (le bucket est public ; policy explicite pour ne pas dépendre du flag).
DROP POLICY IF EXISTS "workout_photos_public_read" ON storage.objects;
CREATE POLICY "workout_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'workout-photos');
