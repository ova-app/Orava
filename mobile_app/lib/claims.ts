// ─── lib/claims.ts — Claims (called-shot social) + pronostics ─────────────────
// Le Claim = annonce vérifiable d'un objectif futur (« 100 kg au DC la prochaine
// séance » / « 4 séances cette semaine »). Ova le résout avec la vraie donnée
// (résolution côté client au save, summary.tsx) → succès/échec affiché, jamais déclaratif.
//
// Les autres pronostiquent (believe/doubt) — JAMAIS like/dislike : la foule parie
// sur le RÉSULTAT, pas sur la personne (cf. rules produit, anti-harcèlement).
//
// Règles : 1 seul claim ACTIF par user (rareté). Échec doux (succès public,
// échec discret/opt-in côté UI). Track record = succeeded / (succeeded+failed).

import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export type ClaimType = 'weight' | 'sessions'
// next_session = résolu au prochain save (pas d'échéance). week/month/custom = échéance datée.
export type ClaimScope = 'next_session' | 'week' | 'month' | 'custom'
export type ClaimStatus = 'active' | 'succeeded' | 'failed' | 'expired'
export type ClaimVote = 'believe' | 'doubt'

export interface Claim {
  id: string
  user_id: string
  type: ClaimType
  exercise_id: string | null
  exercise_name: string | null
  target_value: number
  unit: string
  scope: ClaimScope
  deadline: string | null
  status: ClaimStatus
  progress_current: number
  resolved_value: number | null
  resolved_at: string | null
  is_public: boolean
  created_at: string
}

export interface ClaimVoteCounts {
  believe: number
  doubt: number
  mine: ClaimVote | null
}

export interface CreateClaimInput {
  type: ClaimType
  exerciseId?: string | null
  exerciseName?: string | null
  targetValue: number
  scope: ClaimScope
  // Échéance choisie (ms epoch) — requise quand scope === 'custom', ignorée sinon.
  customDeadlineMs?: number | null
  isPublic?: boolean
}

const WEEK_MS = 7 * 86400000
const MONTH_MS = 30 * 86400000
// Fenêtre d'atterrissage privé d'un claim raté (ORA-081) : visible 7 j puis s'efface.
const RECENT_FAIL_MS = 7 * 86400000

const CLAIM_COLS =
  'id, user_id, type, exercise_id, exercise_name, target_value, unit, scope, deadline, status, progress_current, resolved_value, resolved_at, is_public, created_at'

// ─── Logique pure (testée par import réel — ORA-080) ──────────────────────────────
// Extraite des fonctions réseau ci-dessous : décisions sans I/O, donc couvrables
// sans mock Supabase (le prod appelle ces mêmes fonctions — pas de recopie, cf. ORA-045).

// Échéance d'un nouveau claim selon le scope :
//   next_session → aucune (résolu au prochain save) · week → now+7j · month → now+30j
//   custom → date fournie (customMs). Garde-fou : custom sans date → pas d'échéance.
export function claimDeadline(
  scope: ClaimScope,
  nowMs: number,
  customMs?: number | null
): string | null {
  switch (scope) {
    case 'week':
      return new Date(nowMs + WEEK_MS).toISOString()
    case 'month':
      return new Date(nowMs + MONTH_MS).toISOString()
    case 'custom':
      return customMs != null ? new Date(customMs).toISOString() : null
    default:
      return null // next_session
  }
}

// Résolution d'un claim 'weight'. `reached` = poids max travaillé sur l'exo visé ;
// null/undefined = exo PAS travaillé cette séance → on ne tranche pas (reste actif).
// Échec immédiat sous la cible UNIQUEMENT pour 'next_session' (un seul essai promis).
// Pour une échéance datée (week/month/custom) : on laisse réessayer jusqu'à la
// deadline (échec géré par expireOverdueClaims / cron quand l'échéance passe).
export function decideWeightResolution(
  reached: number | null | undefined,
  target: number,
  scope: ClaimScope = 'next_session'
): 'succeeded' | 'failed' | null {
  if (reached == null) return null
  if (reached >= target) return 'succeeded'
  return scope === 'next_session' ? 'failed' : null
}

