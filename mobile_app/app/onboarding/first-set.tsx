import React from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCircle } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography } from '@/constants/theme'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExercicePresentSelection {
  id: string
  nomFr: string
  groupeMusculaire: string
}

// ─── Constante exercice pré-sélectionné ──────────────────────────────────────

const EXERCICE_DEFAUT: ExercicePresentSelection = {
  id: 'developpe-couche',
  nomFr: 'Développé Couché',
  groupeMusculaire: 'Pectoraux',
}

// ─── Dots progression ────────────────────────────────────────────────────────

function DotsProgression({ actif }: { actif: 0 | 1 }): React.JSX.Element {
  const { colors } = useTheme()
  return (
    <View style={dotsStyles.conteneur}>
      <View
        style={[
          dotsStyles.point,
          {
            width: actif === 0 ? 8 : 6,
            height: actif === 0 ? 8 : 6,
            backgroundColor: actif === 0 ? colors.accent : colors.textTertiary,
          },
        ]}
      />
      <View
        style={[
          dotsStyles.point,
          {
            width: actif === 1 ? 8 : 6,
            height: actif === 1 ? 8 : 6,
            backgroundColor: actif === 1 ? colors.accent : colors.textTertiary,
          },
        ]}
      />
    </View>
  )
}

const dotsStyles = StyleSheet.create({
  conteneur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  point: {
    borderRadius: 9999,
  },
})

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingFirstSetScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()
  const styles = buildStyles(colors)

  function allerVersSession(): void {
    router.replace('/(tabs)/feed')
  }

  return (
    <SafeAreaView style={styles.conteneur}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.titre}>Ta première série</Text>
        <Text style={styles.sousTitre}>
          Sélectionne un exercice pour commencer.
        </Text>
      </View>

      {/* Card exercice pré-sélectionné */}
      <View style={styles.zoneCard}>
        <View style={styles.cardExercice}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardNomExercice}>
              {EXERCICE_DEFAUT.nomFr}
            </Text>
            <Text style={styles.cardGroupeMusculaire}>
              {EXERCICE_DEFAUT.groupeMusculaire}
            </Text>
          </View>
          <View style={styles.cardCheckmark}>
            <CheckCircle
              size={24}
              color={colors.accent}
              strokeWidth={2}
            />
          </View>
        </View>
      </View>

      {/* Progression + Actions */}
      <View style={styles.zoneActions}>
        <DotsProgression actif={1} />

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaAppuye]}
          onPress={allerVersSession}
          accessibilityRole="button"
          accessibilityLabel="Logger ma première série"
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
      textTransform: 'uppercase',
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
