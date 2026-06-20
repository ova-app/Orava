// ─── useFeedData — couche data de l'écran Feed (ORA-034) ──────────────────────
// Extrait de app/(tabs)/feed.tsx : profil courant + fetch timeline publique
// (workouts + likes + comments + PRs agrégés + signatures Myo) + KPIs du mois +
// like optimiste avec revert (ORA-037). L'écran ne garde que rendu + animations.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import { sessionValuesFromSignature } from '@/lib/myo'
import {
  getClaimVotes,
  voteClaim as voteClaimApi,
  type ClaimType,
  type ClaimScope,
  type ClaimStatus,
  type ClaimVote,
} from '@/lib/claims'

// ─── Types partagés avec l'écran ──────────────────────────────────────────────

export type PRLevel = 'gold' | 'silver' | 'bronze'

export interface WorkoutPRSummary {
  // meilleur niveau par type (null = aucun PR de ce type)
  charge: PRLevel | null
  serie: PRLevel | null
  exercice: PRLevel | null
  seance: PRLevel | null
  // total de PRs individuels (sets + exercices)
  total: number
}

export interface FeedWorkout {
  id: string
  title: string
  total_volume_kg: number | null
  started_at: string
  ended_at: string | null
  pr_seance: 'gold' | 'silver' | 'bronze' | null
  location_city: string | null
  gym_id: string | null
  user: {
    id: string
    username: string | null
    full_name: string | null
  }
  likes_count: number
  comments_count: number
  user_has_liked: boolean
  first_comment: {
    content: string
    username: string | null
    user_id: string
  } | null
  prs: WorkoutPRSummary
  sessionValues?: number[][]
  photo_url: string | null
}

// Claim affiché dans le feed (called-shot social). Échec exclu (succès public, échec discret).
export interface ClaimFeedItem {
  id: string
  user: { id: string; username: string | null; full_name: string | null }
  type: ClaimType
  exercise_name: string | null
  target_value: number
  unit: string
  scope: ClaimScope
  deadline: string | null
  status: ClaimStatus
  progress_current: number
  resolved_value: number | null
  created_at: string
  resolved_at: string | null
  believe: number
  doubt: number
  myVote: ClaimVote | null
}

// Timeline unifiée : séances + claims, triés chronologiquement.
export type FeedEntry =
  | { kind: 'workout'; ts: number; id: string; workout: FeedWorkout }
  | { kind: 'claim'; ts: number; id: string; claim: ClaimFeedItem }

export interface FeedKPIs {
  workoutsThisMonth: number
  trendPercent: number
  volumeThisMonth: number
  prsThisMonth: number
  avgDurationMin: number
}

const EMPTY_KPIS: FeedKPIs = {
  workoutsThisMonth: 0,
  trendPercent: 0,
  volumeThisMonth: 0,
  prsThisMonth: 0,
  avgDurationMin: 0,
}

export interface FeedData {
  workouts: FeedWorkout[]
  feedEntries: FeedEntry[]
  currentUserId: string | null
  currentUserFirstName: string
  kpis: FeedKPIs
  fetchFeed: () => Promise<void>
  handleLike: (workoutId: string, hasLiked: boolean) => Promise<void>
  voteOnClaim: (claimId: string, vote: ClaimVote) => Promise<void>
}

// ─── KPIs du mois (volume / tendance / PRs / durée moyenne) ────────────────────

function computeKPIs(allWorkouts: FeedWorkout[]): FeedKPIs {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const inCurrentMonth = (w: FeedWorkout): boolean => {
    const d = new Date(w.started_at)
    return d >= monthStart && d <= monthEnd
  }

  const thisMonthWorkouts = allWorkouts.filter(inCurrentMonth)
  const workoutsThisMonth = thisMonthWorkouts.length

  // Tendance : δ volume mois courant vs mois précédent
  const prevMonthStart = new Date(monthStart)
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
  const prevMonthEnd = new Date(monthStart)
  prevMonthEnd.setDate(0)

  const currVolume = thisMonthWorkouts.reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0)
  const prevVolume = allWorkouts
    .filter((w) => {
      const d = new Date(w.started_at)
      return d >= prevMonthStart && d <= prevMonthEnd
    })
    .reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0)

  const trendPercent = prevVolume > 0 ? ((currVolume - prevVolume) / prevVolume) * 100 : 0
  const prsThisMonth = thisMonthWorkouts.reduce((sum, w) => sum + w.prs.total, 0)

  const withDuration = thisMonthWorkouts.filter((w) => !!w.ended_at)
  const avgDurationMin =
    withDuration.length > 0
      ? Math.round(
          withDuration.reduce(
            (sum, w) =>
              sum + (new Date(w.ended_at!).getTime() - new Date(w.started_at).getTime()) / 60000,
            0
          ) / withDuration.length
        )
      : 0

  return {
    workoutsThisMonth,
    trendPercent,
    volumeThisMonth: Math.round(currVolume),
    prsThisMonth,
    avgDurationMin,
  }
}

