import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Zap, Flame, Trophy, Timer, Dumbbell, Trash2 } from 'lucide-react-native'
type PrLevel = 'gold' | 'silver' | 'bronze' | null
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetDetail {
  set_number: number
  weight_kg: number
  reps: number
  is_pr: boolean
  pr_charge: PrLevel
  pr_serie: PrLevel
  logged_at: string | null
  rest_seconds: number | null
}

interface ExerciseDetail {
  name: string
  equipment: string | null
  order_index: number
  sets: SetDetail[]
  pr_exercice: PrLevel
  avg_rest_sec: number | null
}

interface MuscleShare {
  group: string
  pct: number
}

interface PrEntry {
  exerciseName: string
  type: 'charge' | 'serie' | 'exercice' | 'seance'
  level: NonNullable<PrLevel>
}

interface WorkoutDetail {
  id: string
  title: string
  started_at: string
  duration_sec: number
  exercises: ExerciseDetail[]
  total_volume: number
  total_sets: number
  pr_count: number
  photo_url: string | null
  muscle_breakdown: MuscleShare[]
  pr_seance: PrLevel
  avg_rest_sec: number | null
  pr_entries: PrEntry[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EQUIPMENT_LABELS: Record<string, string> = {
  barre: 'Barre', halteres: 'Haltères', poulie: 'Poulie',
  machine: 'Machine', poids_corps: 'Poids du corps',
  smith: 'Smith', kettlebell: 'Kettlebell',
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

function formatRest(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

function computeAvgRest(sets: SetDetail[]): number | null {
  const vals = sets.map(s => s.rest_seconds ?? 0).filter(r => r > 0 && r < 3600)
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

const PR_LEVEL_COLORS: Record<NonNullable<PrLevel>, string> = {
  gold: '#FAC775', silver: '#C0C0C0', bronze: '#CD7F32',
}

const LEVEL_RANK: Record<string, number> = { gold: 3, silver: 2, bronze: 1 }
function bestLevel(sets: SetDetail[], field: 'pr_charge' | 'pr_serie'): PrLevel {
  let best: PrLevel = null
  for (const s of sets) {
    if (s[field] && (!best || LEVEL_RANK[s[field]!] > LEVEL_RANK[best])) best = s[field]
  }
  return best
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { if (id) fetchWorkout(id) }, [id])

  function handleDelete() {
    Alert.alert(
      'Supprimer la séance',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              const { data: weData } = await supabase
                .from('workout_exercises')
                .select('id')
                .eq('workout_id', id!)
              if (weData && weData.length > 0) {
                const weIds = (weData as any[]).map(we => we.id)
                await supabase.from('workout_sets').delete().in('workout_exercise_id', weIds)
              }
              await supabase.from('workout_exercises').delete().eq('workout_id', id!)
              await supabase.from('likes').delete().eq('workout_id', id!)
              await supabase.from('comments').delete().eq('workout_id', id!)
              await supabase.from('workouts').delete().eq('id', id!)
              router.back()
            } catch {
              setDeleting(false)
              Alert.alert('Erreur', 'Impossible de supprimer la séance.')
            }
          },
        },
      ]
    )
  }

