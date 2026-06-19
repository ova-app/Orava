-- ORA-023 — borne la longueur des commentaires côté DB.
-- Le client pose déjà `maxLength={500}` sur l'input (feed.tsx) ; cette contrainte
-- ferme l'abus/DoS stockage côté serveur (insert direct via API). Pas de XSS (rendu <Text> RN).
-- À appliquer via le workflow supabase/ (voir README.md). Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_content_max_len'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_content_max_len CHECK (char_length(content) <= 500);
  END IF;
END $$;