// Résolution d'un claim 'sessions' : chaque séance incrémente ; cible atteinte → succès.
export function decideSessionProgress(
  progressCurrent: number,
  target: number
): { next: number; status: 'succeeded' | null } {
  const next = progressCurrent + 1
  return { next, status: next >= target ? 'succeeded' : null }
}

// Validation MANUELLE (« Valider ») : l'utilisateur force la résolution maintenant en
// scannant ses séances. On tranche TOUJOURS (réussi/raté), quel que soit le scope —
// contrairement à decideWeightResolution qui laisse les claims datés réessayer.
export function decideManualValidation(reached: number, target: number): 'succeeded' | 'failed' {
  return reached >= target ? 'succeeded' : 'failed'
}

// Toggle d'un pronostic : re-taper le même → retrait ; sinon poser/écraser.
export function nextVoteAction(
  current: ClaimVote | null,
  tap: ClaimVote
): { kind: 'retract' } | { kind: 'set'; vote: ClaimVote } {
  return current === tap ? { kind: 'retract' } : { kind: 'set', vote: tap }
}

// Échéance dépassée ? (deadline absente = jamais en retard, ex. next_session).
export function isOverdue(deadline: string | null, nowMs: number): boolean {
  if (!deadline) return false
  return new Date(deadline).getTime() < nowMs
}

// Track record (fiabilité) : succeeded / (succeeded+failed). 'expired'/'active' exclus.
export function computeTrackRecord(statuses: ClaimStatus[]): TrackRecord {
  let succeeded = 0
  let total = 0
  for (const st of statuses) {
    if (st === 'succeeded') {
      succeeded++
      total++
    } else if (st === 'failed') {
      total++
    }
  }
  return { succeeded, total }
}

// Écart à la cible d'un claim raté (near-miss, ORA-081). Positif = manqué de X
// (kg ou séances). null si non résolu (pas de valeur atteinte). Jamais négatif.
export function nearMissGap(target: number, resolvedValue: number | null): number | null {
  if (resolvedValue == null) return null
  return Math.max(0, target - resolvedValue)
}

// ─── Création ─────────────────────────────────────────────────────────────────
// Remplace le claim actif existant (1 actif max) → l'ancien passe 'expired'
// (exclu du track record, qui ne compte que succeeded/failed).
export async function createClaim(input: CreateClaimInput): Promise<Claim | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const nowIso = new Date().toISOString()
  // 1 actif max : expire le précédent avant d'insérer (évite le conflit d'index partiel).
  await supabase
    .from('claims')
    .update({ status: 'expired', resolved_at: nowIso })
    .eq('user_id', user.id)
    .eq('status', 'active')

  const deadline = claimDeadline(input.scope, Date.now(), input.customDeadlineMs)

  const { data, error } = await supabase
    .from('claims')
    .insert({
      user_id: user.id,
      type: input.type,
      exercise_id: input.exerciseId ?? null,
      exercise_name: input.exerciseName ?? null,
      target_value: input.targetValue,
      unit: input.type === 'weight' ? 'kg' : 'séances',
      scope: input.scope,
      deadline,
      status: 'active',
      progress_current: 0,
      is_public: input.isPublic ?? true,
    })
    .select(CLAIM_COLS)
    .single()

  if (error) {
    log.error('[claims] createClaim', error)
    return null
  }
  return data as Claim
}

// ─── Claim actif courant ───────────────────────────────────────────────────────
export async function getActiveClaim(userId: string): Promise<Claim | null> {
  const { data, error } = await supabase
    .from('claims')
    .select(CLAIM_COLS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    log.error('[claims] getActiveClaim', error)
    return null
  }
  return (data as Claim | null) ?? null
}

