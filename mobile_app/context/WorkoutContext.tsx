import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export type PrLevel = 'gold' | 'silver' | 'bronze' | null

export interface WorkoutSet {
  set_number: number
  weight_kg: number
  reps: number
  is_pr: boolean
  pr_charge: boolean
  pr_serie: boolean
  pr_1rm: boolean
  pr_level: PrLevel
  rest_seconds: number | null
  validated_at: number | null  // internal ms timestamp, not persisted
  validated: boolean
}

export interface WorkoutExercise {
  exercise_id: string
  name: string
  muscle_group: string | null
  equipment_type: string | null
  sets: WorkoutSet[]
  previous_pr_weight: number | null
  previous_pr_set_volume: number | null
  previous_pr_1rm: number | null
  pr_top3: { pr1: number; pr2: number | null; pr3: number | null }
}

export type WorkoutStatus = 'idle' | 'active' | 'done'

interface WorkoutContextValue {
  status: WorkoutStatus
  startedAt: Date | null
  exercises: WorkoutExercise[]
  currentIndex: number
  elapsedSeconds: number
  startWorkout: () => void
  finishWorkout: () => void
  resetWorkout: () => void
  addExercise: (id: string, name: string, muscleGroup: string | null, equipmentType?: string | null) => Promise<void>
  removeExercise: (index: number) => void
  setCurrentIndex: (i: number) => void
  updateDraftSet: (exerciseIndex: number, field: 'weight_kg' | 'reps', value: number) => void
  validateSet: (exerciseIndex: number) => { isPrCharge: boolean; isPrSerie: boolean; isPr1rm: boolean; prLevel: PrLevel }
  removeSet: (exerciseIndex: number, setIndex: number) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lastDraftIndex(sets: WorkoutSet[]): number {
  for (let i = sets.length - 1; i >= 0; i--) {
    if (!sets[i].validated) return i
  }
  return -1
}

function makeDraft(setNumber: number, weight = 0, reps = 0): WorkoutSet {
  return {
    set_number: setNumber,
    weight_kg: weight,
    reps,
    is_pr: false,
    pr_charge: false,
    pr_serie: false,
    pr_1rm: false,
    pr_level: null,
    rest_seconds: null,
    validated_at: null,
    validated: false,
  }
}

function epley1rm(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

function computePrLevel(weight: number, top3: { pr1: number; pr2: number | null; pr3: number | null }): PrLevel {
  if (weight > top3.pr1) return 'gold'
  if (top3.pr2 !== null && weight > top3.pr2) return 'silver'
  if (top3.pr3 !== null && weight > top3.pr3) return 'bronze'
  return null
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext)
  if (!ctx) throw new Error('useWorkout must be inside WorkoutProvider')
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WorkoutStatus>('idle')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Tracks the timestamp of the last validated set across the whole workout
  const lastValidatedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  function startWorkout() {
    setStatus('active')
    setStartedAt(new Date())
    setElapsedSeconds(0)
    setExercises([])
    setCurrentIndex(0)
    lastValidatedAtRef.current = null
  }

  function finishWorkout() {
    setStatus('done')
  }

  function resetWorkout() {
    setStatus('idle')
    setStartedAt(null)
    setElapsedSeconds(0)
    setExercises([])
    setCurrentIndex(0)
    lastValidatedAtRef.current = null
  }

  async function addExercise(
    id: string,
    name: string,
    muscleGroup: string | null,
    equipmentType: string | null = null,
  ) {
    let prevPrWeight: number | null = null
    let prevPrSetVolume: number | null = null
    let prevPr1rm: number | null = null
    let pr_top3: WorkoutExercise['pr_top3'] = { pr1: 0, pr2: null, pr3: null }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('workout_sets')
          .select(`
            weight_kg, reps,
            workout_exercises!inner (
              exercise_id,
              workouts!inner ( user_id )
            )
          `)
          .eq('workout_exercises.exercise_id', id)
          .eq('workout_exercises.workouts.user_id', user.id)

        if (data && data.length > 0) {
          let maxWeight = 0
          let maxSetVol = 0
          let max1rm = 0
          const allWeights: number[] = []

          for (const s of data as any[]) {
            const w = s.weight_kg ?? 0
            const r = s.reps ?? 0
            if (w > 0) allWeights.push(w)
            if (w > maxWeight) maxWeight = w
            const sv = w * r
            if (sv > maxSetVol) maxSetVol = sv
            const rm = epley1rm(w, r)
            if (rm > max1rm) max1rm = rm
          }

          prevPrWeight = maxWeight || null
          prevPrSetVolume = maxSetVol || null
          prevPr1rm = max1rm || null

          // Compute top 3 distinct weights for pr_level
          const sortedDistinct = [...new Set(allWeights)].sort((a, b) => b - a)
          pr_top3 = {
            pr1: sortedDistinct[0] ?? 0,
            pr2: sortedDistinct[1] ?? null,
            pr3: sortedDistinct[2] ?? null,
          }
        }
      }
    } catch (_) {
      // Non-bloquant
    }

    const newExercise: WorkoutExercise = {
      exercise_id: id,
      name,
      muscle_group: muscleGroup,
      equipment_type: equipmentType,
      previous_pr_weight: prevPrWeight,
      previous_pr_set_volume: prevPrSetVolume,
      previous_pr_1rm: prevPr1rm,
      pr_top3,
      sets: [makeDraft(1)],
    }

