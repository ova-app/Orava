/**
 * ORAVA — Session 07
 * app/(tabs)/history.tsx
 * Historique des séances de l'utilisateur
 */

import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkoutSummary {
  id: string
  title: string
  started_at: string
  duration_seconds: number
  exercise_count: number
  total_sets: number
  total_volume: number
  pr_count: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min`
  return `${s}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function computeStats(raw: any): WorkoutSummary {
  const exercises = raw.workout_exercises ?? []
  const allSets = exercises.flatMap((we: any) => we.workout_sets ?? [])

  return {
    id: raw.id,
    title: raw.title ?? 'Séance',
    started_at: raw.started_at,
    duration_seconds: raw.duration_seconds ?? 0,
    exercise_count: exercises.length,
    total_sets: allSets.length,
    total_volume: allSets.reduce((sum: number, s: any) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
    pr_count: allSets.filter((s: any) => s.is_pr).length,
  }
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Recharge quand on revient sur l'écran (après avoir sauvegardé une séance)
  useFocusEffect(useCallback(() => { fetchHistory() }, []))

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id, title, started_at, duration_seconds,
        workout_exercises (
          id,
          workout_sets ( weight_kg, reps, is_pr )
        )
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(100)

    setLoading(false)
    setRefreshing(false)

    if (error || !data) return
    setWorkouts(data.map(computeStats))
  }

  function handleRefresh() {
    setRefreshing(true)
    fetchHistory()
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D85A30" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
        {workouts.length > 0 && (
          <Text style={styles.count}>{workouts.length} séance{workouts.length > 1 ? 's' : ''}</Text>
        )}
      </View>

      {workouts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Aucune séance</Text>
          <Text style={styles.emptySubtitle}>
            Lance une séance via le bouton + pour commencer à construire ton historique.
          </Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <WorkoutCard workout={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#D85A30"
            />
          }
        />
      )}
    </View>
  )
}

// ─── WorkoutCard ─────────────────────────────────────────────────────────────

function WorkoutCard({ workout }: { workout: WorkoutSummary }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/history/${workout.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle} numberOfLines={1}>{workout.title}</Text>
          <Text style={styles.cardDate}>{formatDate(workout.started_at)}</Text>
        </View>
        <Text style={styles.cardDuration}>{formatDuration(workout.duration_seconds)}</Text>
      </View>

      <View style={styles.cardStats}>
        <Stat label="Exercices" value={String(workout.exercise_count)} />
        <StatDivider />
        <Stat label="Séries" value={String(workout.total_sets)} />
        <StatDivider />
        <Stat
          label="Volume"
          value={workout.total_volume >= 1000
            ? `${(workout.total_volume / 1000).toFixed(1)}t`
            : `${workout.total_volume.toLocaleString('fr')} kg`
          }
        />
        {workout.pr_count > 0 && (
          <>
            <StatDivider />
            <Stat label="PRs" value={String(workout.pr_count)} highlight />
          </>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, highlight && styles.statValuePR]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function StatDivider() {
  return <View style={styles.statDivider} />
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  count: { color: '#555', fontSize: 13, marginBottom: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },

  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTop: { flex: 1, gap: 4 },
  cardLeft: { gap: 2 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardDate: { color: '#555', fontSize: 12 },
  cardDuration: { color: '#888', fontSize: 13, fontWeight: '500' },

  cardStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statValuePR: { color: '#FAC775' },
  statLabel: { color: '#555', fontSize: 10 },
  statDivider: { width: 1, height: 28, backgroundColor: '#1A1A1A' },

  chevron: { color: '#333', fontSize: 22 },
})
