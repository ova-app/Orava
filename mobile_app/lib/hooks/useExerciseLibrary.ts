// ─── useExerciseLibrary — couche data de la modale "Ajouter un exercice" (ORA-034)
// Extrait de app/workout/session.tsx (ExerciseModal) : chargement de la
// bibliothèque d'exercices + recherche/filtre + regroupement par section.
// Lecture seule (table exercices statique) — aucun impact sur la séance active.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ExerciseRow {
  id: string
  name_fr: string
  muscle_group: string | null
  equipment_type: string | null
}

// Regroupement grossier propre à la bibliothèque (Bras/Jambes fusionnés) —
// distinct de MUSCLE_GROUP_LABELS (lib/muscles.ts) qui labellise chaque groupe.
export const MUSCLE_LABELS: Record<string, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Bras',
  triceps: 'Bras',
  quadriceps: 'Jambes',
  ischio_jambiers: 'Jambes',
  fessiers: 'Jambes',
  mollets: 'Jambes',
  abdominaux: 'Core',
}

export function normalizeNFD(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export type ExerciseListItem =
  | { type: 'header'; title: string }
  | { type: 'exercise'; item: ExerciseRow }

export interface ExerciseLibrary {
  loading: boolean
  search: string
  setSearch: (s: string) => void
  filter: string | null
  setFilter: (f: string | null) => void
  flatData: ExerciseListItem[]
  reset: () => void
}

export function useExerciseLibrary(visible: boolean): ExerciseLibrary {
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)

  // Chargement à l'ouverture de la modale
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data } = await supabase
          .from('exercises')
          .select('id, name_fr, muscle_group, equipment_type')
          .order('name_fr')
        if (!cancelled && data) setExercises(data as ExerciseRow[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visible])

  // Filtre recherche + groupe
  const filtered = useMemo(() => {
    let list = exercises
    if (filter) list = list.filter((e) => e.muscle_group === filter)
    if (search.trim()) {
      const q = normalizeNFD(search.trim())
      list = list.filter((e) => normalizeNFD(e.name_fr).includes(q))
    }
    return list
  }, [exercises, search, filter])

  // Regroupement par libellé de section (plusieurs muscle_groups → même libellé)
  const sections = useMemo(() => {
    const map = new Map<string, ExerciseRow[]>()
    for (const ex of filtered) {
      const label = (
        MUSCLE_LABELS[ex.muscle_group ?? ''] ??
        ex.muscle_group ??
        'autre'
      ).toUpperCase()
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(ex)
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }))
  }, [filtered])

  // Aplati pour FlatList (headers de section intercalés)
  const flatData: ExerciseListItem[] = useMemo(() => {
    const result: ExerciseListItem[] = []
    for (const section of sections) {
      result.push({ type: 'header', title: section.title })
      for (const ex of section.data) {
        result.push({ type: 'exercise', item: ex })
      }
    }
    return result
  }, [sections])

  const reset = useCallback(() => {
    setSearch('')
    setFilter(null)
  }, [])

  return { loading, search, setSearch, filter, setFilter, flatData, reset }
}
