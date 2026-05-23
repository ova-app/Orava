import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Zap, Flame } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography } from '@/constants/theme'

// ─── Types ───────────────────────────────────────────────────────────────────

type PrLevel = 'gold' | 'silver' | 'bronze' | null
type MuscleRole = 'primary' | 'secondary' | 'stabilizer'

interface Exercise {
  id: string
  name_fr: string
  equipment_type: string | null
  is_compound: boolean
  description_fr: string | null
  muscle_group: string | null
}

interface MuscleMapping {
  muscle: string
  fascicle: string | null
  role: MuscleRole
  activation_pct: number
}

interface RecordStats {
  maxCharge: number | null
  maxSerie: { weight: number; reps: number } | null
}

interface RecentSession {
  workoutId: string
  startedAt: string
  maxWeight: number | null
  totalVolume: number | null
  delta: number | null // vs session précédente
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  kettlebell: 'Kettlebell',
  resistance_band: 'Élastique',
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
  avant_bras: 'Avant-bras',
  brachial: 'Brachial',
  brachioradial: 'Brachioradial',
  adducteurs: 'Adducteurs',
  iliopsoas: 'Iliopsoas',
  infra_epineux: 'Infra-épineux',
  serratus_anterieur: 'Serratus ant.',
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExerciseDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { colors } = useTheme()
  const router = useRouter()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [muscles, setMuscles] = useState<MuscleMapping[]>([])
  const [records, setRecords] = useState<RecordStats>({ maxCharge: null, maxSerie: null })
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const fetchExercise = useCallback(async (): Promise<void> => {
    if (!id) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Exercise
    const { data: exData } = await supabase
      .from('exercises')
      .select('id, name_fr, equipment_type, is_compound, description_fr, muscle_group')
      .eq('id', id)
      .single()

    if (!exData) {
      setLoading(false)
      return
    }
    setExercise(exData as Exercise)

    // Muscles
    const { data: emData } = await supabase
      .from('exercise_muscles')
      .select('muscle, fascicle, role, activation_pct')
      .eq('exercise_id', id)
      .order('activation_pct', { ascending: false })

    if (emData) {
      setMuscles(emData as MuscleMapping[])
    }

    // PR history — top sets par charge
    const { data: setsData } = await supabase
      .from('workout_sets')
      .select(`
        weight_kg, reps,
        workout_exercises!inner(
          workout_id,
          workouts!inner(user_id, started_at)
        )
      `)
      .eq('workout_exercises.exercise_id', id)
      .eq('workout_exercises.workouts.user_id', user.id)
      .not('weight_kg', 'is', null)
      .order('weight_kg', { ascending: false })
      .limit(50)

    if (setsData && setsData.length > 0) {
      const maxCharge = (setsData[0].weight_kg as number)
      const maxSerieRow = [...setsData].sort((a, b) =>
        ((b.weight_kg as number) * (b.reps as number)) - ((a.weight_kg as number) * (a.reps as number))
      )[0]

      setRecords({
        maxCharge,
        maxSerie: {
          weight: maxSerieRow.weight_kg as number,
          reps: maxSerieRow.reps as number,
        },
      })
    }

    // 3 dernières sessions
    const { data: weData } = await supabase
      .from('workout_exercises')
      .select(`
        workout_id,
        workouts!inner(started_at, user_id),
        workout_sets(weight_kg, reps)
      `)
      .eq('exercise_id', id)
      .eq('workouts.user_id', user.id)
      .order('workouts.started_at', { ascending: false })
      .limit(4)

    if (weData && weData.length > 0) {
      const sessions: RecentSession[] = weData.slice(0, 3).map((we, idx) => {
        const sets = (we.workout_sets ?? []) as Array<{ weight_kg: number | null; reps: number | null }>
        const maxW = Math.max(...sets.map(s => s.weight_kg ?? 0), 0)
        const vol = sets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)

        let delta: number | null = null
        if (idx < weData.length - 1) {
          const prevSets = (weData[idx + 1].workout_sets ?? []) as Array<{ weight_kg: number | null; reps: number | null }>
          const prevVol = prevSets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)
          delta = prevVol > 0 ? ((vol - prevVol) / prevVol) * 100 : null
        }

        return {
          workoutId: we.workout_id as string,
          startedAt: (we.workouts as { started_at: string }).started_at,
          maxWeight: maxW > 0 ? maxW : null,
          totalVolume: vol > 0 ? vol : null,
          delta,
        }
      })
      setRecentSessions(sessions)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    void fetchExercise()
  }, [fetchExercise])

  const s = buildStyles(colors)

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!exercise) {
    return (
      <View style={s.loader}>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>Exercice introuvable.</Text>
      </View>
    )
  }

  const primaryMuscles = muscles.filter(m => m.role === 'primary')
  const secondaryMuscles = muscles.filter(m => m.role === 'secondary')
  const stabilizerMuscles = muscles.filter(m => m.role === 'stabilizer')

  const equipLabel = exercise.equipment_type
    ? (EQUIPMENT_LABELS[exercise.equipment_type] ?? exercise.equipment_type)
    : null

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

          <Text style={s.headerTitle} numberOfLines={1}>{exercise.name_fr}</Text>

          <View style={s.backBtn} />
        </View>

        {/* ── Illustration placeholder ── */}
        <View style={s.illustration}>
          <Text style={s.illustrationText}>{exercise.muscle_group ?? '—'}</Text>
        </View>

        {/* ── Metadata chips ── */}
        <View style={s.chipsRow}>
          {equipLabel && (
            <View style={s.chip}>
              <Text style={s.chipText}>{equipLabel}</Text>
            </View>
          )}
          <View style={s.chip}>
            <Text style={s.chipText}>{exercise.is_compound ? 'Polyarticulaire' : 'Isolation'}</Text>
          </View>
        </View>

        {/* ── Muscles ── */}
        {muscles.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>MUSCLES</Text>

            {primaryMuscles.length > 0 && (
              <View style={s.muscleGroup}>
                <Text style={s.muscleGroupLabel}>PRIMARY</Text>
                {primaryMuscles.map((m, idx) => (
                  <View key={idx} style={s.muscleRow}>
                    <View style={[s.muscleDot, { backgroundColor: colors.accent }]} />
                    <Text style={[s.muscleName, { color: colors.textPrimary }]}>
                      {MUSCLE_LABEL_MAP[m.muscle] ?? m.muscle}
                    </Text>
                    <Text style={[s.musclePct, { color: colors.accent }]} accessibilityLabel={`${m.activation_pct} pourcent`}>
                      {m.activation_pct}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {secondaryMuscles.length > 0 && (
              <View style={s.muscleGroup}>
                <Text style={s.muscleGroupLabel}>SECONDARY</Text>
                {secondaryMuscles.map((m, idx) => (
                  <View key={idx} style={s.muscleRow}>
                    <View style={[s.muscleDot, { backgroundColor: colors.prGold }]} />
                    <Text style={[s.muscleName, { color: colors.textSecondary }]}>
                      {MUSCLE_LABEL_MAP[m.muscle] ?? m.muscle}
                    </Text>
                    <Text style={[s.musclePct, { color: colors.prGold }]} accessibilityLabel={`${m.activation_pct} pourcent`}>
                      {m.activation_pct}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {stabilizerMuscles.length > 0 && (
              <View style={s.muscleGroup}>
                <Text style={s.muscleGroupLabel}>STABILIZER</Text>
                {stabilizerMuscles.map((m, idx) => (
                  <View key={idx} style={s.muscleRow}>
                    <View style={[s.muscleDot, { backgroundColor: colors.border }]} />
                    <Text style={[s.muscleName, { color: colors.textTertiary }]}>
                      {MUSCLE_LABEL_MAP[m.muscle] ?? m.muscle}
                    </Text>
                    <Text style={[s.musclePct, { color: colors.textTertiary }]} accessibilityLabel={`${m.activation_pct} pourcent`}>
                      {m.activation_pct}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Records ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MES RECORDS</Text>

          <View style={s.recordsRow}>
            {/* Charge max */}
            <View style={s.recordCard}>
              <View style={s.recordIconRow}>
                <Zap size={16} color={colors.prGold} />
                <Text style={[s.recordCardLabel, { color: colors.prGold }]}>CHARGE MAX</Text>
              </View>
              <Text style={s.recordValue} accessibilityLabel={records.maxCharge != null ? `${records.maxCharge} kilogrammes` : 'Aucun record'}>
                {records.maxCharge != null ? `${records.maxCharge}` : '—'}
              </Text>
              {records.maxCharge != null && (
                <Text style={s.recordUnit}>kg</Text>
              )}
            </View>

            {/* Meilleure série */}
            <View style={s.recordCard}>
              <View style={s.recordIconRow}>
                <Flame size={16} color={colors.accent} />
                <Text style={[s.recordCardLabel, { color: colors.accent }]}>MEILLEURE SÉRIE</Text>
              </View>
              <Text style={s.recordValue} accessibilityLabel={
                records.maxSerie != null
                  ? `${records.maxSerie.weight} kilogrammes ${records.maxSerie.reps} répétitions`
                  : 'Aucun record'
              }>
                {records.maxSerie != null ? `${records.maxSerie.weight}` : '—'}
              </Text>
              {records.maxSerie != null && (
                <Text style={s.recordUnit}>kg × {records.maxSerie.reps}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Historique ── */}
        {recentSessions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>HISTORIQUE</Text>

            {recentSessions.map((session, idx) => {
              const dateStr = new Date(session.startedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
              const hasDelta = session.delta != null
              const deltaPositive = (session.delta ?? 0) > 0
              const deltaColor = hasDelta
                ? (deltaPositive ? colors.success : colors.error)
                : colors.textTertiary

              return (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [s.historyRow, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push(`/history/${session.workoutId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Séance du ${dateStr}`}
                >
                  <Text style={s.historyDate}>{dateStr}</Text>

                  <View style={s.historyStats}>
                    {session.maxWeight != null && (
                      <Text style={s.historyWeight} accessibilityLabel={`${session.maxWeight} kilogrammes`}>
                        {session.maxWeight} kg
                      </Text>
                    )}
                    {session.totalVolume != null && (
                      <Text style={s.historyVolume} accessibilityLabel={`${Math.round(session.totalVolume)} kilogrammes volume`}>
                        {Math.round(session.totalVolume)} kg vol.
                      </Text>
                    )}
                  </View>

                  {hasDelta && (
                    <Text style={[s.historyDelta, { color: deltaColor }]} accessibilityLabel={`${deltaPositive ? '+' : ''}${Math.round(session.delta!)} pourcent`}>
                      {deltaPositive ? '+' : ''}{Math.round(session.delta!)}%
                    </Text>
                  )}
                </Pressable>
              )
            })}
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
    headerTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },

    // Illustration
    illustration: {
      marginHorizontal: spacing.s4,
      height: 200,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.s4,
    },
    illustrationText: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },

    // Chips
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.s2,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s6,
    },
    chip: {
      height: 28,
      paddingHorizontal: spacing.s3,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: {
      ...typography.caption,
      color: colors.textSecondary,
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
    muscleGroup: {
      marginBottom: spacing.s4,
    },
    muscleGroupLabel: {
      fontSize: 10,
      fontFamily: 'Barlow_700Bold',
      color: colors.textTertiary,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: spacing.s2,
    },
    muscleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.s2,
      gap: spacing.s3,
    },
    muscleDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    muscleName: {
      ...typography.body,
      flex: 1,
    },
    musclePct: {
      ...typography.mono,
      fontVariant: ['tabular-nums'],
      fontSize: 13,
    },

    // Records
    recordsRow: {
      flexDirection: 'row',
      gap: spacing.s3,
    },
    recordCard: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      padding: spacing.s4,
    },
    recordIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s1,
      marginBottom: spacing.s2,
    },
    recordCardLabel: {
      fontSize: 10,
      fontFamily: 'Barlow_700Bold',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    recordValue: {
      fontSize: 32,
      fontFamily: 'Barlow_800ExtraBold',
      color: colors.textPrimary,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    recordUnit: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.s1,
    },

    // History
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      minHeight: 52,
    },
    historyDate: {
      ...typography.body,
      color: colors.textSecondary,
      width: 72,
    },
    historyStats: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.s3,
    },
    historyWeight: {
      ...typography.mono,
      fontVariant: ['tabular-nums'],
      color: colors.textPrimary,
    },
    historyVolume: {
      ...typography.mono,
      fontVariant: ['tabular-nums'],
      color: colors.textSecondary,
      fontSize: 12,
    },
    historyDelta: {
      ...typography.mono,
      fontVariant: ['tabular-nums'],
      fontSize: 13,
      fontFamily: 'Barlow_700Bold',
    },
  })
}