export async function cancelClaim(claimId: string): Promise<void> {
  const { error } = await supabase.from('claims').delete().eq('id', claimId)
  if (error) log.error('[claims] cancelClaim', error)
}

// « Annuler » : l'utilisateur abandonne son claim actif → marqué raté (rouge), pas supprimé.
// resolved_value = null (abandon volontaire, pas de valeur atteinte mesurée) → le feed
// affiche un message générique plutôt qu'un near-miss chiffré. resolved_at = maintenant
// → le claim refait surface en haut du feed et dans l'historique du profil.
export async function abandonClaim(claim: Claim): Promise<Claim | null> {
  const { data, error } = await supabase
    .from('claims')
    .update({ status: 'failed', resolved_value: null, resolved_at: new Date().toISOString() })
    .eq('id', claim.id)
    .eq('status', 'active') // garde-fou : ne touche pas un claim déjà résolu
    .select(CLAIM_COLS)
    .maybeSingle()
  if (error) {
    log.error('[claims] abandonClaim', error)
    return null
  }
  return (data as Claim | null) ?? null
}

// ─── Validation manuelle (« Valider ») ────────────────────────────────────────
// L'utilisateur déclenche lui-même la résolution : on SCANNE ses vraies séances
// depuis la création du claim pour trancher réussi/raté (jamais déclaratif).
//   weight   → meilleur working set sur l'exo visé depuis created_at ≥ cible.
//   sessions → nombre de séances depuis created_at ≥ cible.
// resolved_at = maintenant → le claim refait surface en haut du feed (tri par
// resolved_at) comme une nouvelle publication.
export async function validateClaimNow(claim: Claim): Promise<Claim | null> {
  const nowIso = new Date().toISOString()
  let reached = 0
  if (claim.type === 'weight') {
    if (!claim.exercise_id) return null
    reached = await scanMaxWeight(claim.user_id, claim.exercise_id, claim.created_at)
  } else {
    reached = await scanSessionCount(claim.user_id, claim.created_at)
  }
  const status = decideManualValidation(reached, claim.target_value)
  return applyResolution(claim, status, reached, nowIso)
}

// Claims résolus (réussis + ratés) — alimentent l'historique du profil.
export async function getResolvedClaims(userId: string): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select(CLAIM_COLS)
    .eq('user_id', userId)
    .in('status', ['succeeded', 'failed'])
    .order('resolved_at', { ascending: false })
    .limit(50)
  if (error || !data) {
    if (error) log.error('[claims] getResolvedClaims', error)
    return []
  }
  return data as Claim[]
}

// Dernier claim RATÉ récemment (≤ 7 j) — atterrissage privé (ORA-081). 'failed' seul :
// 'expired' = claim remplacé volontairement (pas un échec, exclu du track record aussi).
// Affiché à l'auteur quand il n'a pas de claim actif ; s'efface passé la fenêtre.
export async function getRecentFailedClaim(userId: string): Promise<Claim | null> {
  const since = new Date(Date.now() - RECENT_FAIL_MS).toISOString()
  const { data, error } = await supabase
    .from('claims')
    .select(CLAIM_COLS)
    .eq('user_id', userId)
    .eq('status', 'failed')
    .gte('resolved_at', since)
    .order('resolved_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    log.error('[claims] getRecentFailedClaim', error)
    return null
  }
  return (data as Claim | null) ?? null
}

// ─── Pronostics ─────────────────────────────────────────────────────────────────
export async function getClaimVotes(
  claimId: string,
  myUserId: string | null
): Promise<ClaimVoteCounts> {
  const { data, error } = await supabase
    .from('claim_votes')
    .select('user_id, vote')
    .eq('claim_id', claimId)
  if (error || !data) {
    if (error) log.error('[claims] getClaimVotes', error)
    return { believe: 0, doubt: 0, mine: null }
  }
  const rows = data as Array<{ user_id: string; vote: ClaimVote }>
  return {
    believe: rows.filter((r) => r.vote === 'believe').length,
    doubt: rows.filter((r) => r.vote === 'doubt').length,
    mine: rows.find((r) => r.user_id === myUserId)?.vote ?? null,
  }
}

