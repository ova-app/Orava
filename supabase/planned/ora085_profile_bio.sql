-- [ORA-085] Bio courte du profil — petite présentation libre affichée dans la tête
-- de profil (bande sous l'avatar). Limitée à 70 caractères côté client pour rester
-- propre visuellement ; CHECK serveur en défense en profondeur.
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor Supabase.
-- Idempotent (ADD COLUMN IF NOT EXISTS). RLS users (update owner, ORA-020) couvre déjà la colonne.
-- Client : best-effort isolé (lib/profileBio.ts) → no-op tant que la colonne n'existe pas
--   (même pattern que getProfileNameFields / getFeaturedPhoto).

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text
  CHECK (bio IS NULL OR char_length(bio) <= 70);
