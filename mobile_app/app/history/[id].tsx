/**
 * ORAVA — Session 07
 * app/history/[id].tsx
 * Détail d'une séance passée
 */

import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetDetail {
  set_number: number
  weight_kg: number
  reps: number
  is_pr: boolean
}

interface ExerciseDetail {
  name: string
  equipment: string | null
  order_index: number
  sets: SetDetail[]
}

interface WorkoutDetail {
  id: string
  title: string
  started_at: string
  duration_seconds: number
  exercises: ExerciseDetail[]
  total_volume: number
  total_sets: number
  pr_count: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barre', dumbbell: 'Haltères', machine: 'Machine',
  cable: 'Poulie', bodyweight: 'Poids corps', kettlebell: 'Kettlebell',
  band: 'Élastique', other: 'Autre',
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min`
  return `${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (id) fetchWorkout(id) }, [id])

  async function fetchWorkout(workoutId: string) {
    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id, title, started_at, ended_at, duration_seconds,
        workout_exercises (
          order_index,
          exercises ( name, equipment ),
          workout_sets ( set_number, weight_kg, reps, is_pr )
        )
      `)
      .eq('id', workoutId)
      .single()

    setLoading(false)
    if (error || !data) return

    const exercises: ExerciseDetail[] = ((data.workout_exercises ?? []) as any[])
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map(we => ({
        name: we.exercises?.name ?? 'Exercice',
        equipment: we.exercises?.equipment ?? null,
        order_index: we.order_index,
        sets: ((we.workout_sets ?? []) as SetDetail[])
          .sort((a, b) => a.set_number - b.set_number),
      }))

    const allSets = exercises.flatMap(e => e.sets)

    setWorkout({
      id: data.id,
      title: data.title ?? 'Séance',
      started_at: data.started_at,
      duration_seconds: data.duration_seconds ?? 0,
      exercises,
      total_volume: allSets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0),
      total_sets: allSets.length,
      pr_count: allSets.filter(s => s.is_pr).length,
    })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D85A30" size="large" />
      </View>
    )
  }

  if (!workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Séance introuvable</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle} numberOfLines={1}>{workout.title}</Text>
          <Text style={styles.headerDate}>
            {formatDate(workout.started_at)} · {formatTime(workout.started_at)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Durée" value={formatDuration(workout.duration_seconds)} />
          <StatBox label="Séries" value={String(workout.total_sets)} />
          <StatBox
            label="Volume"
            value={workout.total_volume >= 1000
              ? `${(workout.total_volume / 1000).toFixed(1)}t`
              : `${workout.total_volume.toLocaleString('fr')} kg`
            }
          />
          {workout.pr_count > 0 && (
            <StatBox label="PRs" value={String(workout.pr_count)} highlight />
          )}
        </View>

        {/* Exercices */}
        <Text style={styles.sectionTitle}>Exercices</Text>
        {workout.exercises.map((ex, idx) => (
          <View key={idx} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {ex.equipment && (
                <Text style={styles.exerciseEquip}>
                  {EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}
                </Text>
              )}
            </View>

            {/* En-têtes colonnes */}
            <View style={styles.setHeaderRow}>
              <Text style={[styles.setCol, styles.setColLabel]}>Série</Text>
              <Text style={[styles.setCol, styles.setColLabel]}>Poids</Text>
              <Text style={[styles.setCol, styles.setColLabel]}>Reps</Text>
              <View style={{ width: 32 }} />
            </View>

            {ex.sets.map((set, sIdx) => (
              <View key={sIdx} style={styles.setRow}>
                <Text style={styles.setCol}>{set.set_number}</Text>
                <Text style={styles.setCol}>
                  {set.weight_kg % 1 === 0 ? set.weight_kg : set.weight_kg.toFixed(1)} kg
                </Text>
                <Text style={styles.setCol}>{set.reps}</Text>
                {set.is_pr ? (
                  <View style={styles.prBadge}>
                    <Text style={styles.prBadgeText}>PR</Text>
                  </View>
                ) : (
                  <View style={{ width: 32 }} />
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

// ─── StatBox ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[statStyles.box, highlight && statStyles.boxHighlight]}>
      <Text style={[statStyles.value, highlight && statStyles.valueHighlight]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  )
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  boxHighlight: { backgroundColor: '#FAC77510', borderColor: '#FAC77530' },
  value: { color: '#fff', fontSize: 17, fontWeight: '700' },
  valueHighlight: { color: '#FAC775' },
  label: { color: '#555', fontSize: 10 },
})

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#555', fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn: { paddingTop: 2 },
  backText: { color: '#D85A30', fontSize: 28, fontWeight: '300', lineHeight: 28 },
  headerMeta: { flex: 1, gap: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerDate: { color: '#555', fontSize: 12 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60, gap: 4 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },

  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 },

  exerciseCard: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    gap: 8,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  exerciseName: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  exerciseEquip: { color: '#555', fontSize: 12 },

  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  setCol: { flex: 1, color: '#ccc', fontSize: 14 },
  setColLabel: { color: '#444', fontSize: 11, fontWeight: '500' },

  prBadge: {
    width: 32,
    backgroundColor: '#FAC77520',
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  prBadgeText: { color: '#FAC775', fontSize: 10, fontWeight: '700' },
})
