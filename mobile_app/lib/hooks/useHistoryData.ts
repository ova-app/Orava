// ─── useHistoryData — couche data de l'écran History (ORA-034) ────────────────
// Extrait de app/(tabs)/history.tsx : fetch + regroupement par mois.
// L'écran ne garde que le rendu.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WorkoutRow {
  id: string
  title: string
  started_at: string
  duration_sec: number | null
  total_volume_kg: number | null
  total_sets: number
  pr_seance: 'gold' | 'silver' | 'bronze' | null
}

export interface HistorySection {
  title: string // "MAI 2026"
  data: WorkoutRow[]
}

const MONTHS_FR = [
  'JANVIER',
  'FÉVRIER',
  'MARS',
  'AVRIL',
  'MAI',
  'JUIN',
  'JUILLET',
  'AOÛT',
  'SEPTEMBRE',
  'OCTOBRE',
  'NOVEMBRE',
  'DÉCEMBRE',
]

function sectionKeyFromDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export function groupByMonth(rows: WorkoutRow[]): HistorySection[] {
  const map = new Map<string, WorkoutRow[]>()
  for (const row of rows) {
    const key = sectionKeyFromDate(row.started_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }))
}

export function useHistoryData(): { sections: HistorySection[]; loading: boolean } {
  const [sections, setSections] = useState<HistorySection[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id
    if (!uid) return

    const { data, error } = await supabase
      .from('workouts')
      .select(
        `
        id,
        title,
        started_at,
        duration_sec,
        total_volume_kg,
        pr_seance,
        workout_exercises (
          workout_sets ( id )
        )
      `
      )
      .eq('user_id', uid)
      .order('started_at', { ascending: false })
      .limit(200)

    if (error || !data) return

    const rows: WorkoutRow[] = (
      data as Array<{
        id: string
        title: string
        started_at: string
        duration_sec: number | null
        total_volume_kg: number | null
        pr_seance: 'gold' | 'silver' | 'bronze' | null
        workout_exercises: Array<{ workout_sets: Array<{ id: string }> }>
      }>
    ).map((w) => {
      const totalSets = w.workout_exercises.reduce((acc, ex) => acc + ex.workout_sets.length, 0)
      return {
        id: w.id,
        title: w.title ?? '—',
        started_at: w.started_at,
        duration_sec: w.duration_sec,
        total_volume_kg: w.total_volume_kg,
        total_sets: totalSets,
        pr_seance: w.pr_seance,
      }
    })

    setSections(groupByMonth(rows))
  }, [])

  useEffect(() => {
    fetchHistory().finally(() => setLoading(false))
  }, [fetchHistory])

  return { sections, loading }
}