  async function fetchWorkout(workoutId: string) {
    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id, title, started_at, duration_sec, photo_url, pr_seance,
        workout_exercises (
          id, order_index, exercise_id, pr_exercice,
          workout_sets ( set_number, weight_kg, reps, is_pr, pr_charge, pr_serie, logged_at, rest_seconds )
        )
      `)
      .eq('id', workoutId)
      .single()

    setLoading(false)
    if (error || !data) return

    const weRows = (data.workout_exercises ?? []) as any[]
    const exerciseIds = [...new Set(weRows.map(we => we.exercise_id).filter(Boolean))]
    let exMap: Record<string, { name_fr: string; equipment_type: string | null }> = {}

    if (exerciseIds.length > 0) {
      const { data: exData } = await supabase
        .from('exercises')
        .select('id, name_fr, equipment_type')
        .in('id', exerciseIds)
      if (exData) {
        for (const ex of exData as any[]) exMap[ex.id] = ex
      }
    }

    const exercises: ExerciseDetail[] = weRows
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map(we => {
        const sets: SetDetail[] = ((we.workout_sets ?? []) as any[])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({
            set_number: s.set_number,
            weight_kg: s.weight_kg ?? 0,
            reps: s.reps ?? 0,
            is_pr: s.is_pr ?? false,
            pr_charge: (s.pr_charge ?? null) as PrLevel,
            pr_serie: (s.pr_serie ?? null) as PrLevel,
            logged_at: s.logged_at ?? null,
            rest_seconds: s.rest_seconds ?? null,
          }))
        return {
          name: exMap[we.exercise_id]?.name_fr ?? 'Exercice',
          equipment: exMap[we.exercise_id]?.equipment_type ?? null,
          order_index: we.order_index,
          sets,
          pr_exercice: (we.pr_exercice ?? null) as PrLevel,
          avg_rest_sec: computeAvgRest(sets),
        }
      })

    const allSets = exercises.flatMap(e => e.sets)

    const sessionAvgRest = computeAvgRest(allSets)

    // Build PR entries list
    const pr_entries: PrEntry[] = []
    const prSeance = (data.pr_seance ?? null) as PrLevel
    if (prSeance) pr_entries.push({ exerciseName: 'Séance', type: 'seance', level: prSeance })
    for (const ex of exercises) {
      if (ex.pr_exercice) pr_entries.push({ exerciseName: ex.name, type: 'exercice', level: ex.pr_exercice })
      const chargeBest = bestLevel(ex.sets, 'pr_charge')
      if (chargeBest) pr_entries.push({ exerciseName: ex.name, type: 'charge', level: chargeBest })
      const serieBest = bestLevel(ex.sets, 'pr_serie')
      if (serieBest) pr_entries.push({ exerciseName: ex.name, type: 'serie', level: serieBest })
    }

    // Step 3: muscle breakdown
    let muscle_breakdown: MuscleShare[] = []
    if (exerciseIds.length > 0) {
      const { data: muscleData } = await supabase
        .from('exercise_muscles')
        .select('exercise_id, role, muscles(muscle_group)')
        .in('exercise_id', exerciseIds)

      if (muscleData) {
        const score: Record<string, number> = {}
        for (const em of muscleData as any[]) {
          const group: string = (em.muscles as any)?.muscle_group ?? 'Autre'
          score[group] = (score[group] ?? 0) + (em.role === 'primary' ? 2 : 1)
        }
        const total = Object.values(score).reduce((a, b) => a + b, 0)
        if (total > 0) {
          muscle_breakdown = Object.entries(score)
            .map(([group, s]) => ({ group, pct: Math.round(s / total * 100) }))
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 6)
        }
      }
    }

    setWorkout({
      id: data.id,
      title: data.title ?? 'Séance',
      started_at: data.started_at,
      duration_sec: data.duration_sec ?? 0,
      exercises,
      total_volume: allSets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0),
      total_sets: allSets.length,
      pr_count: allSets.filter(s => s.is_pr).length,
      photo_url: (data as any).photo_url ?? null,
      muscle_breakdown,
      pr_seance: prSeance,
      avg_rest_sec: sessionAvgRest,
      pr_entries,
    })
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!workout) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Séance introuvable</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.accent }]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {workout.title}
          </Text>
          <Text style={[styles.headerDate, { color: colors.textSecondary }]}>
            {formatDate(workout.started_at)} · {formatTime(workout.started_at)}
          </Text>
        </View>
        <TouchableOpacity onPress={handleDelete} disabled={deleting} style={styles.trashBtn}>
          {deleting
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Trash2 size={20} color={colors.textSecondary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        {workout.photo_url && (
          <Image
            source={{ uri: workout.photo_url }}
            style={styles.workoutPhoto}
            resizeMode="cover"
          />
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Durée" value={formatDuration(workout.duration_sec)} colors={colors} />
          <StatBox label="Séries" value={String(workout.total_sets)} colors={colors} />
          <StatBox
            label="Volume"
            value={workout.total_volume >= 1000
              ? `${(workout.total_volume / 1000).toFixed(1)}t`
              : `${workout.total_volume.toLocaleString('fr')} kg`}
            colors={colors}
          />
          {workout.avg_rest_sec !== null && (
            <StatBox label="Repos moy." value={formatRest(workout.avg_rest_sec)} colors={colors} />
          )}
        </View>
        {workout.pr_count > 0 && (
          <View style={styles.prCountRow}>
            <StatBox label="PRs" value={String(workout.pr_count)} colors={colors} highlight />
          </View>
        )}

        {/* PRs de la séance */}
        {workout.pr_entries.length > 0 && (
          <View style={[prStyles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>PRs de la séance</Text>
            {workout.pr_entries.map((entry, i) => (
              <PrEntryRow key={i} entry={entry} colors={colors} />
            ))}
          </View>
        )}

        {/* Muscles travaillés */}
        {workout.muscle_breakdown.length > 0 && (
          <View style={[mbStyles.card, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Muscles travaillés</Text>
            {workout.muscle_breakdown.map(({ group, pct }) => (
              <View key={group} style={mbStyles.row}>
                <Text style={[mbStyles.name, { color: colors.textPrimary }]}>{group}</Text>
                <View style={[mbStyles.barBg, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={[mbStyles.barFill, { width: `${pct}%` as any, backgroundColor: colors.accent }]} />
                </View>
                <Text style={[mbStyles.pct, { color: colors.textSecondary }]}>{pct}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercices */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Exercices</Text>
        {workout.exercises.map((ex, idx) => (
          <View key={idx} style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <View style={styles.exerciseHeader}>
              <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name}</Text>
              <View style={styles.exerciseMeta}>
                {ex.equipment && (
                  <Text style={[styles.exerciseEquip, { color: colors.textSecondary }]}>
                    {EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}
                  </Text>
                )}
                {ex.avg_rest_sec !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Timer size={11} color={colors.textSecondary} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>{formatRest(ex.avg_rest_sec)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.setHeaderRow, { borderBottomColor: colors.separator }]}>
              <Text style={[styles.setCol, styles.setColLabel, { color: colors.textSecondary }]}>Série</Text>
              <Text style={[styles.setCol, styles.setColLabel, { color: colors.textSecondary }]}>Poids</Text>
              <Text style={[styles.setCol, styles.setColLabel, { color: colors.textSecondary }]}>Reps</Text>
              <View style={{ width: 60 }} />
            </View>

            {ex.sets.map((set, sIdx) => (
              <View key={sIdx} style={styles.setRow}>
                <Text style={[styles.setCol, { color: colors.textPrimary }]}>{set.set_number}</Text>
                <Text style={[styles.setCol, { color: colors.textPrimary }]}>
                  {set.weight_kg % 1 === 0 ? set.weight_kg : set.weight_kg.toFixed(1)} kg
                </Text>
                <Text style={[styles.setCol, { color: colors.textPrimary }]}>{set.reps}</Text>
                <PRBadges set={set} colors={colors} />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

// ─── PrEntryRow ───────────────────────────────────────────────────────────────

const PR_TYPE_CONFIG = {
  charge:   { Icon: Zap,    color: (l: NonNullable<PrLevel>) => PR_LEVEL_COLORS[l], label: 'Charge' },
  serie:    { Icon: Flame,  color: (_l: NonNullable<PrLevel>) => '#D85A30',          label: 'Série' },
  exercice: { Icon: Dumbbell, color: (_l: NonNullable<PrLevel>) => '#9B59B6',        label: 'Exercice' },
  seance:   { Icon: Trophy, color: (l: NonNullable<PrLevel>) => PR_LEVEL_COLORS[l], label: 'Séance' },
} as const

function PrEntryRow({ entry, colors }: {
  entry: PrEntry
  colors: ReturnType<typeof useTheme>['colors']
}) {
  const cfg = PR_TYPE_CONFIG[entry.type]
  const iconColor = cfg.color(entry.level)
  const levelLabel = entry.level === 'gold' ? 'Or' : entry.level === 'silver' ? 'Argent' : 'Bronze'

  return (
    <View style={[prStyles.row, { borderBottomColor: colors.separator }]}>
      <View style={[prStyles.iconWrap, { backgroundColor: iconColor + '20' }]}>
        <cfg.Icon size={14} color={iconColor} fill={iconColor} />
      </View>
      <View style={prStyles.rowText}>
        <Text style={[prStyles.exName, { color: colors.textPrimary }]}>{entry.exerciseName}</Text>
        <Text style={[prStyles.typLabel, { color: colors.textSecondary }]}>{cfg.label}</Text>
      </View>
      <View style={[prStyles.levelBadge, { backgroundColor: iconColor + '20', borderColor: iconColor + '50' }]}>
        <Text style={[prStyles.levelText, { color: iconColor }]}>{levelLabel}</Text>
      </View>
    </View>
  )
}

// ─── PRBadges ────────────────────────────────────────────────────────────────

function PRBadges({ set }: { set: SetDetail; colors?: ReturnType<typeof useTheme>['colors'] }) {
  if (!set.pr_charge && !set.pr_serie) return <View style={{ width: 60 }} />
  return (
    <View style={styles.prIcons}>
      {set.pr_charge && (
        <View style={[styles.prBadge, { backgroundColor: PR_LEVEL_COLORS[set.pr_charge] + '25', borderColor: PR_LEVEL_COLORS[set.pr_charge] + '60' }]}>
          <Zap size={10} color={PR_LEVEL_COLORS[set.pr_charge]} fill={PR_LEVEL_COLORS[set.pr_charge]} />
        </View>
      )}
      {set.pr_serie && (
        <View style={[styles.prBadge, { backgroundColor: PR_LEVEL_COLORS[set.pr_serie] + '25', borderColor: PR_LEVEL_COLORS[set.pr_serie] + '60' }]}>
          <Flame size={10} color={PR_LEVEL_COLORS[set.pr_serie]} fill={PR_LEVEL_COLORS[set.pr_serie]} />
        </View>
      )}
    </View>
  )
}

// ─── StatBox ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, colors, highlight = false }: {
  label: string; value: string; highlight?: boolean
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View style={[
      statStyles.box,
      { backgroundColor: colors.card, borderColor: colors.separator },
      highlight && { backgroundColor: colors.prAmber + '15', borderColor: colors.prAmber + '40' },
    ]}>
      <Text style={[statStyles.value, { color: highlight ? colors.prAmber : colors.textPrimary }]}>
        {value}
      </Text>
      <Text style={[statStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const prStyles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  exName: { fontSize: 13, fontWeight: '600' },
  typLabel: { fontSize: 11 },
  levelBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  levelText: { fontSize: 11, fontWeight: '700' },
})

const mbStyles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 13, fontWeight: '500', width: 96 },
  barBg: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
  pct: { fontSize: 12, width: 34, textAlign: 'right' },
})

const statStyles = StyleSheet.create({
  box: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  value: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 10 },
})

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 15 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 58, paddingHorizontal: 16, paddingBottom: 14,
    gap: 8, borderBottomWidth: 1,
  },
  backBtn: { paddingTop: 2 },
  backText: { fontSize: 28, fontWeight: '300', lineHeight: 28 },
  trashBtn: { padding: 4, marginTop: 2 },
  headerMeta: { flex: 1, gap: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerDate: { fontSize: 12 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60, gap: 4 },
  workoutPhoto: { width: '100%', height: 220, borderRadius: 14, marginBottom: 8 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  prCountRow: { flexDirection: 'row', marginBottom: 14 },

  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },

  exerciseCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, gap: 8 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  exerciseName: { fontSize: 15, fontWeight: '700', flex: 1 },
  exerciseMeta: { alignItems: 'flex-end', gap: 2 },
  exerciseEquip: { fontSize: 12 },
  exerciseRest: { fontSize: 11 },

  setHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 4, borderBottomWidth: 1,
  },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  setCol: { flex: 1, fontSize: 14 },
  setColLabel: { fontSize: 11, fontWeight: '500' },

  prIcons: { width: 60, flexDirection: 'row', gap: 3, justifyContent: 'flex-end' },
  prBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  prBadgeText: { fontSize: 10, fontWeight: '700' },
})
