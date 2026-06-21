-- ORA-083 — Claims sociaux : likes + commentaires sur les claims résolus.
--
-- Un claim VALIDÉ (succeeded) ou ANNULÉ/raté (failed) refait surface dans le feed
-- comme une publication. On lui ajoute les mêmes interactions qu'une activité
-- normale : likes + commentaires (les pronostics believe/doubt restent réservés
-- aux claims ACTIFS — cf. claim_votes). On ne réutilise PAS likes/comments
-- (clés sur workout_id) → tables dédiées, même pattern que claim_votes.
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor.
-- Idempotent : ré-applicable (IF NOT EXISTS + DROP POLICY IF EXISTS).
-- RLS : lecture publique gouvernée par le claim parent (is_public) ; écriture
--   strictement réservée au propriétaire de la ligne (cohérent ORA-020).

-- ─── 1. Table claim_likes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_likes (
  claim_id   uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, user_id)   -- 1 like par user et par claim
);

CREATE INDEX IF NOT EXISTS idx_claim_likes_claim ON public.claim_likes (claim_id);

ALTER TABLE public.claim_likes ENABLE ROW LEVEL SECURITY;

-- Lecture : possible si le claim parent est visible (public OU sien).
DROP POLICY IF EXISTS claim_likes_select ON public.claim_likes;
CREATE POLICY claim_likes_select ON public.claim_likes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );

-- Insert : on like QUE pour soi, et seulement un claim visible.
DROP POLICY IF EXISTS claim_likes_insert ON public.claim_likes;
CREATE POLICY claim_likes_insert ON public.claim_likes
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS claim_likes_delete ON public.claim_likes;
CREATE POLICY claim_likes_delete ON public.claim_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.claim_likes TO authenticated;

-- ─── 2. Table claim_comments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id   uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content    text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_comments_claim
  ON public.claim_comments (claim_id, created_at);

ALTER TABLE public.claim_comments ENABLE ROW LEVEL SECURITY;

-- Lecture : possible si le claim parent est visible (public OU sien).
DROP POLICY IF EXISTS claim_comments_select ON public.claim_comments;
CREATE POLICY claim_comments_select ON public.claim_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );

-- Insert : on commente QUE pour soi, sur un claim visible.
DROP POLICY IF EXISTS claim_comments_insert ON public.claim_comments;
CREATE POLICY claim_comments_insert ON public.claim_comments
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );

-- Delete : son commentaire uniquement.
DROP POLICY IF EXISTS claim_comments_delete ON public.claim_comments;
CREATE POLICY claim_comments_delete ON public.claim_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.claim_comments TO authenticated;
