-- Claims (called-shot social) + PR vedette épinglé sur le profil.
--
-- Feature « vitrine sociale » du profil :
--   1. users.featured_pr (jsonb)  — PR mis en avant par l'utilisateur (snapshot,
--      NULL = auto-pick côté client : meilleur PR récent).
--   2. claims                     — annonces vérifiables (« 100 kg au DC la prochaine
--      séance » / « 4 séances cette semaine »). Résolues côté client au save (summary.tsx).
--   3. claim_votes                — pronostics believe/doubt des autres users (JAMAIS
--      like/dislike : la foule pronostique le résultat, pas la personne).
--
-- ⚠️ À APPLIQUER À LA MAIN (migration `planned/`, non jouée par le CLI) — SQL Editor
--    du dashboard Supabase. Voir supabase/README.md.
-- Idempotent : ré-applicable sans effet de bord (IF NOT EXISTS + DROP POLICY IF EXISTS).
-- RLS : lecture publique gouvernée par is_public (cohérent avec le feed) ; écriture
--    strictement réservée au propriétaire (cohérent avec ORA-020).

-- ─── 1. PR vedette épinglé ────────────────────────────────────────────────────
-- Snapshot dénormalisé : { set_id, exercise_name, weight_kg, reps, type, achieved_at, delta_kg }
-- La card s'affiche sans jointure et survit aux changements (cf. poids_corps_kg / workout_metrics).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS featured_pr jsonb;

-- ─── 2. Table claims ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claims (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('weight', 'sessions')),
  exercise_id      uuid REFERENCES public.exercises(id),  -- NULL pour type 'sessions'
  exercise_name    text,                                  -- snapshot affichage (pas de jointure)
  target_value     numeric NOT NULL CHECK (target_value > 0),
  unit             text    NOT NULL,                      -- 'kg' | 'séances'
  scope            text    NOT NULL CHECK (scope IN ('next_session', 'week')),
  deadline         timestamptz,                           -- NULL pour next_session (résolu au prochain save)
  status           text    NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'succeeded', 'failed', 'expired')),
  progress_current numeric NOT NULL DEFAULT 0,            -- compteur courant (type sessions)
  resolved_value   numeric,                               -- valeur réellement atteinte
  resolved_at      timestamptz,
  is_public        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Un seul claim ACTIF par user (rareté = poids social). Index partiel = contrainte d'unicité.
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_one_active
  ON public.claims (user_id) WHERE status = 'active';

-- Lookup feed (claims publics récents) + profil (claims d'un user).
CREATE INDEX IF NOT EXISTS idx_claims_public_recent
  ON public.claims (created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_claims_user
  ON public.claims (user_id, created_at DESC);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Lecture : public si is_public, sinon propriétaire uniquement.
DROP POLICY IF EXISTS claims_select ON public.claims;
CREATE POLICY claims_select ON public.claims
  FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = user_id);

-- Écriture : propriétaire strict (cohérent ORA-020).
DROP POLICY IF EXISTS claims_insert ON public.claims;
CREATE POLICY claims_insert ON public.claims
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS claims_update ON public.claims;
CREATE POLICY claims_update ON public.claims
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS claims_delete ON public.claims;
CREATE POLICY claims_delete ON public.claims
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Privilèges table (sinon « permission denied for table claims » / 42501 — la RLS
-- ne s'applique qu'une fois le GRANT posé ; les default privileges Supabase ne
-- couvrent pas toujours les tables créées via le SQL Editor).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;

-- ─── 3. Table claim_votes (pronostics) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_votes (
  claim_id   uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote       text NOT NULL CHECK (vote IN ('believe', 'doubt')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (claim_id, user_id)   -- 1 vote par user et par claim
);

CREATE INDEX IF NOT EXISTS idx_claim_votes_claim ON public.claim_votes (claim_id);

ALTER TABLE public.claim_votes ENABLE ROW LEVEL SECURITY;

-- Lecture : tout user authentifié (les comptes believe/doubt ne sont pas sensibles).
DROP POLICY IF EXISTS claim_votes_select ON public.claim_votes;
CREATE POLICY claim_votes_select ON public.claim_votes
  FOR SELECT TO authenticated USING (true);

-- Insert : on ne vote QUE pour soi, JAMAIS son propre claim, et seulement un claim ACTIF.
DROP POLICY IF EXISTS claim_votes_insert ON public.claim_votes;
CREATE POLICY claim_votes_insert ON public.claim_votes
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = claim_id AND c.status = 'active' AND c.user_id <> auth.uid()
    )
  );

-- Update (changer son pronostic) / Delete (le retirer) : son vote uniquement.
DROP POLICY IF EXISTS claim_votes_update ON public.claim_votes;
CREATE POLICY claim_votes_update ON public.claim_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS claim_votes_delete ON public.claim_votes;
CREATE POLICY claim_votes_delete ON public.claim_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Privilèges table (idem claims).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_votes TO authenticated;
