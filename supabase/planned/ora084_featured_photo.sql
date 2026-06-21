-- [ORA-084] Photo épinglée de la vitrine — pointeur vers UNE photo mise en avant en tête de vitrine.
--
-- La vitrine agrège deux sources (workouts.photo_url + profile_photos). L'utilisateur peut
-- épingler n'importe laquelle ; un seul pointeur user-level couvre donc les deux sources.
-- NULL → pas de pin → la photo la plus récente fait foi (fallback côté client).
--
-- Snapshot dénormalisé (même esprit que users.featured_pr) :
--   { id, photo_url, source('workout'|'profile'), workout_id }
-- Le client matche par `id` (PhotoItem.id = workout id OU profile_photo id) ; pin pendouillant
-- (photo supprimée) → fallback silencieux à la plus récente.
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor Supabase.
-- Idempotent (ADD COLUMN IF NOT EXISTS). RLS users (update owner) déjà en place via featured_pr.
-- Client : best-effort isolé (lib/featuredPhoto.ts) → no-op tant que la colonne n'existe pas
--   (même pattern que getManualFeaturedPr / getProfileNameFields).

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS featured_photo jsonb;
