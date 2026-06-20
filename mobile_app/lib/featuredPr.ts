// ─── lib/featuredPr.ts — PR vedette du profil (vitrine) ───────────────────────
// L'utilisateur peut épingler un PR sur son profil (curation = identité). Tant
// qu'il n'a rien épinglé (users.featured_pr NULL), on auto-sélectionne son meilleur
// record (gold pr_charge le plus lourd) → la vitrine n'est jamais vide après le 1er PR.
//
// Snapshot dénormalisé (pas de jointure au render) — même forme que users.featured_pr.
// Le pin manuel (manual:true) n'est jamais écrasé par l'auto-pick.

import { log } from '@/lib/logger'
import { supabase } from '@/lib/supabase'

export interface FeaturedPr {
  set_id: string | null
  exercise_id: string | null
  exercise_name: string
  weight_kg: number
  reps: number | null
  achieved_at: number // UNIX ms
  delta_kg: number | null // vs ancien record du même exercice (null si premier)
  manual: boolean // true = épinglé à la main → l'auto-pick ne l'écrase pas
}

interface WeRow {
  id: string
  exercise_id: string
}
interface SetRow {
  weight_kg: number | null
  reps: number | null
  pr_charge: string | null
  logged_at: string | null
  workout_exercise_id: string
}

// ─── Logique pure (testée par import réel — ORA-080) ──────────────────────────────

// Meilleur set affichable : priorité aux 'gold', sinon tous ; départage au poids le plus lourd.
export function selectBestPrSet(sets: SetRow[]): SetRow | null {
  if (sets.length === 0) return null
  const golds = sets.filter((s) => s.pr_charge === 'gold')
  const pool = golds.length > 0 ? golds : sets
  return pool.reduce((b, s) => ((s.weight_kg ?? 0) > (b.weight_kg ?? 0) ? s : b), pool[0])
}

// Delta vs ancien record du même exercice : meilleur poids strictement < au record.
// null si aucun poids inférieur (premier record de cet exercice).
export function computePrDelta(bestWeight: number, sameExerciseWeights: number[]): number | null {
  const below = sameExerciseWeights.filter((w) => w < bestWeight)
  if (below.length === 0) return null
  return bestWeight - Math.max(...below)
}

// Meilleur record affichable : le pr_charge 'gold' le plus lourd, toutes séances.
export async function getAutoFeaturedPr(userId: string): Promise<FeaturedPr | null> {
  try {
    const { data: workouts } = await supabase.from('workouts').select('id').eq('user_id', userId)
    const workoutIds = ((workouts ?? []) as Array<{ id: string }>).map((w) => w.id)
    if (workoutIds.length === 0) return null

    const { data: weData } = await supabase
      .from('workout_exercises')
      .select('id, exercise_id')
      .in('workout_id', workoutIds)
    const weRows = (weData ?? []) as WeRow[]
    if (weRows.length === 0) return null

    const weToExercise = new Map<string, string>()
    for (const we of weRows) weToExercise.set(we.id, we.exercise_id)

    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps, pr_charge, logged_at, workout_exercise_id')
      .in('workout_exercise_id', [...weToExercise.keys()])
      .not('pr_charge', 'is', null)
    const sets = (setsData ?? []) as SetRow[]
    if (sets.length === 0) return null

    // Meilleur gold (sinon meilleur tout court) par poids.
    const best = selectBestPrSet(sets)
    if (!best) return null
    const bestExerciseId = weToExercise.get(best.workout_exercise_id) ?? null

    // Delta vs ancien record du même exercice (2e poids le plus lourd de cet exo).
    let delta: number | null = null
    if (bestExerciseId) {
      const sameExWeIds = new Set(
        weRows.filter((we) => we.exercise_id === bestExerciseId).map((we) => we.id)
      )
      const sameExWeights = sets
        .filter((s) => sameExWeIds.has(s.workout_exercise_id))
        .map((s) => s.weight_kg ?? 0)
      delta = computePrDelta(best.weight_kg ?? 0, sameExWeights)
    }

    let exerciseName = 'Exercice'
    if (bestExerciseId) {
      const { data: ex } = await supabase
        .from('exercises')
        .select('name_fr')
        .eq('id', bestExerciseId)
        .single()
      if (ex) exerciseName = (ex as { name_fr: string }).name_fr
    }

    return {
      set_id: null,
      exercise_id: bestExerciseId,
      exercise_name: exerciseName,
      weight_kg: best.weight_kg ?? 0,
      reps: best.reps,
      achieved_at: best.logged_at ? new Date(best.logged_at).getTime() : Date.now(),
      delta_kg: delta,
      manual: false,
    }
  } catch (e) {
    log.error('[featuredPr] getAutoFeaturedPr', e)
    return null
  }
}

// Lecture du PR vedette épinglé à la main (users.featured_pr). Isolée + best-effort :
// la colonne n'existe qu'après la migration ORA-075 → un échec (colonne absente) renvoie
// null sans casser le profil (raison pour laquelle elle reste HORS du select profil critique).
// Post-migration : prioritaire sur l'auto-pick.
export async function getManualFeaturedPr(userId: string): Promise<FeaturedPr | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('featured_pr')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return (data as { featured_pr: FeaturedPr | null }).featured_pr ?? null
  } catch (e) {
    log.error('[featuredPr] getManualFeaturedPr', e)
    return null
  }
}

// Épingle manuellement un snapshot (Phase B / ORA-076). Renvoie true si l'écriture a réussi
// (false pré-migration : colonne featured_pr absente → l'UI n'affiche pas de confirmation).
export async function pinFeaturedPr(pr: Omit<FeaturedPr, 'manual'>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { error } = await supabase
    .from('users')
    .update({ featured_pr: { ...pr, manual: true } })
    .eq('id', user.id)
  if (error) {
    log.error('[featuredPr] pinFeaturedPr', error)
    return false
  }
  return true
}

// Épingle le meilleur PR d'un exercice donné depuis l'Armurerie (ORA-076).
// Re-dérive le snapshot (meilleur gold + delta) avec les mêmes helpers purs que l'auto-pick.
export async function pinExerciseAsFeatured(
  exerciseId: string,
  exerciseName: string
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: workouts } = await supabase.from('workouts').select('id').eq('user_id', user.id)
    const workoutIds = ((workouts ?? []) as Array<{ id: string }>).map((w) => w.id)
    if (workoutIds.length === 0) return false

    const { data: weData } = await supabase
      .from('workout_exercises')
      .select('id')
      .eq('exercise_id', exerciseId)
      .in('workout_id', workoutIds)
    const weIds = ((weData ?? []) as Array<{ id: string }>).map((we) => we.id)
    if (weIds.length === 0) return false

    const { data: setsData } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps, pr_charge, logged_at, workout_exercise_id')
      .in('workout_exercise_id', weIds)
      .not('pr_charge', 'is', null)
    const sets = (setsData ?? []) as SetRow[]
    const best = selectBestPrSet(sets)
    if (!best) return false

    const delta = computePrDelta(
      best.weight_kg ?? 0,
      sets.map((s) => s.weight_kg ?? 0)
    )

    return await pinFeaturedPr({
      set_id: null,
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      weight_kg: best.weight_kg ?? 0,
      reps: best.reps,
      achieved_at: best.logged_at ? new Date(best.logged_at).getTime() : Date.now(),
      delta_kg: delta,
    })
  } catch (e) {
    log.error('[featuredPr] pinExerciseAsFeatured', e)
    return false
  }
}
