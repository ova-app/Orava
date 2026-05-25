import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native'
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, spring } from '@/constants/theme'
import { toggleRecipe } from '@/constants/recipes'

// ─── ToggleRow (inline) ──────────────────────────────────────────────────────
// Custom toggle wired via toggleRecipe + Reanimated spring (snappy).
// Track 52×32, thumb 26, translate 20px (52 - 26 - 2×3 padding).

interface ToggleRowProps {
  label: string
  subtitle?: string
  value: boolean
  onChange: (v: boolean) => void
  accessibilityLabel?: string
}

const THUMB_TRANSLATE = 20

function ToggleRow({
  label,
  subtitle,
  value,
  onChange,
  accessibilityLabel,
}: ToggleRowProps): React.JSX.Element {
  const { colors } = useTheme()
  const styles = toggleRecipe(value, colors)

  const progress = useSharedValue(value ? 1 : 0)

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, spring.snappy)
  }, [value, progress])

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRANSLATE }],
  }))

  // Override alignSelf — translateX seul positionne le thumb.
  const thumbBase = { ...styles.thumb, alignSelf: 'flex-start' as const }

  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={styles.row}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.track}>
        <Animated.View style={[thumbBase, thumbStyle]} />
      </View>
    </Pressable>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────

type WeightUnit = 'kg' | 'lbs'

interface SettingsState {
  weightUnit: WeightUnit
  vibrationEnabled: boolean
  defaultTimerSeconds: number
  publicWorkoutsByDefault: boolean
  ghostEnabled: boolean
}