// Tap sur un pronostic : pose, change, ou retire (toggle si on re-tape le même).
export async function voteClaim(claimId: string, vote: ClaimVote): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('claim_votes')
    .select('vote')
    .eq('claim_id', claimId)
    .eq('user_id', user.id)
    .maybeSingle()

  const current = (existing as { vote: ClaimVote } | null)?.vote ?? null

  const action = nextVoteAction(current, vote)
  if (action.kind === 'retract') {
    // Re-tap le même pronostic → on le retire.
    const { error } = await supabase
      .from('claim_votes')
      .delete()
      .eq('claim_id', claimId)
      .eq('user_id', user.id)
    if (error) log.error('[claims] voteClaim retract', error)
    return
  }

  const { error } = await supabase
    .from('claim_votes')
    .upsert(
      { claim_id: claimId, user_id: user.id, vote: action.vote },
      { onConflict: 'claim_id,user_id' }
    )
  if (error) log.error('[claims] voteClaim', error)
}

// ─── Social sur claims résolus (likes + commentaires) — ORA-083 ───────────────────
// Un claim validé/annulé refait surface dans le feed comme une publication → mêmes
// interactions qu'une activité normale. Tables dédiées claim_likes/claim_comments
// (les pronostics believe/doubt, eux, restent réservés aux claims actifs).

export interface ClaimSocialUser {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export interface ClaimComment {
  id: string
  content: string
  created_at: string
  user_id: string
  users: ClaimSocialUser | null
}

export interface ClaimSocialAgg {
  likes: number
  comments: number
  liked: boolean
  firstComment: { content: string; username: string | null; user_id: string } | null
}

// Embed to-one PostgREST : objet OU tableau selon la version → normaliser.
function embedOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

// Agrégat social par claim (feed) : compteurs likes/comments + like du user courant
// + premier commentaire (aperçu inline). Une requête groupée par dimension.
export async function getClaimSocialAgg(
  claimIds: string[],
  myUserId: string | null
): Promise<Map<string, ClaimSocialAgg>> {
  const agg = new Map<string, ClaimSocialAgg>()
  if (claimIds.length === 0) return agg

  const [likesRes, commentsRes, userLikesRes, firstCommentsRes] = await Promise.all([
    supabase.from('claim_likes').select('claim_id').in('claim_id', claimIds),
    supabase.from('claim_comments').select('claim_id').in('claim_id', claimIds),
    myUserId
      ? supabase
          .from('claim_likes')
          .select('claim_id')
          .eq('user_id', myUserId)
          .in('claim_id', claimIds)
      : Promise.resolve({ data: [] as Array<{ claim_id: string }> }),
    supabase
      .from('claim_comments')
      .select('claim_id, content, user_id, users:user_id(username, full_name)')
      .in('claim_id', claimIds)
      .order('created_at', { ascending: true }),
  ])

  const get = (id: string): ClaimSocialAgg => {
    let a = agg.get(id)
    if (!a) {
      a = { likes: 0, comments: 0, liked: false, firstComment: null }
      agg.set(id, a)
    }
    return a
  }

  for (const r of (likesRes.data ?? []) as Array<{ claim_id: string }>) get(r.claim_id).likes += 1
  for (const r of (commentsRes.data ?? []) as Array<{ claim_id: string }>)
    get(r.claim_id).comments += 1
  for (const r of (userLikesRes.data ?? []) as Array<{ claim_id: string }>)
    get(r.claim_id).liked = true

  type RawFirst = {
    claim_id: string
    content: string
    user_id: string
    users:
      | Array<{ username: string | null; full_name: string | null }>
      | { username: string | null; full_name: string | null }
      | null
  }
  for (const r of (firstCommentsRes.data ?? []) as unknown as RawFirst[]) {
    const a = get(r.claim_id)
    if (a.firstComment === null) {
      const u = embedOne(r.users)
      a.firstComment = {
        content: r.content,
        username: u?.username ?? u?.full_name ?? null,
        user_id: r.user_id,
      }
    }
  }

  return agg
}

// Toggle like sur un claim. `hasLiked` = état actuel (avant le tap). Retourne true
// si l'écriture a réussi (le caller revert son optimistic update sinon).
export async function toggleClaimLike(claimId: string, hasLiked: boolean): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = hasLiked
    ? await supabase.from('claim_likes').delete().eq('claim_id', claimId).eq('user_id', user.id)
    : await supabase.from('claim_likes').insert({ claim_id: claimId, user_id: user.id })