const PR_RANK: Record<PRLevel, number> = { gold: 3, silver: 2, bronze: 1 }

export function useFeedData(): FeedData {
  const [workouts, setWorkouts] = useState<FeedWorkout[]>([])
  const [claimItems, setClaimItems] = useState<ClaimFeedItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserFirstName, setCurrentUserFirstName] = useState<string>('')
  const [kpis, setKpis] = useState<FeedKPIs>(EMPTY_KPIS)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  const fetchFeed = useCallback(async (): Promise<void> => {
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id
    if (!uid) return

    // Profil courant (prénom pour le greeting)
    const { data: userData } = await supabase
      .from('users')
      .select('id, full_name, username')
      .eq('id', uid)
      .single()

    if (userData) {
      const firstName = (userData.full_name ?? userData.username ?? 'Athlète').split(' ')[0]
      setCurrentUserFirstName(firstName)
    }

    // Workouts publics
    const { data, error } = await supabase
      .from('workouts')
      .select(
        `
        id,
        title,
        total_volume_kg,
        started_at,
        ended_at,
        pr_seance,
        location_city,
        gym_id,
        photo_url,
        user:user_id (
          id,
          username,
          full_name
        )
      `
      )
      .eq('is_public', true)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error || !data) return

    type RawWorkout = {
      id: string
      title: string
      total_volume_kg: number | null
      started_at: string
      ended_at: string | null
      pr_seance: 'gold' | 'silver' | 'bronze' | null
      location_city: string | null
      gym_id: string | null
      photo_url: string | null
      user: Array<{ id: string; username: string | null; full_name: string | null }>
    }

    const workoutIds = (data as unknown as RawWorkout[]).map((w) => w.id)

    const [
      likesRes,
      commentsRes,
      userLikesRes,
      firstCommentsRes,
      prExercicesRes,
      prSetsRes,
      myoRes,
    ] = await Promise.all([
      supabase.from('likes').select('workout_id').in('workout_id', workoutIds),
      supabase.from('comments').select('workout_id').in('workout_id', workoutIds),
      supabase.from('likes').select('workout_id').eq('user_id', uid).in('workout_id', workoutIds),
      supabase
        .from('comments')
        .select('workout_id, content, user_id, users:user_id(username, full_name)')
        .in('workout_id', workoutIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('workout_exercises')
        .select('workout_id, pr_exercice')
        .in('workout_id', workoutIds)
        .not('pr_exercice', 'is', null),
      supabase
        .from('workout_sets')
        .select('workout_exercise_id, pr_charge, pr_serie, workout_exercises!inner(workout_id)')
        .in('workout_exercises.workout_id', workoutIds)
        .or('pr_charge.not.is.null,pr_serie.not.is.null'),
      supabase
        .from('myo_signatures')
        .select(
          'workout_id, z_volume, z_intensite, z_structure, z_recovery, z_performance, z_regularite, z_extended'
        )
        .in('workout_id', workoutIds),
    ])

    // Agrégation PRs par workout
    type PrMap = Map<string, PRLevel>
    const exChargeMap: PrMap = new Map()
    const exSerieMap: PrMap = new Map()
    const exExerciceMap: PrMap = new Map()

    // Sets : pr_charge + pr_serie (groupés par workout via JOIN)
    type RawPRSet = {
      pr_charge: PRLevel | null
      pr_serie: PRLevel | null
      workout_exercises: Array<{ workout_id: string }> | { workout_id: string } | null
    }
    for (const r of (prSetsRes.data ?? []) as unknown as RawPRSet[]) {
      const we = Array.isArray(r.workout_exercises) ? r.workout_exercises[0] : r.workout_exercises
      const wid = we?.workout_id
      if (!wid) continue
      if (r.pr_charge) {
        const cur = exChargeMap.get(wid)
        if (!cur || PR_RANK[r.pr_charge] > PR_RANK[cur]) exChargeMap.set(wid, r.pr_charge)
      }
      if (r.pr_serie) {
        const cur = exSerieMap.get(wid)
        if (!cur || PR_RANK[r.pr_serie] > PR_RANK[cur]) exSerieMap.set(wid, r.pr_serie)
      }
    }

    // Exercices : pr_exercice
    type RawPREx = { workout_id: string; pr_exercice: PRLevel }
    for (const r of (prExercicesRes.data ?? []) as unknown as RawPREx[]) {
      const cur = exExerciceMap.get(r.workout_id)
      if (!cur || PR_RANK[r.pr_exercice] > PR_RANK[cur])
        exExerciceMap.set(r.workout_id, r.pr_exercice)
    }

    // Myo signatures map
    type RawMyoRow = {
      workout_id: string
      z_volume: number
      z_intensite: number
      z_structure: number
      z_recovery: number
      z_performance: number
      z_regularite: number
      z_extended: Record<string, unknown>
    }
    const myoMap = new Map<string, number[][]>()
    for (const r of (myoRes.data ?? []) as unknown as RawMyoRow[]) {
      myoMap.set(r.workout_id, sessionValuesFromSignature(r))
    }

    const likesCount = new Map<string, number>()
    const commentsCount = new Map<string, number>()
    for (const r of likesRes.data ?? []) {
      const id = (r as { workout_id: string }).workout_id
      likesCount.set(id, (likesCount.get(id) ?? 0) + 1)
    }
    for (const r of commentsRes.data ?? []) {
      const id = (r as { workout_id: string }).workout_id
      commentsCount.set(id, (commentsCount.get(id) ?? 0) + 1)
    }
    const likedSet = new Set(
      (userLikesRes.data ?? []).map((l: { workout_id: string }) => l.workout_id)
    )

    type RawFirstComment = {
      workout_id: string
      content: string
      user_id: string
      users: Array<{ username: string | null; full_name: string | null }> | null
    }
    const firstCommentMap = new Map<
      string,
      { content: string; username: string | null; user_id: string }
    >()
    for (const r of (firstCommentsRes.data ?? []) as unknown as RawFirstComment[]) {
      if (!firstCommentMap.has(r.workout_id)) {
        const u = r.users?.[0]
        firstCommentMap.set(r.workout_id, {
          content: r.content,
          username: u?.username ?? u?.full_name ?? null,
          user_id: r.user_id,
        })
      }
    }

    const mapped: FeedWorkout[] = (data as unknown as RawWorkout[]).map((w) => {
      const charge = exChargeMap.get(w.id) ?? null
      const serie = exSerieMap.get(w.id) ?? null
      const exercice = exExerciceMap.get(w.id) ?? null
      const seance = w.pr_seance ?? null
      const total = (charge ? 1 : 0) + (serie ? 1 : 0) + (exercice ? 1 : 0) + (seance ? 1 : 0)
      return {
        id: w.id,
        title: w.title ?? '—',
        total_volume_kg: w.total_volume_kg,
        started_at: w.started_at,
        ended_at: w.ended_at,
        pr_seance: seance,
        location_city: w.location_city,
        gym_id: w.gym_id,
        user: w.user?.[0] ?? { id: '', username: null, full_name: null },
        likes_count: likesCount.get(w.id) ?? 0,
        comments_count: commentsCount.get(w.id) ?? 0,
        user_has_liked: likedSet.has(w.id),
        first_comment: firstCommentMap.get(w.id) ?? null,
        prs: { charge, serie, exercice, seance, total },
        sessionValues: myoMap.get(w.id),
        photo_url: w.photo_url,
      }
    })

    setWorkouts(mapped)
    setKpis(computeKPIs(mapped))

    // ── Claims publics (called-shot) : actifs + réussis. L'échec reste discret. ──
    try {
      const { data: claimsData } = await supabase
        .from('claims')
        .select(
          'id, user_id, type, exercise_name, target_value, unit, scope, deadline, status, progress_current, resolved_value, created_at, resolved_at, user:user_id(id, username, full_name)'
        )
        .eq('is_public', true)
        .in('status', ['active', 'succeeded'])
        .order('created_at', { ascending: false })
        .limit(30)

      type RawClaim = {
        id: string
        user_id: string
        type: ClaimType
        exercise_name: string | null
        target_value: number
        unit: string
        scope: ClaimScope
        deadline: string | null
        status: ClaimStatus
        progress_current: number
        resolved_value: number | null
        created_at: string
        resolved_at: string | null
        user: Array<{ id: string; username: string | null; full_name: string | null }>
      }
      const rawClaims = (claimsData ?? []) as unknown as RawClaim[]
      const claimIds = rawClaims.map((c) => c.id)

      const voteAgg = new Map<string, { believe: number; doubt: number; mine: ClaimVote | null }>()
      if (claimIds.length > 0) {
        const { data: votesData } = await supabase
          .from('claim_votes')
          .select('claim_id, user_id, vote')
          .in('claim_id', claimIds)
        for (const v of (votesData ?? []) as Array<{
          claim_id: string
          user_id: string
          vote: ClaimVote
        }>) {
          const agg = voteAgg.get(v.claim_id) ?? { believe: 0, doubt: 0, mine: null }
          if (v.vote === 'believe') agg.believe += 1
          else agg.doubt += 1
          if (v.user_id === uid) agg.mine = v.vote
          voteAgg.set(v.claim_id, agg)
        }
      }

      const claimsMapped: ClaimFeedItem[] = rawClaims.map((c) => {
        const agg = voteAgg.get(c.id) ?? { believe: 0, doubt: 0, mine: null }
        return {
          id: c.id,
          user: c.user?.[0] ?? { id: c.user_id, username: null, full_name: null },
          type: c.type,
          exercise_name: c.exercise_name,
          target_value: c.target_value,
          unit: c.unit,
          scope: c.scope,
          deadline: c.deadline,
          status: c.status,
          progress_current: c.progress_current,
          resolved_value: c.resolved_value,
          created_at: c.created_at,
          resolved_at: c.resolved_at,
          believe: agg.believe,
          doubt: agg.doubt,
          myVote: agg.mine,
        }
      })
      setClaimItems(claimsMapped)
    } catch (e) {
      log.error('[feed] claims', e)
    }
  }, [])

  // Timeline unifiée séances + claims, antichronologique.
  const feedEntries = useMemo<FeedEntry[]>(() => {
    const wEntries: FeedEntry[] = workouts.map((w) => ({
      kind: 'workout',
      ts: new Date(w.started_at).getTime(),
      id: w.id,
      workout: w,
    }))
    const cEntries: FeedEntry[] = claimItems.map((c) => ({
      kind: 'claim',
      ts: new Date(c.resolved_at ?? c.created_at).getTime(),
      id: c.id,
      claim: c,
    }))
    return [...wEntries, ...cEntries].sort((a, b) => b.ts - a.ts)
  }, [workouts, claimItems])

  // Pronostic believe/doubt — optimiste puis réconcilié serveur.
  const voteOnClaim = useCallback(
    async (claimId: string, vote: ClaimVote): Promise<void> => {
      if (!currentUserId) return
      setClaimItems((prev) =>
        prev.map((c) => {
          if (c.id !== claimId) return c
          let { believe, doubt } = c
          if (c.myVote === 'believe') believe -= 1
          if (c.myVote === 'doubt') doubt -= 1
          const next: ClaimVote | null = c.myVote === vote ? null : vote
          if (next === 'believe') believe += 1
          if (next === 'doubt') doubt += 1
          return { ...c, believe, doubt, myVote: next }
        })
      )
      await voteClaimApi(claimId, vote)
      const fresh = await getClaimVotes(claimId, currentUserId)
      setClaimItems((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? { ...c, believe: fresh.believe, doubt: fresh.doubt, myVote: fresh.mine }
            : c
        )
      )
    },
    [currentUserId]
  )

  const handleLike = useCallback(
    async (workoutId: string, hasLiked: boolean): Promise<void> => {
      if (!currentUserId) return

      // Optimistic update
      const applyDelta = (liked: boolean, delta: number) =>
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === workoutId
              ? { ...w, user_has_liked: liked, likes_count: w.likes_count + delta }
              : w
          )
        )

      applyDelta(!hasLiked, hasLiked ? -1 : 1)

      const { error } = hasLiked
        ? await supabase
            .from('likes')
            .delete()
            .eq('user_id', currentUserId)
            .eq('workout_id', workoutId)
        : await supabase.from('likes').insert({ user_id: currentUserId, workout_id: workoutId })

      // Revert on error (ORA-037)
      if (error) {
        applyDelta(hasLiked, hasLiked ? 1 : -1)
      }
    },
    [currentUserId]
  )

  return {
    workouts,
    feedEntries,
    currentUserId,
    currentUserFirstName,
    kpis,
    fetchFeed,
    handleLike,
    voteOnClaim,
  }
}
