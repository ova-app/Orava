-- Décomposition du nom + préférence d'affichage du profil.
--
--   1. users.first_name / last_name  — le « nom complet » est désormais saisi en deux
--      champs (prénom + nom). full_name reste maintenu (concaténation) pour les lectures
--      existantes (feed, profil) → aucune migration de site de lecture nécessaire.
--   2. users.name_display            — ce qui s'affiche sur le profil : 'full_name'
--      (défaut) ou 'username'. Choisi par l'utilisateur dans Modifier le profil.
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor
--    du dashboard Supabase. Voir supabase/README.md.
-- Idempotent : ré-applicable sans effet de bord (ADD COLUMN IF NOT EXISTS + backfill gardé).
-- RLS : aucune nouvelle policy — l'écriture propriétaire (ORA-020) couvre déjà ces colonnes.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name   text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name    text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_display text NOT NULL DEFAULT 'full_name'
  CHECK (name_display IN ('full_name', 'username'));

-- Backfill : décompose le full_name existant (1er mot = prénom, le reste = nom).
-- Ne touche que les lignes pas encore décomposées (idempotent).
UPDATE public.users
SET first_name = trim(split_part(full_name, ' ', 1)),
    last_name  = NULLIF(trim(regexp_replace(full_name, '^\S+\s*', '')), '')
WHERE full_name IS NOT NULL
  AND coalesce(first_name, '') = ''
  AND coalesce(last_name, '')  = '';
