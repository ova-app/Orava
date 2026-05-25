import { StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { ThemeColors, spacing, radius, typography, touchTarget, font } from './theme'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type InputState = 'default' | 'active' | 'filled' | 'error'
export type PrLevel = 'gold' | 'silver' | 'bronze'
export type PrType = 'charge' | 'serie' | 'exercice' | 'seance'
export type CardElevation = 0 | 1 | 2
export type EmptyVariant = 'feed' | 'history' | 'library'

// ─── SHARED HELPERS (internal) ───────────────────────────────────────────────

const PR_ICON_COLORS = {
  charge:   (c: ThemeColors) => c.prGold,
  serie:    (c: ThemeColors) => c.prGold,
  exercice: (c: ThemeColors) => c.prExercice,
  seance:   (c: ThemeColors) => c.prGold,
} as const

const prLevelColor = (level: PrLevel, c: ThemeColors): string =>
  level === 'gold' ? c.prGold : level === 'silver' ? c.prSilver : c.prBronze

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Glassmorphism token (rules/ui.md — glassCard v2)
const GLASS_BG = 'rgba(18,18,26,0.75)'
const GLASS_BORDER = 'rgba(255,255,255,0.08)'
const BACKDROP_BASE = 'rgba(0,0,0,0.72)'

// ─── INPUT ───────────────────────────────────────────────────────────────────

export interface InputRecipe {
  container: ViewStyle
  label: TextStyle
  input: TextStyle
  helper: TextStyle
  icon: ViewStyle
}

export function inputRecipe(state: InputState, colors: ThemeColors): InputRecipe {
  const borderColor =
    state === 'active' ? colors.accent :
    state === 'error'  ? colors.error  :
    'transparent'

  const borderWidth = state === 'active' || state === 'error' ? 1.5 : 0

  const backgroundColor =
    state === 'error'
      ? hexToRgba(colors.error, 0.08)
      : colors.inputBackground

  const helperColor =
    state === 'error' ? colors.error : colors.textTertiary

  const inputTextColor =
    state === 'default' ? colors.textTertiary : colors.textPrimary

  return StyleSheet.create({
    container: {
      backgroundColor,
      borderColor,
      borderWidth,
      borderRadius: radius.md,
      paddingHorizontal: spacing.s4,
      minHeight: touchTarget.comfort,
      flexDirection: 'row',
      alignItems: 'center',
    },
    label: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: spacing.s2,
    },
    input: {
      ...typography.body,
      color: inputTextColor,
      flex: 1,
      paddingVertical: spacing.s3,
    },
    helper: {
      ...typography.caption,
      color: helperColor,
      marginTop: spacing.s2,
      marginLeft: spacing.s2,
    },
    icon: {
      marginLeft: spacing.s3,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}

// ─── PR BADGE / CARD ─────────────────────────────────────────────────────────

export interface PrBadgeRecipe {
  container: ViewStyle
  iconColor: string
  label: TextStyle
}

export function prBadgeRecipe(
  level: PrLevel,
  type: PrType,
  colors: ThemeColors,
): PrBadgeRecipe {
  const iconColor = PR_ICON_COLORS[type](colors)
  const tint = prLevelColor(level, colors)

  return {
    container: {
      backgroundColor: hexToRgba(tint, 0.08),
      borderRadius: radius.lg,
      paddingVertical: spacing.s3,
      paddingHorizontal: spacing.s4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s2,
    },
    iconColor,
    label: {
      ...typography.caption,
      color: tint,
      textTransform: 'uppercase',
      fontFamily: font.bold,
    },
  }
}

// ─── CARD ────────────────────────────────────────────────────────────────────

export function cardRecipe(elevation: CardElevation, colors: ThemeColors): ViewStyle {
  if (elevation === 0) {
    return {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      padding: spacing.s4,
    }
  }
  if (elevation === 1) {
    return {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      padding: spacing.s4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 2,
    }
  }
  return {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: radius.xl,
    padding: spacing.s5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  }
}

// ─── TOGGLE ──────────────────────────────────────────────────────────────────

export interface ToggleRecipe {
  row: ViewStyle
  textBlock: ViewStyle
  label: TextStyle
  subtitle: TextStyle
  track: ViewStyle
  thumb: ViewStyle
}

export function toggleRecipe(value: boolean, colors: ThemeColors): ToggleRecipe {
  const TRACK_W = 52
  const TRACK_H = 32
  const THUMB = 26
  const PAD = (TRACK_H - THUMB) / 2

  return {
    row: {
      minHeight: touchTarget.comfort,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.s4,
      paddingVertical: spacing.s3,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      gap: spacing.s4,
    },
    textBlock: {
      flex: 1,
      flexDirection: 'column',
      gap: spacing.s1,
    },
    label: {
      ...typography.body,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'none',
      letterSpacing: 0,
    },
    track: {
      width: TRACK_W,
      height: TRACK_H,
      borderRadius: radius.full,
      backgroundColor: value ? colors.accent : colors.switchBackground,
      justifyContent: 'center',
      paddingHorizontal: PAD,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: radius.full,
      backgroundColor: value ? colors.background : colors.textPrimary,
      alignSelf: value ? 'flex-end' : 'flex-start',
    },
  }
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

export interface EmptyStateRecipe {
  container: ViewStyle
  icon: ViewStyle
  title: TextStyle
  subtitle: TextStyle
  cta: ViewStyle
  ctaLabel: TextStyle
}

export function emptyStateRecipe(
  variant: EmptyVariant,
  colors: ThemeColors,
): EmptyStateRecipe {
  const hasCta = variant === 'history'

  return {
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.s8,
      paddingVertical: spacing.s12,
      gap: spacing.s4,
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.s3,
    },
    title: {
      ...typography.subtitle,
      color: colors.textPrimary,
      fontFamily: font.bold,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    cta: {
      marginTop: spacing.s4,
      minHeight: touchTarget.comfort,
      paddingHorizontal: spacing.s8,
      borderRadius: radius.md,
      backgroundColor: hasCta ? colors.accent : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaLabel: {
      ...typography.caption,
      color: colors.background,
      fontFamily: font.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  }
}

// ─── SKELETON ────────────────────────────────────────────────────────────────

export interface SkeletonRecipe {
  card: ViewStyle
  line: ViewStyle
  circle: ViewStyle
}

export function skeletonRecipe(colors: ThemeColors): SkeletonRecipe {
  return {
    card: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      padding: spacing.s4,
      gap: spacing.s3,
    },
    line: {
      height: 12,
      borderRadius: radius.sm,
      backgroundColor: colors.backgroundTertiary,
    },
    circle: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.backgroundTertiary,
    },
  }
}

// ─── PR OVERLAY (glassmorphism) ──────────────────────────────────────────────

export interface PrOverlayRecipe {
  backdrop: ViewStyle
  cardStack: ViewStyle
  card: ViewStyle
  cardAccent: ViewStyle
  cardTitle: TextStyle
  cardValue: TextStyle
  cardSubtitle: TextStyle
}

export function prOverlayRecipe(level: PrLevel, colors: ThemeColors): PrOverlayRecipe {
  const tint = prLevelColor(level, colors)

  return {
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      // Dark base + subtle level tint (screen 12 spec: semi-transparent sombre + légère tinte dorée)
      backgroundColor: BACKDROP_BASE,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.s6,
    },
    cardStack: {
      width: '100%',
      flexDirection: 'column',
      gap: spacing.s3,
      alignItems: 'stretch',
    },
    card: {
      backgroundColor: hexToRgba(tint, 0.06),
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      borderRadius: radius.lg,
      padding: spacing.s5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 12,
      overflow: 'hidden',
      alignItems: 'center',
      gap: spacing.s2,
    },
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: tint,
    },
    cardTitle: {
      ...typography.caption,
      color: tint,
      textTransform: 'uppercase',
      fontFamily: font.bold,
      letterSpacing: 1,
    },
    cardValue: {
      fontSize: 40,
      fontFamily: font.bold,
      letterSpacing: -1.0,
      lineHeight: 44,
      color: tint,
      // WHY tabular-nums: prevents digit jitter during reveal animations
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    cardSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  }
}
