// ─── lib/claims.ts — Claims (called-shot social) + pronostics ─────────────────
// Le Claim = annonce vérifiable d'un objectif futur (« 100 kg au DC la prochaine
// séance » / « 4 séances cette semaine »). Orava le résout avec la vraie donnée
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
export type ClaimScope = 'next_session' | 'week'
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
  isPublic?: boolean
}

const WEEK_MS = 7 * 86400000
// Fenêtre d'atterrissage privé d'un claim raté (ORA-081) : visible 7 j puis s'efface.
const RECENT_FAIL_MS = 7 * 86400000

const CLAIM_COLS =
  'id, user_id, type, exercise_id, exercise_name, target_value, unit, scope, deadline, status, progress_current, resolved_value, resolved_at, is_public, created_at'

// ─── Logique pure (testée par import réel — ORA-080) ──────────────────────────────
// Extraite des fonctions réseau ci-dessous : décisions sans I/O, donc couvrables
// sans mock Supabase (le prod appelle ces mêmes fonctions — pas de recopie, cf. ORA-045).

// Échéance d'un nouveau claim : 'week' → now+7j, 'next_session' → aucune (résolu au save).
export function claimDeadline(scope: ClaimScope, nowMs: number): string | null {
  return scope === 'week' ? new Date(nowMs + WEEK_MS).toISOString() : null
}

// Résolution d'un claim 'weight'. `reached` = poids max travaillé sur l'exo visé ;
// null/undefined = exo PAS travaillé cette séance → on ne tranche pas (reste actif).
export function decideWeightResolution(
  reached: number | null | undefined,
  target: number
): 'succeeded' | 'failed' | null {
  if (reached == null) return null
  return reached >= target ? 'succeeded' : 'failed'
}

// Résolution d'un claim 'sessions' : chaque séance incrémente ; cible atteinte → succès.
export function decideSessionProgress(
  progressCurrent: number,
  target: number
): { next: number; status: 'succeeded' | null } {
  const next = progressCurrent + 1
  return { next, status: next >= target ? 'succeeded' : null }
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

  const deadline = claimDeadline(input.scope, Date.now())

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
      const decision = decideWeightResolution(reached, claim.target_value)
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