const STORAGE_KEYS = {
  weightUnit: 'settings_weight_unit',
  vibration: 'settings_vibration',
  defaultTimer: 'settings_default_timer',
  publicWorkouts: 'settings_public_workouts',
  ghost: 'settings_ghost',
} as const

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  const [settings, setSettings] = useState<SettingsState>({
    weightUnit: 'kg',
    vibrationEnabled: true,
    defaultTimerSeconds: 90,
    publicWorkoutsByDefault: false,
    ghostEnabled: true,
  })

  // ─── Persistance load ─────────────────────────────────────────────────────

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      try {
        const [unit, vibration, timer, publicWorkouts, ghost] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.weightUnit),
          AsyncStorage.getItem(STORAGE_KEYS.vibration),
          AsyncStorage.getItem(STORAGE_KEYS.defaultTimer),
          AsyncStorage.getItem(STORAGE_KEYS.publicWorkouts),
          AsyncStorage.getItem(STORAGE_KEYS.ghost),
        ])

        setSettings(prev => ({
          ...prev,
          weightUnit: (unit === 'lbs' ? 'lbs' : 'kg') as WeightUnit,
          vibrationEnabled: vibration !== 'false',
          defaultTimerSeconds: timer ? parseInt(timer, 10) : 90,
          publicWorkoutsByDefault: publicWorkouts === 'true',
          ghostEnabled: ghost !== 'false',
        }))
      } catch {
        // Silent fail — valeurs par défaut conservées
      }
    }

    void loadSettings()
  }, [])

  // ─── Persistance save ─────────────────────────────────────────────────────

  async function setWeightUnit(unit: WeightUnit): Promise<void> {
    setSettings(prev => ({ ...prev, weightUnit: unit }))
    await AsyncStorage.setItem(STORAGE_KEYS.weightUnit, unit)
  }

  async function setVibration(enabled: boolean): Promise<void> {
    setSettings(prev => ({ ...prev, vibrationEnabled: enabled }))
    await AsyncStorage.setItem(STORAGE_KEYS.vibration, String(enabled))
  }

  async function setPublicWorkouts(enabled: boolean): Promise<void> {
    setSettings(prev => ({ ...prev, publicWorkoutsByDefault: enabled }))
    await AsyncStorage.setItem(STORAGE_KEYS.publicWorkouts, String(enabled))
  }

  async function setGhostEnabled(enabled: boolean): Promise<void> {
    setSettings(prev => ({ ...prev, ghostEnabled: enabled }))
    await AsyncStorage.setItem(STORAGE_KEYS.ghost, String(enabled))
  }

  const s = buildStyles(colors)

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={24} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Text style={s.headerTitle}>Réglages</Text>
        <View style={s.headerRight} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* GROUPE UNITÉS */}
        <Text style={s.groupLabel}>UNITÉS</Text>
        <View style={s.group}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Unité de poids</Text>
            <View style={s.segmented}>
              <Pressable
                style={[s.segBtn, settings.weightUnit === 'kg' && s.segBtnActive]}
                onPress={() => setWeightUnit('kg')}
                accessibilityRole="button"
                accessibilityLabel="Kilogrammes"
                accessibilityState={{ selected: settings.weightUnit === 'kg' }}
              >
                <Text style={[s.segLabel, settings.weightUnit === 'kg' && s.segLabelActive]}>
                  kg
                </Text>
              </Pressable>
              <Pressable
                style={[s.segBtn, settings.weightUnit === 'lbs' && s.segBtnActive]}
                onPress={() => setWeightUnit('lbs')}
                accessibilityRole="button"
                accessibilityLabel="Livres"
                accessibilityState={{ selected: settings.weightUnit === 'lbs' }}
              >
                <Text style={[s.segLabel, settings.weightUnit === 'lbs' && s.segLabelActive]}>
                  lbs
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* GROUPE SÉANCE */}
        <Text style={s.groupLabel}>SÉANCE</Text>
        <View style={s.group}>
          {/* Timer par défaut */}
          <Pressable
            style={[s.row, s.rowPressable]}
            onPress={() => {
              // Navigation vers un picker timer — Phase 1
            }}
            accessibilityRole="button"
            accessibilityLabel={`Timer par défaut : ${settings.defaultTimerSeconds}s`}
          >
            <Text style={s.rowLabel}>Timer par défaut</Text>
            <View style={s.rowRight}>
              <Text style={s.rowValue}>{settings.defaultTimerSeconds}s</Text>
              <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
            </View>
          </Pressable>

          <View style={s.separator} />

          {/* Vibrations */}
          <ToggleRow
            label="Vibrations"
            value={settings.vibrationEnabled}
            onChange={setVibration}
            accessibilityLabel="Activer les vibrations"
          />

          <View style={s.separator} />

          {/* Mode Fantôme */}
          <ToggleRow
            label="Mode Fantôme"
            subtitle="Affiche ta meilleure perf passée sur chaque exercice."
            value={settings.ghostEnabled}
            onChange={setGhostEnabled}
            accessibilityLabel="Activer le Mode Fantôme"
          />
        </View>

        {/* GROUPE CONFIDENTIALITÉ */}
        <Text style={s.groupLabel}>CONFIDENTIALITÉ</Text>
        <View style={s.group}>
          <ToggleRow
            label="Séances publiques par défaut"
            subtitle="Chaque séance démarre privée."
            value={settings.publicWorkoutsByDefault}
            onChange={setPublicWorkouts}
            accessibilityLabel="Séances publiques par défaut"
          />
        </View>

        {/* GROUPE COMPTE */}
        <Text style={s.groupLabel}>COMPTE</Text>
        <View style={s.group}>
          {/* Modifier le profil */}
          <Pressable
            style={[s.row, s.rowPressable]}
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel="Modifier le profil"
          >
            <Text style={s.rowLabel}>Modifier le profil</Text>
            <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
          </Pressable>

          <View style={s.separator} />

          {/* Plan Pro */}
          <View style={s.row}>
            <Text style={s.rowLabel}>Plan Pro</Text>
            <View style={s.badge}>
              <Text style={s.badgeLabel}>ACTIF</Text>
            </View>
          </View>
        </View>

        <View style={s.bottomPad} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.s4,
      paddingTop: spacing.s12,
      paddingBottom: spacing.s4,
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      ...typography.subtitle,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerRight: {
      width: 44,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.s4,
      paddingTop: spacing.s2,
    },
    groupLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: spacing.s2,
      marginTop: spacing.s6,
      paddingHorizontal: spacing.s1,
    },
    group: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 52,
      paddingHorizontal: spacing.s4,
    },
    rowPressable: {
      // Pressable styles inherited via Pressable wrapper
    },
    rowLabel: {
      ...typography.body,
      color: colors.textPrimary,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s2,
    },
    rowValue: {
      ...typography.body,
      color: colors.accent,
    },
    separator: {
      height: 1,
      backgroundColor: colors.separator,
      marginHorizontal: spacing.s4,
    },
    // Segmented control
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundTertiary,
      borderRadius: radius.sm,
      height: 32,
      width: 100,
      overflow: 'hidden',
    },
    segBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segBtnActive: {
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
    },
    segLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      letterSpacing: 0.4,
    },
    segLabelActive: {
      color: colors.background,
      fontFamily: 'Barlow_700Bold',
    },
    // Badge
    badge: {
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      paddingHorizontal: spacing.s3,
      paddingVertical: 4,
    },
    badgeLabel: {
      ...typography.caption,
      color: colors.background,
      fontFamily: 'Barlow_700Bold',
      letterSpacing: 0.8,
    },
    bottomPad: {
      height: spacing.s12,
    },
  })
}
