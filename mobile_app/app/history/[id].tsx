import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography } from '@/constants/theme'

// ─── Types ───────────────────────────────────────────────────────────────────

type PrLevel = 'gold' | 'silver' | 'bronze' | null

interface WorkoutDetail {
  id: string
  title: string | null
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  total_volume_kg: number | null
  note: string | null
  photo_url: string | null
  pr_seance: PrLevel
  avg_rest_seconds: number | null
}

interface SetRow {
  id: string
  set_number: number
  set_type: string
  reps: number | null
  weight_kg: number | null
  pr_charge: PrLevel
  pr_serie: PrLevel
}

interface ExerciseWithSets {
  workoutExerciseId: string
  exerciseId: string
  nameFr: string
  orderIndex: number
  pr_exercice: PrLevel
  sets: SetRow[]
}

interface MuscleBar {
  muscleLabel: string
  primaryPct: number
  secondaryPct: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}min`
}

function totalSets(exercises: ExerciseWithSets[]): number {
  return exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
}

function prColors(colors: ReturnType<typeof useTheme>['colors']): Record<NonNullable<PrLevel>, string> {
  return { gold: colors.prGold, silver: colors.prSilver, bronze: colors.prBronze }
}

const MUSCLE_LABEL_MAP: Record<string, string> = {
  grand_pectoral: 'Pectoraux',
  deltoide: 'Épaules',
  grand_dorsal: 'Grand dorsal',
  trapeze: 'Trapèze',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quadriceps',
  ischio_jambiers: 'Ischio-jambiers',
  fessier_maximus: 'Fessiers',
  fessier_median: 'Fessiers',
  fessier_minimus: 'Fessiers',
  mollets: 'Mollets',
  abdominaux: 'Core',
  grand_rond: 'Grand rond',
  rhomboide: 'Rhomboïdes',
  erecteurs_rachis: 'Érecteurs rachis',
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HistoryDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()
  const router = useRouter()

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([])
  const [muscleBars, setMuscleBars] = useState<MuscleBar[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const fetchWorkout = useCallback(async (): Promise<void> => {
    if (!id) return

    // Workout
    const { data: wData } = await supabase
      .from('workouts')
      .select('id, title, started_at, ended_at, duration_sec, total_volume_kg, note, photo_url, pr_seance, avg_rest_seconds')
      .eq('id', id)
      .single()

    if (!wData) {
      setLoading(false)
      return
    }
    setWorkout(wData as WorkoutDetail)

    // Exercises + sets
    const { data: weData } = await supabase
      .from('workout_exercises')
      .select(`
        id, exercise_id, order_index, pr_exercice,
        exercises!inner(name_fr),
        workout_sets(id, set_number, set_type, reps, weight_kg, pr_charge, pr_serie)
      `)
      .eq('workout_id', id)
      .order('order_index')

    if (weData) {
      const exs: ExerciseWithSets[] = weData.map(we => ({
        workoutExerciseId: we.id as string,
        exerciseId: we.exercise_id as string,
        nameFr: (we.exercises as { name_fr: string }).name_fr,
        orderIndex: we.order_index as number,
        pr_exercice: (we.pr_exercice as PrLevel) ?? null,
        sets: ((we.workout_sets ?? []) as SetRow[]).sort((a, b) => a.set_number - b.set_number),
      }))
      setExercises(exs)

      // Muscle bars : agréger via exercise_muscles
      const exerciseIds = exs.map(e => e.exerciseId)
      const { data: emData } = await supabase
        .from('exercise_muscles')
        .select('exercise_id, muscle, role, activation_pct')
        .in('exercise_id', exerciseIds)
        .in('role', ['primary', 'secondary'])

      if (emData) {
        // Volume par muscle (weight_kg × reps × activation_pct)
        const primaryVol: Record<string, number> = {}
        const secondaryVol: Record<string, number> = {}

        for (const em of emData) {
          const ex = exs.find(e => e.exerciseId === em.exercise_id)
          if (!ex) continue
          const vol = ex.sets.reduce((sum, s) => {
            return sum + (s.weight_kg ?? 0) * (s.reps ?? 0) * ((em.activation_pct ?? 0) / 100)
          }, 0)

          const label = MUSCLE_LABEL_MAP[em.muscle as string] ?? (em.muscle as string)
          if (em.role === 'primary') {
            primaryVol[label] = (primaryVol[label] ?? 0) + vol
          } else {
            secondaryVol[label] = (secondaryVol[label] ?? 0) + vol
          }
        }

        // Normaliser vs max
        const allMuscles = new Set([...Object.keys(primaryVol), ...Object.keys(secondaryVol)])
        const maxVol = Math.max(
          ...Array.from(allMuscles).map(m => (primaryVol[m] ?? 0) + (secondaryVol[m] ?? 0)),
          1
        )

        const bars: MuscleBar[] = Array.from(allMuscles)
          .map(m => ({
            muscleLabel: m,
            primaryPct: Math.round(((primaryVol[m] ?? 0) / maxVol) * 100),
            secondaryPct: Math.round(((secondaryVol[m] ?? 0) / maxVol) * 100),
          }))
          .sort((a, b) => b.primaryPct + b.secondaryPct - (a.primaryPct + a.secondaryPct))
          .slice(0, 8)

        setMuscleBars(bars)
      }
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    void fetchWorkout()
  }, [fetchWorkout])

  const s = buildStyles(colors)
  const PC = prColors(colors)

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!workout) {
    return (
      <View style={s.loader}>
        <Text style={{ color: colors.textSecondary, ...typography.body }}>Séance introuvable.</Text>
      </View>
    )
  }

  const nSets = totalSets(exercises)

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={8}
          >
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>

          <Text style={s.headerDate} numberOfLines={1}>
            {formatDate(workout.started_at)}
          </Text>

          <View style={s.backBtn} />
        </View>

        {/* ── Photo / Banner ── */}
        <View style={s.banner}>
          {workout.photo_url ? (
            <Image
              source={{ uri: workout.photo_url }}
              style={s.bannerImage}
              accessibilityLabel="Photo de séance"
            />
          ) : (
            <View style={s.bannerPlaceholder}>
              <Text style={s.bannerPlaceholderText}>
                {workout.title ?? 'Séance sans titre'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Hero Stats ── */}
        <View style={s.statsRow}>
          <View style={s.statChip}>
            <Text style={[s.statChipValue, { color: colors.accent }]} accessibilityLabel={`${Math.round(workout.total_volume_kg ?? 0)} kilogrammes`}>
              {Math.round(workout.total_volume_kg ?? 0)}
            </Text>
            <Text style={s.statChipLabel}>KG</Text>
          </View>

          <View style={s.statChip}>
            <Text style={s.statChipValue}>{formatDuration(workout.duration_sec)}</Text>
            <Text style={s.statChipLabel}>DURÉE</Text>
          </View>

          <View style={s.statChip}>
            <Text style={s.statChipValue} accessibilityLabel={`${nSets} séries`}>{nSets}</Text>
            <Text style={s.statChipLabel}>SÉRIES</Text>
          </View>
        </View>

        {/* ── PR Badges ── */}
        {(workout.pr_seance != null) && (
          <View style={s.prBadgesRow}>
            {workout.pr_seance && (
              <View style={[s.prBadge, { backgroundColor: `${PC[workout.pr_seance]}1A` }]}>
                <Text style={[s.prBadgeText, { color: PC[workout.pr_seance] }]}>
                  🏆 PR SÉANCE {workout.pr_seance.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Muscles ── */}
        {muscleBars.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>MUSCLES TRAVAILLÉS</Text>

            {muscleBars.map((bar, idx) => (
              <View key={idx} style={s.muscleRow}>
                <Text style={s.muscleLabel} numberOfLines={1}>{bar.muscleLabel}</Text>

                <View style={s.muscleBarTrack}>
                  {bar.primaryPct > 0 && (
                    <View style={[s.muscleBarFill, s.muscleBarPrimary, { width: `${bar.primaryPct}%` }]} />
                  )}
                  {bar.secondaryPct > 0 && (
                    <View style={[s.muscleBarFill, s.muscleBarSecondary, { width: `${bar.secondaryPct}%` }]} />
                  )}
                </View>

                <Text style={s.musclePct} accessibilityLabel={`${bar.primaryPct + bar.secondaryPct} pourcent`}>
                  {bar.primaryPct + bar.secondaryPct}
                  <Text style={s.musclePctSymbol}>%</Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Exercices ── */}
        {exercises.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>EXERCICES</Text>

            {exercises.map(ex => (
              <View key={ex.workoutExerciseId} style={s.exCard}>
                {/* Nom + PR badge */}
                <View style={s.exHeader}>
                  <Text style={s.exName}>{ex.nameFr}</Text>
                  {ex.pr_exercice && (
                    <View style={[s.exPrBadge, { backgroundColor: `${PC[ex.pr_exercice]}1A` }]}>
                      <Text style={[s.exPrBadgeText, { color: PC[ex.pr_exercice] }]}>
                        {ex.pr_exercice.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Table sets */}
                {ex.sets.length > 0 && (
                  <View style={s.setsTable}>
                    {/* Entête */}
                    <View style={s.setRow}>
                      <Text style={[s.setCell, s.setCellHeader, s.setCellSet]}>SET</Text>
                      <Text style={[s.setCell, s.setCellHeader, s.setCellWeight]}>POIDS</Text>
                      <Text style={[s.setCell, s.setCellHeader, s.setCellReps]}>REPS</Text>
                    </View>

                    {ex.sets.map(set => {
                      const hasPr = set.pr_charge != null || set.pr_serie != null
                      const prColor = hasPr
                        ? PC[(set.pr_charge ?? set.pr_serie) as NonNullable<PrLevel>]
                        : null

                      return (
                        <View key={set.id} style={s.setRow}>
                          <Text style={[s.setCell, s.setCellSet, s.monoText, hasPr && prColor ? { color: prColor } : null]}>
                            {set.set_number}
                          </Text>
                          <Text style={[s.setCell, s.setCellWeight, s.monoText]}>
                            {set.weight_kg != null ? `${set.weight_kg} kg` : '—'}
                          </Text>
                          <Text style={[s.setCell, s.setCellReps, s.monoText]}>
                            {set.reps ?? '—'}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loader: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.s12,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.s12,
      paddingHorizontal: spacing.s4,
      paddingBottom: spacing.s4,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerDate: {
      ...typography.subtitle,
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },

    // Banner
    banner: {
      marginHorizontal: spacing.s4,
      marginBottom: spacing.s4,
      borderRadius: radius.lg,
      overflow: 'hidden',
      height: 200,
      backgroundColor: colors.backgroundSecondary,
    },
    bannerImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    bannerPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerPlaceholderText: {
      ...typography.subtitle,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.s4,
    },

    // Stats row
    statsRow: {
      flexDirection: 'row',
      gap: spacing.s3,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s4,
    },
    statChip: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      paddingVertical: spacing.s3,
      paddingHorizontal: spacing.s3,
      alignItems: 'center',
    },
    statChipValue: {
      fontSize: 24,
      fontFamily: 'Barlow_800ExtraBold',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    statChipLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: spacing.s1,
    },

    // PR Badges
    prBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.s2,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s4,
    },
    prBadge: {
      borderRadius: radius.full,
      paddingVertical: spacing.s1,
      paddingHorizontal: spacing.s3,
    },
    prBadgeText: {
      ...typography.caption,
      fontFamily: 'Barlow_700Bold',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    // Section
    section: {
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s8,
    },
    sectionTitle: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: spacing.s4,
    },

    // Muscles
    muscleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.s3,
      gap: spacing.s3,
    },
    muscleLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      width: 100,
    },
    muscleBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.full,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    muscleBarFill: {
      height: '100%',
      borderRadius: radius.full,
    },
    muscleBarPrimary: {
      backgroundColor: colors.accent,
    },
    muscleBarSecondary: {
      backgroundColor: colors.prGold,
    },
    musclePct: {
      ...typography.mono,
      fontVariant: ['tabular-nums'],
      color: colors.textSecondary,
      width: 40,
      textAlign: 'right',
    },
    musclePctSymbol: {
      fontSize: 10,
    },

    // Exercices
    exCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      padding: spacing.s4,
      marginBottom: spacing.s3,
    },
    exHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.s3,
    },
    exName: {
      ...typography.body,
      fontFamily: 'Barlow_700Bold',
      color: colors.textPrimary,
      flex: 1,
    },
    exPrBadge: {
      borderRadius: radius.full,
      paddingVertical: 2,
      paddingHorizontal: spacing.s2,
      marginLeft: spacing.s2,
    },
    exPrBadgeText: {
      ...typography.caption,
      fontFamily: 'Barlow_700Bold',
      letterSpacing: 0.8,
    },
    setsTable: {
      gap: spacing.s1,
    },
    setRow: {
      flexDirection: 'row',
    },
    setCell: {
      ...typography.mono,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
      paddingVertical: spacing.s1,
    },
    setCellHeader: {
      ...typography.caption,
      color: colors.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    setCellSet: {
      width: 40,
    },
    setCellWeight: {
      flex: 1,
    },
    setCellReps: {
      width: 60,
      textAlign: 'right',
    },
    monoText: {
      fontFamily: 'JetBrainsMono_500Medium',
      fontVariant: ['tabular-nums'],
    },
  })
}
