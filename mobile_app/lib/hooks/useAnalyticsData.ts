// ─── useAnalyticsData — couche data de l'écran Analytics (ORA-034) ────────────
import { log } from '@/lib/logger'
// Extrait de app/analytics.tsx : volume rolling 7/30/90j, muscles 30j, PRs
// récents, prédictions (cache local). L'écran ne garde que le rendu.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { MUSCLE_LABELS } from '@/lib/muscles'
import type { Prediction } from '@/lib/predictor'

export interface VolumeRolling {
  vol7j: number
  vol30j: number
  vol90j: number
  delta7vs30: number // % delta vs moyenne sur 30j
}

export interface MuscleBar {
  label: string
  pct: number // normalisé 0-100
  volKg: number
}

export interface RecentPR {
  exerciseName: string
  prType: 'charge' | 'serie'
  value: number
  unit: string
  level: 'gold' | 'silver' | 'bronze'
  seanceDate: string
}

export interface AnalyticsData {
  volumeRolling: VolumeRolling | null
  muscleBars: MuscleBar[]
  recentPRs: RecentPR[]
  predictions: Prediction[]
  totalSeances: number
  totalVolumeKg: number
  loading: boolean
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - n)
  return r
}

export function useAnalyticsData(): AnalyticsData {
  const router = useRouter()

  const [volumeRolling, setVolumeRolling] = useState<VolumeRolling | null>(null)
  const [muscleBars, setMuscleBars] = useState<MuscleBar[]>([])
  const [recentPRs, setRecentPRs] = useState<RecentPR[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [totalSeances, setTotalSeances] = useState<number>(0)
  const [totalVolumeKg, setTotalVolumeKg] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchData = useCallback(async (): Promise<void> => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/auth/login')
      return
    }

    const now = new Date()
    const since90 = subDays(now, 90).toISOString()
    const since30 = subDays(now, 30).toISOString()
    const since7 = subDays(now, 7).toISOString()

    // ── Volume rolling 7/30/90j ──
    const { data: workoutsData } = await supabase
      .from('workouts')
      .select('id, total_volume_kg, started_at')
      .eq('user_id', user.id)
      .gte('started_at', since90)
      .order('started_at', { ascending: false })

    const workouts = (workoutsData ?? []) as Array<{
      id: string
      total_volume_kg: number | null
      started_at: string
    }>

    setTotalSeances(workouts.length)
    setTotalVolumeKg(workouts.reduce((s, w) => s + (w.total_volume_kg ?? 0), 0))

    const vol90 = workouts.reduce((s, w) => s + (w.total_volume_kg ?? 0), 0)
    const vol30 = workouts
      .filter((w) => w.started_at >= since30)
      .reduce((s, w) => s + (w.total_volume_kg ?? 0), 0)
    const vol7 = workouts
      .filter((w) => w.started_at >= since7)
      .reduce((s, w) => s + (w.total_volume_kg ?? 0), 0)

    // delta 7j vs moyenne hebdo sur 30j (= vol30j / 4)
    const moy7sur30 = vol30 / 4
    const delta7vs30 = moy7sur30 > 0 ? ((vol7 - moy7sur30) / moy7sur30) * 100 : 0

    setVolumeRolling({ vol7j: vol7, vol30j: vol30, vol90j: vol90, delta7vs30 })

    // ── Muscles rolling 30j ──
    const workoutIds30 = workouts.filter((w) => w.started_at >= since30).map((w) => w.id)

    if (workoutIds30.length > 0) {
      const { data: weData } = await supabase
        .from('workout_exercises')
        .select('exercise_id, workout_sets(weight_kg, reps)')
        .in('workout_id', workoutIds30)

      type WeRow = {
        exercise_id: string
        workout_sets: Array<{ weight_kg: number | null; reps: number | null }> | null
      }
      const exerciseIds = [...new Set(((weData as WeRow[]) ?? []).map((we) => we.exercise_id))]

      if (exerciseIds.length > 0) {
        const { data: emData } = await supabase
          .from('exercise_muscles')
          .select('exercise_id, muscle, role, activation_pct')
          .in('exercise_id', exerciseIds)
          .in('role', ['primary', 'secondary'])

        type EmRow = {
          exercise_id: string
          muscle: string
          role: string
          activation_pct: number | null
        }

        const muscleVol: Record<string, number> = {}

        // ORA-031 — pré-indexer weData par exercise_id (Map) au lieu d'un .filter
        // complet par ligne em → O(n+m) au lieu de O(n×m).
        const weByExercise = new Map<string, WeRow[]>()
        for (const we of (weData as WeRow[]) ?? []) {
          const arr = weByExercise.get(we.exercise_id)
          if (arr) arr.push(we)
          else weByExercise.set(we.exercise_id, [we])
        }

        for (const em of (emData as EmRow[]) ?? []) {
          const exRows = weByExercise.get(em.exercise_id) ?? []
          for (const exRow of exRows) {
            const vol = (exRow.workout_sets ?? []).reduce(
              (s, set) =>
                s + (set.weight_kg ?? 0) * (set.reps ?? 0) * ((em.activation_pct ?? 0) / 100),
              0
            )
            const label = MUSCLE_LABELS[em.muscle] ?? em.muscle
            muscleVol[label] = (muscleVol[label] ?? 0) + vol
          }
        }

        const maxVol = Math.max(...Object.values(muscleVol), 1)
        const bars: MuscleBar[] = Object.entries(muscleVol)
          .map(([label, vol]) => ({
            label,
            pct: Math.round((vol / maxVol) * 100),
            volKg: Math.round(vol),
          }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 8)

        setMuscleBars(bars)
      }
    }

    // ── PRs récents ──
    const { data: setsData } = await supabase
      .from('workout_sets')
      .select(
        `
        weight_kg, reps, pr_charge, pr_serie, logged_at,
        workout_exercises!inner(
          exercise_id,
          exercises!inner(name_fr)
        )
      `
      )
      .not('pr_charge', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(20)

    type SetRow = {
      weight_kg: number | null
      reps: number | null
      pr_charge: string | null
      pr_serie: string | null
      logged_at: string
      workout_exercises:
        | { exercise_id: string; exercises: { name_fr: string }[] | { name_fr: string } }[]
        | { exercise_id: string; exercises: { name_fr: string }[] | { name_fr: string } }
    }

    if (setsData) {
      // Déduplique par exercice — 1 PR par exercice max
      const seen = new Set<string>()
      const prs: RecentPR[] = []

      for (const row of setsData as SetRow[]) {
        const we = Array.isArray(row.workout_exercises)
          ? row.workout_exercises[0]
          : row.workout_exercises
        const exRaw = we.exercises
        const ex = Array.isArray(exRaw) ? exRaw[0] : exRaw
        if (!ex || seen.has(ex.name_fr)) continue
        seen.add(ex.name_fr)

        prs.push({
          exerciseName: ex.name_fr,
          prType: 'charge',
          value: row.weight_kg ?? 0,
          unit: 'kg',
          level: (row.pr_charge ?? 'bronze') as 'gold' | 'silver' | 'bronze',
          seanceDate: row.logged_at,
        })

        if (prs.length >= 6) break
      }

      setRecentPRs(prs)
    }

    // ── Prédictions PRs (cache local) ──
    try {
      const raw = await AsyncStorage.getItem('predictions_cache')
      if (raw) {
        const cached = JSON.parse(raw) as Prediction[]
        // Garde uniquement les prédictions avec daysUntilPR dans les 120j
        setPredictions(cached.filter((p) => p.daysUntilPR > 0 && p.daysUntilPR <= 120))
      }
    } catch (e) {
      log.error('[useAnalyticsData] cache prédictions', e)
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { volumeRolling, muscleBars, recentPRs, predictions, totalSeances, totalVolumeKg, loading }
}
