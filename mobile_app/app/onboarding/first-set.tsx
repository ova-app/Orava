import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CheckCircle } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { useWorkout } from '@/context/WorkoutContext'
import { spacing, radius, typography } from '@/constants/theme'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExerciceDB {
  id: string
  name_fr: string
  muscle_group: string | null
  equipment_type: string | null
}

// ─── Dots progression ────────────────────────────────────────────────────────

function DotsProgression({ actif }: { actif: 0 | 1 }): React.JSX.Element {
  const { colors } = useTheme()
  return (
    <View style={dotsStyles.conteneur}>
      <View
        style={[
          dotsStyles.point,
          actif === 0 ? dotsStyles.pointActif : dotsStyles.pointInactif,
          { backgroundColor: actif === 0 ? colors.accent : colors.textTertiary },
        ]}
      />
      <View
        style={[
          dotsStyles.point,
          actif === 1 ? dotsStyles.pointActif : dotsStyles.pointInactif,
          { backgroundColor: actif === 1 ? colors.accent : colors.textTertiary },
        ]}
      />
    </View>
  )
}

const dotsStyles = StyleSheet.create({
  conteneur: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  point: { borderRadius: 9999 },
  pointActif: { width: 8, height: 8 },
  pointInactif: { width: 6, height: 6 },
})

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingFirstSetScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()
  const { startWorkout, addExercise } = useWorkout()
  const [exercise, setExercise] = useState<ExerciceDB | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const styles = buildStyles(colors)

  // Fetch "Développé Couché" (ou premier exo pectoraux si absent)
  useEffect(() => {
    async function fetchExercise(): Promise<void> {
      try {
        const { data } = await supabase
          .from('exercises')
          .select('id, name_fr, muscle_group, equipment_type')
          .or('name_fr.ilike.développé couché,name_en.ilike.bench press')
          .limit(1)
          .single()
        if (data) {
          setExercise(data as ExerciceDB)
          return
        }
        // Fallback : premier exercice pectoraux
        const { data: fallback } = await supabase
          .from('exercises')
          .select('id, name_fr, muscle_group, equipment_type')
          .eq('muscle_group', 'pectoraux')
          .limit(1)
          .single()
        if (fallback) setExercise(fallback as ExerciceDB)
      } catch {
        // Silent — card shows "Séance libre"
      } finally {
        setLoading(false)
      }
    }
    void fetchExercise()
  }, [])

  async function allerVersSession(): Promise<void> {
    if (starting) return
    setStarting(true)
    try {
      await AsyncStorage.setItem('onboarding_done', 'true')
      startWorkout()
      if (exercise) {
        await addExercise(
          exercise.id,
          exercise.name_fr,
          exercise.muscle_group,
          exercise.equipment_type
        )
      }
      router.replace('/workout/session')
    } catch {
      router.replace('/workout/session')
    }
  }

  return (
    <SafeAreaView style={styles.conteneur}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.titre}>Ta première série</Text>
        <Text style={styles.sousTitre}>
          Commence avec cet exercice. Tu peux en changer dans la séance.
        </Text>
      </View>

      {/* Card exercice */}
      <View style={styles.zoneCard}>
        {loading ? (
          <View style={[styles.cardExercice, styles.cardLoading]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : exercise ? (
          <View style={styles.cardExercice}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardNomExercice}>{exercise.name_fr}</Text>
              <Text style={styles.cardGroupeMusculaire}>
                {(exercise.muscle_group ?? '').toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardCheckmark}>
              <CheckCircle size={24} color={colors.accent} strokeWidth={2} />
            </View>
          </View>
        ) : (
          <View style={[styles.cardExercice, styles.cardLoading]}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Séance libre</Text>
          </View>
        )}
      </View>

      {/* Progression + CTA */}
      <View style={styles.zoneActions}>
        <DotsProgression actif={1} />

        <Pressable
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaAppuye,
            starting && styles.ctaAppuye,
          ]}
          onPress={() => void allerVersSession()}
          accessibilityRole="button"
          accessibilityLabel="Logger ma première série"
          disabled={starting}
        >
          <Text style={styles.ctaTexte}>LOGGER MA 1RE SÉRIE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    conteneur: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.s6,
    },
    header: {
      paddingTop: spacing.s12,
      paddingBottom: spacing.s8,
      gap: spacing.s2,
    },
    titre: {
      ...typography.title,
      color: colors.textPrimary,
    },
    sousTitre: {
      ...typography.body,
      color: colors.textSecondary,
    },
    zoneCard: {
      flex: 1,
    },
    cardExercice: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      padding: spacing.s4,
      gap: spacing.s4,
    },
    cardLoading: {
      justifyContent: 'center',
      minHeight: 72,
    },
    cardInfo: {
      flex: 1,
      gap: spacing.s1,
    },
    cardNomExercice: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    cardGroupeMusculaire: {
      ...typography.caption,
      color: colors.textSecondary,
      letterSpacing: 0.8,
    },
    cardCheckmark: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoneActions: {
      paddingBottom: spacing.s8,
      gap: spacing.s5,
    },
    cta: {
      height: 64,
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaAppuye: {
      opacity: 0.85,
    },
    ctaTexte: {
      ...typography.body,
      fontFamily: 'Barlow_700Bold',
      color: colors.background,
      letterSpacing: 1,
    },
  })
}