  if (error) {
    log.error('[claims] toggleClaimLike', error)
    return false
  }
  return true
}

// Liste des users ayant liké un claim (modal « Aimé par »).
export async function fetchClaimLikeUsers(
  claimId: string
): Promise<Array<{ user_id: string; created_at: string; users: ClaimSocialUser | null }>> {
  const { data, error } = await supabase
    .from('claim_likes')
    .select('user_id, created_at, users:user_id(id, username, full_name, avatar_url)')
    .eq('claim_id', claimId)
  if (error || !data) {
    if (error) log.error('[claims] fetchClaimLikeUsers', error)
    return []
  }
  return (
    data as unknown as Array<{
      user_id: string
      created_at: string
      users: ClaimSocialUser[] | ClaimSocialUser | null
    }>
  ).map((l) => ({ user_id: l.user_id, created_at: l.created_at, users: embedOne(l.users) }))
}

// Commentaires d'un claim, antichronologiques (comme le feed séance).
export async function fetchClaimComments(claimId: string): Promise<ClaimComment[]> {
  const { data, error } = await supabase
    .from('claim_comments')
    .select('id, content, created_at, user_id, users:user_id(id, username, full_name, avatar_url)')
    .eq('claim_id', claimId)
    .order('created_at', { ascending: false })
  if (error || !data) {
    if (error) log.error('[claims] fetchClaimComments', error)
    return []
  }
  return (
    data as unknown as Array<{
      id: string
      content: string
      created_at: string
      user_id: string
      users: ClaimSocialUser[] | ClaimSocialUser | null
    }>
  ).map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    user_id: c.user_id,
    users: embedOne(c.users),
  }))
}

export async function postClaimComment(claimId: string, content: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('claim_comments')
    .insert({ claim_id: claimId, user_id: user.id, content })
  if (error) log.error('[claims] postClaimComment', error)
}

export async function deleteClaimComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('claim_comments').delete().eq('id', commentId)
  if (error) log.error('[claims] deleteClaimComment', error)
}

// ─── Résolution au save de séance (client-side) ──────────────────────────────────
// Appelé depuis summary.tsx APRÈS le save (best-effort, non bloquant).
// Renvoie les claims fraîchement résolus (pour célébration / event feed).
export interface WorkoutResolveContext {
  // poids max travaillé par exercice durant la séance (working sets)
  maxWeightByExercise: Record<string, number>
}

export async function resolveClaimsAfterWorkout(
  userId: string,
  ctx: WorkoutResolveContext
): Promise<Claim[]> {
  const active = await fetchAllActive(userId)
  if (active.length === 0) return []

  const nowIso = new Date().toISOString()
  const resolved: Claim[] = []

  for (const claim of active) {
    if (claim.type === 'weight') {
      // « X kg sur tel exercice à la prochaine séance »
      // On ne résout QUE si l'exercice visé est réellement travaillé (sinon ce n'était
      // pas SA séance de cet exo → reste actif, plus juste et plus indulgent).
      if (!claim.exercise_id) continue
      const reached = ctx.maxWeightByExercise[claim.exercise_id]
      const decision = decideWeightResolution(reached, claim.target_value, claim.scope)
      if (decision === null || reached == null) continue
      const updated = await applyResolution(claim, decision, reached, nowIso)
      if (updated) resolved.push(updated)
    } else {
      // « N séances » — chaque séance incrémente le compteur.
      const { next, status } = decideSessionProgress(claim.progress_current, claim.target_value)
      if (status === 'succeeded') {
        const updated = await applyResolution(claim, 'succeeded', next, nowIso)
        if (updated) resolved.push(updated)
      } else {
        await supabase.from('claims').update({ progress_current: next }).eq('id', claim.id)
      }
    }
  }
  return resolved
}

