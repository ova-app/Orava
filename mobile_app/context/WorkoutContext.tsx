/**
 * ORAVA — Session 06
 * context/WorkoutContext.tsx
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkoutSet {
  set_number: number
  weight_kg: number
  reps: number
  is_pr: boolean
  validated: boolean
}

export interface WorkoutExercise {
  exercise_id: string
  name: string
  muscle_group: string | null
  sets: WorkoutSet[]
  previous_pr_weight: number | null
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
  addExercise: (id: string, name: string, muscleGroup: string | null) => Promise<void>
  removeExercise: (index: number) => void
  setCurrentIndex: (i: number) => void
  updateDraftSet: (exerciseIndex: number, field: 'weight_kg' | 'reps', value: number) => void
  validateSet: (exerciseIndex: number) => boolean
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
  return { set_number: setNumber, weight_kg: weight, reps, is_pr: false, validated: false }
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
  }

  async function addExercise(id: string, name: string, muscleGroup: string | null) {
    let previousPrWeight: number | null = null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('workout_sets')
          .select(`
            weight_kg,
            workout_exercises!inner (
              exercise_id,
              workouts!inner ( user_id )
            )
          `)
          .eq('workout_exercises.exercise_id', id)
          .eq('workout_exercises.workouts.user_id', user.id)
          .order('weight_kg', { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          previousPrWeight = (data[0] as any).weight_kg ?? null
        }
      }
    } catch (_) {
      // Non-bloquant — on détecte quand même les PRs intra-séance
    }

    const newExercise: WorkoutExercise = {
      exercise_id: id,
      name,
      muscle_group: muscleGroup,
      previous_pr_weight: previousPrWeight,
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

  // Returns true if the set was a PR
  function validateSet(exerciseIndex: number): boolean {
    const ex = exercises[exerciseIndex]
    if (!ex) return false

    const draftIdx = lastDraftIndex(ex.sets)
    if (draftIdx === -1) return false

    const draft = ex.sets[draftIdx]
    if (draft.weight_kg <= 0 || draft.reps <= 0) return false

    // PR calculé depuis l'état courant (lecture synchrone avant le setState)
    const sessionMax = ex.sets
      .filter((s, i) => s.validated && i !== draftIdx)
      .reduce((max, s) => Math.max(max, s.weight_kg), 0)

    const effectivePR = Math.max(ex.previous_pr_weight ?? 0, sessionMax)
    const isPr = draft.weight_kg > effectivePR

    setExercises(prev => {
      const next = [...prev]
      const exCopy = { ...next[exerciseIndex], sets: [...next[exerciseIndex].sets] }
      const draftIdxPrev = lastDraftIndex(exCopy.sets)
      if (draftIdxPrev === -1) return prev

      exCopy.sets[draftIdxPrev] = { ...exCopy.sets[draftIdxPrev], validated: true, is_pr: isPr }

      const validatedCount = exCopy.sets.filter(s => s.validated).length
      exCopy.sets.push(makeDraft(validatedCount + 1, draft.weight_kg, draft.reps))

      if (isPr) exCopy.previous_pr_weight = draft.weight_kg

      next[exerciseIndex] = exCopy
      return next
    })

    return isPr
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
