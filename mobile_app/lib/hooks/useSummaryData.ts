// ─── useSummaryData — couche data (lecture) de l'écran Summary (ORA-034) ───────
// Extrait de app/workout/summary.tsx : calcul des sessionValues Myo (avec
// enrichissement famille 6 muscles depuis exercise_muscles) + historique volume
// pour le sparkline. Le pipeline de SAVE reste dans l'écran (couplé à l'UI :
// photo, is_public, géoloc, navigation, idempotence workoutId).

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'
import { computeSessionValues, computeMuscleDims, type EmRow } from '@/lib/myo'
import type { WorkoutExercise } from '@/context/WorkoutContext'

function baseSessionInput(exercises: WorkoutExercise[], elapsedSeconds: number) {
  const sets = exercises.flatMap((ex) =>
    ex.sets.filter((s) => s.validated && s.weight_kg > 0 && s.reps > 0)
  )
  const vol = sets.reduce((s, set) => s + set.weight_kg * set.reps, 0)
  const pMax = sets.length ? Math.max(...sets.map((s) => s.weight_kg)) : 0
  const densite = elapsedSeconds > 0 ? (vol / elapsedSeconds) * 60 : 0
  return {
    volume_kg: vol,
    densite,
    nb_series: sets.length,
    nb_exercices: exercises.length,
    nb_pr: sets.filter((s) => s.pr_charge !== null || s.pr_serie !== null).length,
    streak: 0,
    frequence_hebdo: 0,
    nb_seances_30j: 0,
    duree_sec: elapsedSeconds,
    temps_repos_moy_sec: 120,
    ratio_actif: 0.5,
    poids_max_kg: pMax,
    charge_relative: 65,
  }
}

export interface SummaryData {
  sessionValues: number[][]
  // Exposé : le pipeline de save met à jour avec la vraie signature Myo post-save
  setSessionValues: Dispatch<SetStateAction<number[][]>>
  histVolumes: number[]
}

export function useSummaryData(exercises: WorkoutExercise[], elapsedSeconds: number): SummaryData {
  const [sessionValues, setSessionValues] = useState<number[][]>(() =>
    computeSessionValues(baseSessionInput(exercises, elapsedSeconds))
  )
  const [histVolumes, setHistVolumes] = useState<number[]>([])

  // Enrichit la famille 6 (muscles) dès le mount sans attendre le save
  useEffect(() => {
    const exerciseIds = exercises.map((ex) => ex.exercise_id).filter(Boolean)
    if (!exerciseIds.length) return
    void (async () => {
      const { data } = await supabase
        .from('exercise_muscles')
        .select('exercise_id, muscle, fascicle, activation_pct')
        .in('exercise_id', exerciseIds)
        .in('role', ['primary', 'secondary'])
      if (!data?.length) return
      const setsByEx: Record<
        string,
        Array<{ weight_kg: number; reps: number }>
      > = Object.fromEntries(
        exercises.map((ex) => [
          ex.exercise_id,
          ex.sets
            .filter((s) => s.validated && s.weight_kg > 0 && s.reps > 0)
            .map((s) => ({ weight_kg: s.weight_kg, reps: s.reps })),
        ])
      )
      const muscleDims = computeMuscleDims(setsByEx, data as EmRow[])
      setSessionValues(
        computeSessionValues({ ...baseSessionInput(exercises, elapsedSeconds), muscleDims })
      )
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Historique des 8 derniers volumes pour le sparkline de tendance
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('workouts')
        .select('total_volume_kg')
        .eq('user_id', user.id)
        .not('total_volume_kg', 'is', null)
        .order('started_at', { ascending: false })
        .limit(8)
      if (data?.length) {
        setHistVolumes(
          (data as { total_volume_kg: number }[]).map((w) => w.total_volume_kg).reverse()
        )
      }
    })()
  }, [])

  return { sessionValues, setSessionValues, histVolumes }
}