    const newIndex = exercises.length
    setExercises(prev => [...prev, newExercise])
    setCurrentIndex(newIndex)
  }

  function removeExercise(index: number) {
    setExercises(prev => prev.filter((_, i) => i !== index))
    setCurrentIndex(prev => Math.max(0, Math.min(prev, exercises.length - 2)))
  }

  function updateDraftSet(exerciseIndex: number, field: 'weight_kg' | 'reps', value: number) {
    setExercises(prev => {
      const next = [...prev]
      const ex = { ...next[exerciseIndex], sets: [...next[exerciseIndex].sets] }
      const draftIdx = lastDraftIndex(ex.sets)
      if (draftIdx === -1) return prev
      ex.sets[draftIdx] = { ...ex.sets[draftIdx], [field]: Math.max(0, value) }
      next[exerciseIndex] = ex
      return next
    })
  }

  function validateSet(exerciseIndex: number): { isPrCharge: boolean; isPrSerie: boolean; isPr1rm: boolean; prLevel: PrLevel } {
    const ex = exercises[exerciseIndex]
    if (!ex) return { isPrCharge: false, isPrSerie: false, isPr1rm: false, prLevel: null }

    const draftIdx = lastDraftIndex(ex.sets)
    if (draftIdx === -1) return { isPrCharge: false, isPrSerie: false, isPr1rm: false, prLevel: null }

    const draft = ex.sets[draftIdx]
    if (draft.weight_kg <= 0 || draft.reps <= 0) return { isPrCharge: false, isPrSerie: false, isPr1rm: false, prLevel: null }

    // Compute session max values before this set
    const validatedSets = ex.sets.filter((s, i) => s.validated && i !== draftIdx)
    const sessionMaxWeight = validatedSets.reduce((m, s) => Math.max(m, s.weight_kg), 0)
    const sessionMaxSetVol = validatedSets.reduce((m, s) => Math.max(m, s.weight_kg * s.reps), 0)
    const sessionMax1rm = validatedSets.reduce((m, s) => Math.max(m, epley1rm(s.weight_kg, s.reps)), 0)

    const effectivePrWeight = Math.max(ex.previous_pr_weight ?? 0, sessionMaxWeight)
    const effectivePrSetVol = Math.max(ex.previous_pr_set_volume ?? 0, sessionMaxSetVol)
    const effectivePr1rm = Math.max(ex.previous_pr_1rm ?? 0, sessionMax1rm)

    const isPrCharge = draft.weight_kg > effectivePrWeight
    const isPrSerie = (draft.weight_kg * draft.reps) > effectivePrSetVol
    const isPr1rm = epley1rm(draft.weight_kg, draft.reps) > effectivePr1rm
    const isAnyPr = isPrCharge || isPrSerie || isPr1rm

    // PR level based on top-3 historical weights
    const prLevel = computePrLevel(draft.weight_kg, ex.pr_top3)

    // Rest time since last validated set (across all exercises)
    const now = Date.now()
    const rest_seconds = lastValidatedAtRef.current !== null
      ? Math.round((now - lastValidatedAtRef.current) / 1000)
      : null
    lastValidatedAtRef.current = now

    setExercises(prev => {
      const next = [...prev]
      const exCopy = { ...next[exerciseIndex], sets: [...next[exerciseIndex].sets] }
      const dIdx = lastDraftIndex(exCopy.sets)
      if (dIdx === -1) return prev

      exCopy.sets[dIdx] = {
        ...exCopy.sets[dIdx],
        validated: true,
        is_pr: isAnyPr,
        pr_charge: isPrCharge,
        pr_serie: isPrSerie,
        pr_1rm: isPr1rm,
        pr_level: prLevel,
        rest_seconds,
        validated_at: now,
      }

      const validatedCount = exCopy.sets.filter(s => s.validated).length
      exCopy.sets.push(makeDraft(validatedCount + 1, draft.weight_kg, draft.reps))

      if (isPrCharge) exCopy.previous_pr_weight = draft.weight_kg
      if (isPrSerie) exCopy.previous_pr_set_volume = draft.weight_kg * draft.reps
      if (isPr1rm) exCopy.previous_pr_1rm = epley1rm(draft.weight_kg, draft.reps)

      next[exerciseIndex] = exCopy
      return next
    })

    return { isPrCharge, isPrSerie, isPr1rm, prLevel }
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setExercises(prev => {
      const next = [...prev]
      const ex = { ...next[exerciseIndex] }
      const sets = ex.sets.filter((_, i) => i !== setIndex)

      let counter = 0
      ex.sets = sets.map(s => {
        if (s.validated) { counter++; return { ...s, set_number: counter } }
        return { ...s, set_number: counter + 1 }
      })

      next[exerciseIndex] = ex
      return next
    })
  }

  return (
    <WorkoutContext.Provider value={{
      status, startedAt, exercises, currentIndex, elapsedSeconds,
      startWorkout, finishWorkout, resetWorkout,
      addExercise, removeExercise, setCurrentIndex,
      updateDraftSet, validateSet, removeSet,
    }}>
      {children}
    </WorkoutContext.Provider>
  )
}