// Échéances dépassées (claims 'week' non complétés) — appelé à l'ouverture profil/feed.
export async function expireOverdueClaims(userId: string): Promise<void> {
  const active = await fetchAllActive(userId)
  const nowMs = Date.now()
  const nowIso = new Date().toISOString()
  for (const claim of active) {
    if (isOverdue(claim.deadline, nowMs)) {
      // Deadline passée sans atteindre la cible → échec (resolved_value = progrès atteint).
      await applyResolution(claim, 'failed', claim.progress_current, nowIso)
    }
  }
}

// ─── Track record (preuve de fiabilité sur le profil) ─────────────────────────────
export interface TrackRecord {
  succeeded: number
  total: number // succeeded + failed (les 'expired' = remplacés, pas comptés)
}

export async function getTrackRecord(userId: string): Promise<TrackRecord> {
  const { data, error } = await supabase
    .from('claims')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['succeeded', 'failed'])
  if (error || !data) {
    if (error) log.error('[claims] getTrackRecord', error)
    return { succeeded: 0, total: 0 }
  }
  const rows = data as Array<{ status: ClaimStatus }>
  return computeTrackRecord(rows.map((r) => r.status))
}

// ─── Internes ─────────────────────────────────────────────────────────────────

// Poids max d'un working set sur l'exo visé, dans les séances du user depuis `sinceIso`.
// 0 si l'exo n'a jamais été travaillé sur la fenêtre (→ raté). 3 requêtes séquentielles :
// action manuelle ponctuelle, pas un chemin chaud (et évite les filtres PostgREST 2 niveaux).
async function scanMaxWeight(
  userId: string,
  exerciseId: string,
  sinceIso: string
): Promise<number> {
  const { data: wks } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', sinceIso)
  const workoutIds = (wks ?? []).map((w) => (w as { id: string }).id)
  if (workoutIds.length === 0) return 0

  const { data: wes } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('exercise_id', exerciseId)
    .in('workout_id', workoutIds)
  const weIds = (wes ?? []).map((e) => (e as { id: string }).id)
  if (weIds.length === 0) return 0

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('weight_kg')
    .eq('set_type', 'working')
    .in('workout_exercise_id', weIds)
  let max = 0
  for (const r of (sets ?? []) as Array<{ weight_kg: number | null }>) {
    if (r.weight_kg != null && r.weight_kg > max) max = r.weight_kg
  }
  return max
}

// Nombre de séances du user depuis `sinceIso` (claim 'sessions').
async function scanSessionCount(userId: string, sinceIso: string): Promise<number> {
  const { count } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', sinceIso)
  return count ?? 0
}

async function fetchAllActive(userId: string): Promise<Claim[]> {
  const { data, error } = await supabase
    .from('claims')
    .select(CLAIM_COLS)
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error || !data) {
    if (error) log.error('[claims] fetchAllActive', error)
    return []
  }
  return data as Claim[]
}

async function applyResolution(
  claim: Claim,
  status: Extract<ClaimStatus, 'succeeded' | 'failed'>,
  resolvedValue: number,
  nowIso: string
): Promise<Claim | null> {
  const { data, error } = await supabase
    .from('claims')
    .update({ status, resolved_value: resolvedValue, resolved_at: nowIso })
    .eq('id', claim.id)
    .eq('status', 'active') // garde-fou : ne résout pas deux fois
    .select(CLAIM_COLS)
    .maybeSingle()
  if (error) {
    log.error('[claims] applyResolution', error)
    return null
  }
  return (data as Claim | null) ?? null
}
