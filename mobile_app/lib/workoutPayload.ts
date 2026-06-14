import type { PrLevel, WorkoutExercise } from '@/context/WorkoutContext'

// Construction du payload de la RPC transactionnelle `create_workout` (ORA-007).
// Extrait de summary.tsx pour rendre la logique testable (pure, sans réseau ni render).
// Le save reste : RPC atomique (tout ou rien) → SQLite local idempotent ensuite.

export interface WorkoutMeta {
  workoutId: string
  title: string
  startedAtIso: string
  endedAtIso: string
  durationSec: number
  totalVolume: number
  isPublic: boolean
  poidsCorps: number | null
  prSeance: PrLevel
}

export interface SetPayload {
  id: string
  set_number: number
  reps: number
  weight_kg: number
  rest_seconds: number | null
  is_pr: boolean
  pr_charge: PrLevel
  pr_serie: PrLevel
  logged_at: string
}

export interface ExercisePayload {
  id: string
  exercise_id: string
  order_index: number
  pr_exercice: PrLevel
  sets: SetPayload[]
}

export interface WorkoutPayload {
  id: string
  title: string
  started_at: string
  ended_at: string
  duration_sec: number
  total_volume_kg: number
  is_public: boolean
  poids_corps_kg: number | null
  pr_seance: PrLevel
  exercises: ExercisePayload[]
}

// Lignes à écrire dans SQLite (ghost + predictor) — UNIQUEMENT après succès Supabase.
export interface LocalSetRow {
  id: string
  exercise_id: string
  weight_kg: number
  reps: number
  session_id: string
  logged_at: number
}

type Top3 = { pr1: number; pr2: number | null; pr3: number | null }
type PodiumFn = (value: number, top3: Top3) => PrLevel

/**
 * Construit le payload `create_workout` + les lignes SQLite locales.
 *
 * Garanties d'idempotence (retry après échec réseau) :
 *  - `payload.id` = workoutId stable (réutilisé tel quel) → la RPC ne réinsère pas.
 *  - `localSets[].id` = `${workoutId}-${exercise_id}-${set_number}` déterministe
 *    → l'insert SQLite (INSERT OR REPLACE) ne double pas la séance.
 *
 * `genId`/`now` sont injectables pour des tests déterministes.
 */
export function buildWorkoutPayload(
  exercises: WorkoutExercise[],
  volumeParExercice: Record<string, number>,
  meta: WorkoutMeta,
  computePodiumFn: PodiumFn,
  genId: () => string = () => crypto.randomUUID(),
  now: () => number = Date.now
): { payload: WorkoutPayload; localSets: LocalSetRow[] } {
  const exercisesPayload: ExercisePayload[] = []
  const localSets: LocalSetRow[] = []

  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei]
    const validatedSets = ex.sets.filter((s) => s.validated && s.reps > 0)
    if (validatedSets.length === 0) continue // exercice sans série valide → ignoré

    const exVolume = volumeParExercice[ex.exercise_id] ?? 0
    const prExercice = computePodiumFn(exVolume, ex.pr_top3_exercice)

    exercisesPayload.push({
      id: genId(),
      exercise_id: ex.exercise_id,
      order_index: ei, // index dans la liste complète (les exercices ignorés ne décalent pas)
      pr_exercice: prExercice,
      sets: validatedSets.map((s) => ({
        id: genId(),
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        rest_seconds: s.rest_seconds,
        is_pr: s.is_pr,
        pr_charge: s.pr_charge,
        pr_serie: s.pr_serie,
        logged_at: s.validated_at ? new Date(s.validated_at).toISOString() : meta.endedAtIso,
      })),
    })

    for (const s of validatedSets) {
      localSets.push({
        id: `${meta.workoutId}-${ex.exercise_id}-${s.set_number}`,
        exercise_id: ex.exercise_id,
        weight_kg: s.weight_kg,
        reps: s.reps,
        session_id: meta.workoutId,
        logged_at: s.validated_at ?? now(),
      })
    }
  }

  const payload: WorkoutPayload = {
    id: meta.workoutId,
    title: meta.title,
    started_at: meta.startedAtIso,
    ended_at: meta.endedAtIso,
    duration_sec: meta.durationSec,
    total_volume_kg: meta.totalVolume,
    is_public: meta.isPublic,
    poids_corps_kg: meta.poidsCorps,
    pr_seance: meta.prSeance,
    exercises: exercisesPayload,
  }

  return { payload, localSets }
}
