import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image as ExpoImage } from 'expo-image'
import { useRouter } from 'expo-router'
import {
  Trophy,
  ChevronRight,
  Shield,
  TrendingUp,
  Settings,
  Dumbbell,
  Camera,
  Lock,
  Target,
  Plus,
  Crown,
  Flame,
  RotateCcw,
  X,
} from 'lucide-react-native'
import Svg, { Path as SvgPath, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, font, spring, touchTarget } from '@/constants/theme'
import { formatVolume, formatDuration } from '@/lib/utils'
import { type WorkoutRow } from '@/lib/hooks/useHistoryData'
import {
  useProfileData,
  type UserProfile,
  type DayActivity,
  type WeekVolume,
  type PhotoItem,
} from '@/lib/hooks/useProfileData'
import { createClaim, nearMissGap, type Claim, type ClaimVoteCounts } from '@/lib/claims'
import { type FeaturedPr } from '@/lib/featuredPr'
import { resolveDisplayName } from '@/lib/displayName'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
const WEEKDAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

function dayTitle(ms: number): string {
  const d = new Date(ms)
  return `${WEEKDAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

function weekRangeTitle(weekStart: number): string {
  const a = new Date(weekStart)
  const b = new Date(weekStart + 6 * 86400000)
  const am = MONTHS_FR[a.getMonth()]
  const bm = MONTHS_FR[b.getMonth()]
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${am}`
    : `${a.getDate()} ${am} – ${b.getDate()} ${bm}`
}

function getDisplayName(profile: UserProfile): string {
  return resolveDisplayName(profile.name_display, profile.full_name, profile.username)
}

function getInitiale(profile: UserProfile): string {
  return (getDisplayName(profile).charAt(0) || 'O').toUpperCase()
}

function isThisMonth(ms: number): boolean {
  const d = new Date(ms)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
}

function daysUntil(deadlineIso: string | null): number | null {
  if (!deadlineIso) return null
  return Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - Date.now()) / 86400000))
}

// ─── Stat sociale inline (vitrine) ─────────────────────────────────────────────

function SocialStat({
  value,
  label,
  colors,
}: {
  value: number
  label: string
  colors: ReturnType<typeof useTheme>['colors']
}) {
  const s = buildStyles(colors)
  return (
    <View style={s.socialStat}>
      <Text style={s.socialStatValue} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={s.socialStatLabel}>{label}</Text>
    </View>
  )
}

// ─── Bande Claim (called-shot social) ──────────────────────────────────────────

function ClaimBand({
  claim,
  recentFailed,
  votes,
  colors,
  onCreate,
  onReclaim,
}: {
  claim: Claim | null
  recentFailed: Claim | null
  votes: ClaimVoteCounts
  colors: ReturnType<typeof useTheme>['colors']
  onCreate: () => void
  onReclaim: (claim: Claim) => void
}) {
  const s = buildStyles(colors)
  const mount = useSharedValue(0)
  useEffect(() => {
    mount.value = withDelay(120, withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }))
  }, [])
  const mountStyle = useAnimatedStyle(() => ({
    opacity: mount.value,
    transform: [{ translateY: (1 - mount.value) * 10 }],
  }))

  // Progress bar (claims 'sessions')
  const progress = useSharedValue(0)
  const target = claim?.target_value ?? 1
  const current = claim?.progress_current ?? 0
  useEffect(() => {
    progress.value = withDelay(
      300,
      withTiming(Math.min(1, current / target), { duration: 700, easing: Easing.out(Easing.cubic) })
    )
  }, [current, target])
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  if (!claim) {
    // Atterrissage privé d'un claim raté récemment (ORA-081) : visible par l'auteur seul
    // (le feed n'affiche qu'active+succeeded), sans honte publique. Re-claim en 1 tap.
    if (recentFailed) {
      const isW = recentFailed.type === 'weight'
      const gap = nearMissGap(recentFailed.target_value, recentFailed.resolved_value)
      const gapLabel =
        gap != null && gap > 0
          ? isW
            ? `à ${gap} kg près`
            : `à ${gap} séance${gap > 1 ? 's' : ''} près`
          : null
      return (
        <Animated.View style={mountStyle}>
          <View style={s.nearMissCard}>
            <View style={s.nearMissHeaderRow}>
              <Text style={s.nearMissTag}>CLAIM MANQUÉ</Text>
              {gapLabel && <Text style={s.nearMissGapLabel}>{gapLabel}</Text>}
            </View>
            <Text style={s.nearMissTarget} numberOfLines={1}>
              {recentFailed.target_value} {recentFailed.unit}
              {isW && recentFailed.exercise_name ? ` · ${recentFailed.exercise_name}` : ''}
            </Text>
            {recentFailed.resolved_value != null && (
              <Text style={s.nearMissReached}>
                Atteint : {recentFailed.resolved_value} {recentFailed.unit}
              </Text>
            )}
            <View style={s.nearMissActions}>
              <Pressable
                style={({ pressed }) => [s.reclaimBtn, pressed && { opacity: 0.85 }]}
                onPress={() => onReclaim(recentFailed)}
                accessibilityRole="button"
                accessibilityLabel="Re-claim, réannoncer le même objectif"
              >
                <RotateCcw size={14} color={colors.background} strokeWidth={2.5} />
                <Text style={s.reclaimBtnText}>Re-claim</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.reclaimAltBtn, pressed && { opacity: 0.6 }]}
                onPress={onCreate}
                accessibilityRole="button"
                accessibilityLabel="Annoncer un autre objectif"
              >
                <Text style={s.reclaimAltText}>Autre objectif</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )
    }
    return (
      <Animated.View style={mountStyle}>
        <Pressable
          style={({ pressed }) => [s.claimEmpty, pressed && { opacity: 0.7 }]}
          onPress={onCreate}
          accessibilityRole="button"
          accessibilityLabel="Annoncer un claim"
        >
          <View style={s.claimEmptyIcon}>
            <Target size={16} color={colors.accent} strokeWidth={2} />
          </View>
          <View style={s.flexOne}>
            <Text style={s.claimEmptyTitle}>Annoncer un claim</Text>
            <Text style={s.claimEmptySub}>Annonce ton prochain objectif. Le feed pronostique.</Text>
          </View>
          <Plus size={18} color={colors.textTertiary} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    )
  }

  const isWeight = claim.type === 'weight'
  const dLeft = daysUntil(claim.deadline)
  const deadlineLabel =
    claim.scope === 'next_session'
      ? 'Prochaine séance'
      : dLeft === 0
        ? 'Dernier jour'
        : `J-${dLeft}`

  return (
    <Animated.View style={mountStyle}>
      <View style={s.claimCard}>
        {/* barre accent gauche */}
        <View style={s.claimAccentBar} />
        <View style={s.claimHeaderRow}>
          <View style={s.claimTag}>
            <Target size={11} color={colors.accent} strokeWidth={2.5} />
            <Text style={s.claimTagText}>CLAIM ACTIF</Text>
          </View>
          <Text style={s.claimDeadline}>{deadlineLabel}</Text>
        </View>

        {/* cible */}
        <View style={s.claimTargetRow}>
          <Text style={s.claimTargetValue} allowFontScaling={false}>
            {claim.target_value}
            <Text style={s.claimTargetUnit}> {claim.unit}</Text>
          </Text>
          {isWeight && claim.exercise_name && (
            <Text style={s.claimExercise} numberOfLines={1}>
              {claim.exercise_name}
            </Text>
          )}
        </View>

        {/* progression (sessions) */}
        {!isWeight && (
          <View style={s.claimProgressWrap}>
            <View style={s.claimProgressTrack}>
              <Animated.View style={[s.claimProgressFill, barStyle]} />
            </View>
            <Text style={s.claimProgressLabel}>
              {current}/{claim.target_value}
            </Text>
          </View>
        )}

        {/* pronostics (lecture seule sur son propre profil) */}
        <View style={s.claimVotesRow}>
          <View style={s.claimVoteChip}>
            <Flame size={12} color={colors.accent} strokeWidth={2.5} />
            <Text style={s.claimVoteCount}>{votes.believe}</Text>
            <Text style={s.claimVoteLabel}>y croient</Text>
          </View>
          <Text style={s.claimVoteSep}>·</Text>
          <View style={s.claimVoteChip}>
            <Text style={s.claimVoteCount}>{votes.doubt}</Text>
            <Text style={s.claimVoteLabel}>sceptiques</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

// ─── Card PR vedette (vitrine prestige) ─────────────────────────────────────────

function PrVedetteCard({
  pr,
  colors,
  onPress,
}: {
  pr: FeaturedPr | null
  colors: ReturnType<typeof useTheme>['colors']
  onPress: () => void
}) {
  const s = buildStyles(colors)
  const mount = useSharedValue(0)
  useEffect(() => {
    mount.value = withDelay(200, withSpring(1, spring.standard))
  }, [])
  const mountStyle = useAnimatedStyle(() => ({
    opacity: mount.value,
    transform: [{ translateY: (1 - mount.value) * 10 }],
  }))

  if (!pr) {
    return (
      <Animated.View style={[s.prVedetteEmpty, mountStyle]}>
        <Crown size={16} color={colors.textTertiary} strokeWidth={1.5} />
        <Text style={s.prVedetteEmptyText}>
          Ton premier record s&apos;affichera ici en vitrine.
        </Text>
      </Animated.View>
    )
  }

  const recent = isThisMonth(pr.achieved_at)

  return (
    <Animated.View style={mountStyle}>
      <TouchableOpacity
        style={s.prVedetteCard}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Voir l'Armurerie"
      >
        <View style={s.prVedetteHeaderRow}>
          <View style={s.prVedetteTag}>
            <Crown size={12} color={colors.prGold} fill={colors.prGold} strokeWidth={0} />
            <Text style={s.prVedetteTagText}>PR VEDETTE</Text>
          </View>
          {recent && (
            <View style={s.prVedetteBadge}>
              <Text style={s.prVedetteBadgeText}>CE MOIS</Text>
            </View>
          )}
        </View>

        <View style={s.prVedetteMain}>
          <ChevronRight size={18} color={colors.textTertiary} />
          <View style={s.prVedetteTextCol}>
            <Text style={s.prVedetteValue} allowFontScaling={false}>
              {pr.weight_kg}
              <Text style={s.prVedetteUnit}> kg</Text>
            </Text>
            <Text style={s.prVedetteExercise} numberOfLines={1}>
              {pr.exercise_name}
            </Text>
            <Text style={s.prVedetteDelta}>
              {pr.delta_kg != null && pr.delta_kg > 0
                ? `+${Math.round(pr.delta_kg)} kg vs ton ancien record`
                : 'Premier record'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Tooltip flottant partagé (calendrier + graph volume) ──────────────────────
// Léger : carte glassy au-dessus de l'élément tapé, flèche centrée sur l'ancre,
// apparition spring (jamais linear). pointerEvents none → ne capture pas le tap.

function ChartTooltip({
  x,
  containerW,
  title,
  value,
  accent,
  colors,
}: {
  x: number // centre x de l'ancre, dans le repère du conteneur
  containerW: number
  title: string
  value: string
  accent?: boolean
  colors: ReturnType<typeof useTheme>['colors']
}) {
  const s = buildStyles(colors)
  const TW = 134
  const mount = useSharedValue(0)
  useEffect(() => {
    mount.value = withSpring(1, spring.snappy)
  }, [])
  const mountStyle = useAnimatedStyle(() => ({
    opacity: mount.value,
    transform: [{ translateY: (1 - mount.value) * 5 }, { scale: 0.95 + mount.value * 0.05 }],
  }))

  let left = x - TW / 2
  if (containerW > 0) left = Math.max(0, Math.min(left, containerW - TW))
  const pointerLeft = Math.max(10, Math.min(x - left - 5, TW - 20))

  return (
    <Animated.View style={[s.tooltip, { left, width: TW }, mountStyle]} pointerEvents="none">
      <Text style={s.tooltipTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text
        style={[s.tooltipValue, accent && { color: colors.prGold }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <View style={[s.tooltipPointer, { left: pointerLeft }]} />
    </Animated.View>
  )
}

// ─── Calendrier 7 derniers jours (interactif) ───────────────────────────────────

function WeekCalendar({
  days,
  colors,
}: {
  days: DayActivity[]
  colors: ReturnType<typeof useTheme>['colors']
}) {
  const s = buildStyles(colors)
  const [w, setW] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const pick = useCallback((i: number) => {
    setSel((prev) => (prev === i ? null : i))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setSel(null), 2600)
  }, [])

  const d = sel !== null ? days[sel] : null
  const anchorX = sel !== null && w > 0 ? ((sel + 0.5) / days.length) * w : 0

  return (
    <View style={s.calWrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {d && (
        <ChartTooltip
          key={`cal-${sel}`}
          x={anchorX}
          containerW={w}
          colors={colors}
          title={dayTitle(d.date)}
          value={d.hasSession ? `${formatVolume(d.volumeKg)} kg` : 'Repos'}
          accent={d.hasSession}
        />
      )}
      <View style={s.weekRow}>
        {days.map((day, i) => (
          <Pressable
            key={day.date}
            style={s.weekCol}
            onPress={() => pick(i)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${dayTitle(day.date)} — ${
              day.hasSession ? `${Math.round(day.volumeKg)} kg` : 'repos'
            }`}
          >
            <Text style={[s.weekLabel, day.isToday && s.weekLabelToday]}>{day.label}</Text>
            <View
              style={[
                s.weekCell,
                day.hasSession && s.weekCellActive,
                day.isToday && !day.hasSession && s.weekCellToday,
                sel === i && s.weekCellSelected,
              ]}
            >
              {day.hasSession ? (
                <Dumbbell size={15} color={colors.background} strokeWidth={2.5} />
              ) : (
                <Text style={[s.weekDayNum, day.isToday && s.weekDayNumToday]}>{day.dayNum}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

// ─── Graph volume hebdomadaire (interactif, axe Y discret) ─────────────────────

// Courbe lissée (Catmull-Rom → cubiques Bézier). Élégant, jamais de cassure dure.
function buildSmoothPath(pts: { x: number; y: number }[], closeToBaseline?: number): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) {
    const p = pts[0]
    return closeToBaseline != null
      ? `M ${p.x} ${closeToBaseline} L ${p.x} ${p.y} Z`
      : `M ${p.x} ${p.y}`
  }
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  if (closeToBaseline != null) {
    const last = pts[pts.length - 1]
    d += ` L ${last.x} ${closeToBaseline} L ${pts[0].x} ${closeToBaseline} Z`
  }
  return d
}

const VOL_CHART_H = 72
const VOL_PAD_TOP = 8
const VOL_PAD_BOTTOM = 6

function WeeklyVolumeChart({
  weeks,
  colors,
}: {
  weeks: WeekVolume[]
  colors: ReturnType<typeof useTheme>['colors']
}) {
  const s = buildStyles(colors)
  const [w, setW] = useState(0)
  const [sel, setSel] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const pick = useCallback((i: number) => {
    setSel((prev) => (prev === i ? null : i))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setSel(null), 2600)
  }, [])

  const max = Math.max(1, ...weeks.map((wk) => wk.volumeKg))
  const ticks = [max, max / 2, 0] // axe Y discret : haut · milieu · base
  const sw = sel !== null ? weeks[sel] : null
  const anchorX = sel !== null && w > 0 ? ((sel + 0.5) / weeks.length) * w : 0

  const usableH = VOL_CHART_H - VOL_PAD_TOP - VOL_PAD_BOTTOM
  const baselineY = VOL_CHART_H - VOL_PAD_BOTTOM
  const pts =
    w > 0
      ? weeks.map((wk, i) => ({
          x: ((i + 0.5) / weeks.length) * w,
          y: VOL_PAD_TOP + (1 - wk.volumeKg / max) * usableH,
        }))
      : []

  return (
    <View style={s.volOuter}>
      <View style={s.volAxisCol}>
        {ticks.map((t, i) => (
          <Text key={i} style={s.volAxisLabel} numberOfLines={1} allowFontScaling={false}>
            {formatVolume(Math.round(t))}
          </Text>
        ))}
      </View>
      <View style={s.volChartArea} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {/* lignes de repère discrètes (alignées sur les ticks) */}
        <View style={[s.volGrid, { top: 0 }]} />
        <View style={[s.volGrid, { top: '50%' }]} />
        <View style={[s.volGrid, { bottom: 0 }]} />

        {sw && (
          <ChartTooltip
            key={`vol-${sel}`}
            x={anchorX}
            containerW={w}
            colors={colors}
            title={`Sem. ${weekRangeTitle(sw.weekStart)}`}
            value={sw.volumeKg > 0 ? `${formatVolume(sw.volumeKg)} kg` : 'Aucun volume'}
            accent={sw.volumeKg > 0}
          />
        )}

        {/* Ligne jaune lissée + dégradé sous la courbe */}
        {w > 0 && (
          <Svg width={w} height={VOL_CHART_H} style={s.volSvg} pointerEvents="none">
            <Defs>
              <LinearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.prGold} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.prGold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <SvgPath d={buildSmoothPath(pts, baselineY)} fill="url(#volFill)" />
            <SvgPath
              d={buildSmoothPath(pts)}
              fill="none"
              stroke={colors.prGold}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.map((p, i) => {
              const isLast = i === weeks.length - 1
              const isSel = sel === i
              if (!isSel && !isLast) return null
              return (
                <Circle
                  key={weeks[i].weekStart}
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 4 : 3}
                  fill={isSel ? colors.accent : colors.prGold}
                  stroke={colors.background}
                  strokeWidth={1.5}
                />
              )
            })}
          </Svg>
        )}

        {/* Couche tactile : un tap n'importe où sélectionne la semaine la plus proche */}
        <Pressable
          style={s.volTouchLayer}
          onPress={(e) => {
            if (w <= 0) return
            const x = e.nativeEvent.locationX
            const i = Math.max(0, Math.min(weeks.length - 1, Math.floor((x / w) * weeks.length)))
            pick(i)
          }}
          accessibilityRole="button"
          accessibilityLabel="Détail du volume par semaine"
        />
      </View>
    </View>
  )
}

// ─── Galerie photos ────────────────────────────────────────────────────────────

function PhotoGallery({
  photos,
  colors,
  onOpenSession,
}: {
  photos: PhotoItem[]
  colors: ReturnType<typeof useTheme>['colors']
  onOpenSession: (workoutId: string) => void
}) {
  const s = buildStyles(colors)
  const { width } = useWindowDimensions()
  const [lightbox, setLightbox] = useState<PhotoItem | null>(null)

  if (photos.length === 0) {
    return (
      <View style={s.galleryEmpty}>
        <Camera size={28} color={colors.textTertiary} strokeWidth={1.5} />
        <Text style={s.galleryEmptyText}>
          Aucune photo. Ajoute une photo à ta prochaine séance.
        </Text>
      </View>
    )
  }

  // Grille 3 colonnes — largeur écran moins padding header (s5×2) moins 2 gaps (s2).
  const tileSize = Math.floor((width - spacing.s5 * 2 - spacing.s2 * 2) / 3)

  return (
    <>
      <View style={s.galleryGrid}>
        {photos.map((p) => (
          <Pressable
            key={p.workoutId}
            onPress={() => setLightbox(p)}
            style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}
            accessibilityRole="imagebutton"
            accessibilityLabel="Voir la photo de séance"
          >
            <ExpoImage
              source={{ uri: p.photoUrl }}
              style={[s.galleryTile, { width: tileSize, height: tileSize }]}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
            />
            {!p.isPublic && (
              <View style={s.galleryPrivateBadge}>
                <Lock size={11} color={colors.textPrimary} strokeWidth={2.5} />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Modal
        visible={lightbox !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
      >
        <Pressable style={s.lightboxBackdrop} onPress={() => setLightbox(null)}>
          {lightbox && (
            <ExpoImage
              source={{ uri: lightbox.photoUrl }}
              style={s.lightboxImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
          <Pressable
            style={s.lightboxClose}
            onPress={() => setLightbox(null)}
            hitSlop={12}
            accessibilityLabel="Fermer"
          >
            <X size={24} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
          {lightbox && (
            <Pressable
              style={s.lightboxCta}
              onPress={() => {
                const id = lightbox.workoutId
                setLightbox(null)
                onOpenSession(id)
              }}
              accessibilityRole="button"
              accessibilityLabel="Voir la séance"
            >
              <Text style={s.lightboxCtaText}>Voir la séance</Text>
              <ChevronRight size={16} color={colors.background} strokeWidth={2.5} />
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  )
}

// ─── History row ──────────────────────────────────────────────────────────────

interface HistoryRowProps {
  item: WorkoutRow
  onPress: () => void
  colors: ReturnType<typeof useTheme>['colors']
}

function HistoryRowInProfile({ item, onPress, colors }: HistoryRowProps) {
  const d = new Date(item.started_at)
  const day = d.getDate().toString()
  const weekday = DAYS_FR[d.getDay()]
  const volumeStr = formatVolume(item.total_volume_kg ?? 0)
  const subtitleParts = [
    `${item.total_sets} série${item.total_sets > 1 ? 's' : ''}`,
    formatDuration(item.duration_sec),
  ]

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: colors.backgroundSecondary, marginBottom: spacing.s2 },
      ]}
    >
      <View style={styles.cardInner}>
        {/* Bloc date */}
        <View style={styles.dateBlock}>
          <Text
            style={[
              typography.title,
              {
                color: colors.textPrimary,
                fontSize: 22,
                lineHeight: 26,
                letterSpacing: -0.3,
                fontFamily: font.bold,
              },
            ]}
          >
            {day}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, textTransform: 'uppercase', marginTop: 2 },
            ]}
          >
            {weekday}
          </Text>
        </View>

        {/* Centre */}
        <View style={styles.centerCol}>
          <Text
            style={[typography.body, { color: colors.textPrimary, fontFamily: font.bold }]}
            numberOfLines={1}
          >
            {item.title ?? '—'}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {subtitleParts.join(' · ')}
          </Text>
        </View>

        {/* Right : icône PR + volume + chevron */}
        <View style={styles.rightCol}>
          {item.pr_seance === 'gold' && <Trophy size={14} color={colors.prGold} />}
          {item.pr_seance === 'silver' && <Trophy size={14} color={colors.prSilver} />}
          {item.pr_seance === 'bronze' && <Trophy size={14} color={colors.prBronze} />}
          <Text
            style={[
              typography.body,
              {
                color: colors.textPrimary,
                fontFamily: font.bold,
                fontVariant: ['tabular-nums'],
                fontSize: 14,
              },
            ]}
          >
            {volumeStr}{' '}
            <Text
              style={{
                fontFamily: font.regular,
                color: colors.textSecondary,
                fontSize: 12,
              }}
            >
              kg
            </Text>
          </Text>
          <ChevronRight size={14} color={colors.textTertiary} style={{ marginTop: 2 }} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Animated counter ────────────────────────────────────────────────────────

const easeOutCubic = Easing.bezier(0.215, 0.61, 0.355, 1)

function AnimatedCounter({
  target,
  duration = 600,
  delay = 0,
  style,
  formatter = (v: number) => String(v),
}: {
  target: number
  duration?: number
  delay?: number
  style?: object
  formatter?: (v: number) => string
}) {
  const sv = useSharedValue(0)
  const [displayValue, setDisplayValue] = useState(() => formatter(0))

  const formatAndSet = useCallback(
    (v: number) => {
      setDisplayValue(formatter(Math.round(v)))
    },
    [formatter]
  )

  useEffect(() => {
    sv.value = withDelay(delay, withTiming(target, { duration, easing: easeOutCubic }))
  }, [target, delay, duration])

  useAnimatedReaction(
    () => Math.round(sv.value * 2),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(formatAndSet)(sv.value)
      }
    }
  )

  return <Text style={style}>{displayValue}</Text>
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  const {
    profile,
    stats,
    followers,
    follows,
    weekActivity,
    weeklyVolume,
    photoGallery,
    historySections,
    featuredPr,
    activeClaim,
    recentFailedClaim,
    claimVotes,
    trackRecord,
    refreshing,
    onRefresh,
  } = useProfileData()

  const [deconnexionLoading, setDeconnexionLoading] = useState<boolean>(false)
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false)

  // Re-claim 1 tap (ORA-081) : réannonce le même objectif (createClaim expire l'ancien actif
  // s'il existe) puis refetch → la bande repasse en « claim actif ».
  function handleReclaim(c: Claim): void {
    void (async () => {
      await createClaim({
        type: c.type,
        exerciseId: c.exercise_id,
        exerciseName: c.exercise_name,
        targetValue: c.target_value,
        scope: c.scope,
        isPublic: c.is_public,
      })
      onRefresh()
    })()
  }

  async function seDeconnecter(): Promise<void> {
    setDeconnexionLoading(true)
    await supabase.auth.signOut()
    setDeconnexionLoading(false)
    router.replace('/auth/login')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const s = buildStyles(colors)

  const initiale = profile ? getInitiale(profile) : 'O'
  const fullName = profile ? getDisplayName(profile) : 'Athlète'
  const isPro = profile?.plan === 'premium'
  const avatarUrl = profile?.avatar_url ?? null

  function handleAvatarPress(): void {
    if (avatarUrl) setLightboxOpen(true)
    else router.push('/edit-profile')
  }

  return (
    <SafeAreaView style={[s.container]} edges={['top']}>
      <SectionList
        sections={historySections}
        keyExtractor={(item) => item.id}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={() => (
          <View style={s.headerContainer}>
            {/* Barre haut : nom + prénom centré · réglages à droite */}
            <View style={s.topBar}>
              <View style={s.topBarCenter}>
                <Text style={s.fullName} numberOfLines={1}>
                  {fullName}
                </Text>
                {isPro && (
                  <View style={s.proBadge}>
                    <Text style={s.proBadgeText}>PRO</Text>
                  </View>
                )}
              </View>
              <View style={s.topBarActions}>
                <Pressable
                  style={({ pressed }) => [s.gearBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push('/prs')}
                  accessibilityRole="button"
                  accessibilityLabel="Armurerie"
                  hitSlop={8}
                >
                  <Shield size={17} color={colors.textSecondary} strokeWidth={1.75} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.gearBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push('/analytics')}
                  accessibilityRole="button"
                  accessibilityLabel="Analytics"
                  hitSlop={8}
                >
                  <TrendingUp size={17} color={colors.textSecondary} strokeWidth={1.75} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.gearBtn, pressed && { opacity: 0.6 }]}
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Paramètres"
                  hitSlop={8}
                >
                  <Settings size={17} color={colors.textSecondary} strokeWidth={1.75} />
                </Pressable>
              </View>
            </View>

            {/* Identité : avatar (gauche) + stats sociales horizontales */}
            <View style={s.identityRow}>
              <Pressable
                onPress={handleAvatarPress}
                accessibilityLabel="Photo de profil"
                style={s.avatarWrap}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
                ) : (
                  <View style={s.avatarCircle}>
                    <Text style={s.avatarLetter}>{initiale}</Text>
                  </View>
                )}
              </Pressable>
              <View style={s.socialStats}>
                <SocialStat value={stats.seances} label="SÉANCES" colors={colors} />
                <SocialStat value={followers} label="ABONNÉS" colors={colors} />
                <SocialStat value={follows} label="ABONNEMENTS" colors={colors} />
              </View>
            </View>

            {/* Track record claims (centré) */}
            {trackRecord.total > 0 && (
              <Text style={s.trackRecord}>
                {trackRecord.succeeded}/{trackRecord.total} claims
              </Text>
            )}

            {/* Streak + calendrier 7 jours + volume hebdo (haut du profil) */}
            <View style={s.statsCard}>
              {stats.streakSemaines > 0 && (
                <>
                  <View style={s.statSecondaryRow}>
                    <View style={s.statCol}>
                      <AnimatedCounter
                        target={stats.streakSemaines}
                        duration={1000}
                        delay={120}
                        style={s.statValueSide}
                      />
                      <Text style={s.statLabel}>STREAK SEM.</Text>
                    </View>
                  </View>
                  <View style={s.statSepH} />
                </>
              )}
              <View style={s.weekInCard}>
                <Text style={s.sectionLabel}>7 DERNIERS JOURS</Text>
                <WeekCalendar days={weekActivity} colors={colors} />
                {weeklyVolume.some((w) => w.volumeKg > 0) && (
                  <>
                    <View style={s.volTopGap} />
                    <Text style={s.sectionLabel}>VOLUME / SEMAINE</Text>
                    <WeeklyVolumeChart weeks={weeklyVolume} colors={colors} />
                  </>
                )}
              </View>
            </View>

            {/* CLAIM — aspiration (futur) */}
            <ClaimBand
              claim={activeClaim}
              recentFailed={recentFailedClaim}
              votes={claimVotes}
              colors={colors}
              onCreate={() => router.push('/claim/new')}
              onReclaim={handleReclaim}
            />

            {/* PR VEDETTE — preuve (passé) */}
            <PrVedetteCard pr={featuredPr} colors={colors} onPress={() => router.push('/prs')} />

            {/* Galerie photos */}
            <View style={s.gallerySection}>
              <Text style={s.sectionLabel}>VITRINE</Text>
              <PhotoGallery
                photos={photoGallery}
                colors={colors}
                onOpenSession={(id) => router.push(`/history/${id}` as const)}
              />
            </View>

            {/* Historique title */}
            <Text style={[s.sectionTitle, { marginTop: spacing.s4, marginBottom: spacing.s4 }]}>
              HISTORIQUE
            </Text>
          </View>
        )}
        ListHeaderComponentStyle={s.headerContent}
        contentContainerStyle={s.contentContainer}
        renderSectionHeader={({ section }) => <Text style={s.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <HistoryRowInProfile
            item={item}
            onPress={() => router.push(`/history/${item.id}` as const)}
            colors={colors}
          />
        )}
        ItemSeparatorComponent={() => null}
        SectionSeparatorComponent={() => null}
        ListFooterComponent={() => (
          <View style={s.footerContainer}>
            <Pressable
              style={({ pressed }) => [s.deconnexionBtn, pressed && { opacity: 0.6 }]}
              onPress={() => void seDeconnecter()}
              disabled={deconnexionLoading}
            >
              {deconnexionLoading ? (
                <ActivityIndicator color={colors.textTertiary} size="small" />
              ) : (
                <Text style={s.deconnexionText}>Déconnexion</Text>
              )}
            </Pressable>
          </View>
        )}
      />

      {/* Lightbox photo de profil */}
      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}
      >
        <Pressable style={s.lightboxBackdrop} onPress={() => setLightboxOpen(false)}>
          {avatarUrl && (
            <Image source={{ uri: avatarUrl }} style={s.lightboxImage} resizeMode="contain" />
          )}
          <Pressable
            style={s.lightboxClose}
            onPress={() => setLightboxOpen(false)}
            hitSlop={12}
            accessibilityLabel="Fermer"
          >
            <X size={24} color={colors.textPrimary} strokeWidth={2} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-native/no-unused-styles
function buildStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flexOne: { flex: 1 },
    headerContent: {},
    contentContainer: {
      paddingHorizontal: spacing.s5,
    },
    headerContainer: {
      paddingHorizontal: spacing.s5,
      paddingTop: spacing.s2,
      paddingBottom: spacing.s2,
    },

    // ── Top bar (nom centré + réglages) ──
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.s2,
    },
    topBarCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.s2,
    },
    fullName: {
      ...typography.title,
      fontSize: 27,
      lineHeight: 32,
      color: colors.textPrimary,
      fontFamily: font.bold,
      flexShrink: 1,
      textAlign: 'center',
    },
    gearBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Identité (avatar dans le coin + stats sociales) ──
    identityRow: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 85,
      // avatar absolu débordant de spacing.s5 à gauche → bord droit avatar à 65, + gouttière s5
      paddingLeft: 85,
      marginBottom: spacing.s4,
    },
    // Avatar épinglé dans le coin haut-gauche, remonté au-dessus de la barre titre.
    // Taille fixe 64 — ne pas redimensionner.
    avatarWrap: {
      position: 'absolute',
      left: -spacing.s2,
      top: spacing.s3,
      zIndex: 2,
    },
    avatarCircle: {
      width: 85,
      height: 85,
      borderRadius: 43,
      backgroundColor: colors.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarImage: {
      width: 85,
      height: 85,
      borderRadius: 43,
      backgroundColor: colors.backgroundTertiary,
    },
    avatarLetter: {
      ...typography.title,
      fontSize: 36,
      lineHeight: 40,
      fontFamily: font.black,
      color: colors.textSecondary,
    },
    socialStats: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginTop: -spacing.s4,
      paddingLeft: spacing.s6,
    },
    socialStat: {
      alignItems: 'center',
      flex: 1,
    },
    socialStatValue: {
      fontSize: 15,
      fontFamily: font.bold,
      color: colors.textPrimary,
      letterSpacing: -0.3,
      lineHeight: 18,
      fontVariant: ['tabular-nums'],
    },
    socialStatLabel: {
      fontSize: 9,
      fontFamily: font.medium,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginTop: 1,
      textAlign: 'center',
    },

    proBadge: {
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      height: 22,
      paddingHorizontal: spacing.s2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: colors.background,
      letterSpacing: 1,
    },
    trackRecord: {
      ...typography.caption,
      color: colors.textTertiary,
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      marginBottom: spacing.s3,
    },

    // ── Actions ──
    topBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s2,
      marginRight: -spacing.s2,
    },

    // ── Claim ──
    claimEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s3,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      paddingVertical: spacing.s4,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s4,
    },
    claimEmptyIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: `${colors.accent}1A`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    claimEmptyTitle: {
      ...typography.body,
      fontFamily: font.bold,
      color: colors.textPrimary,
    },
    claimEmptySub: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: 1,
    },
    claimCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      paddingVertical: spacing.s4,
      paddingHorizontal: spacing.s4,
      paddingLeft: spacing.s4 + 3,
      marginBottom: spacing.s4,
      overflow: 'hidden',
    },
    claimAccentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: colors.accent,
    },
    claimHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.s3,
    },
    claimTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s1,
    },
    claimTagText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: colors.accent,
      letterSpacing: 1.2,
    },
    claimDeadline: {
      fontSize: 11,
      fontFamily: font.medium,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    claimTargetRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.s3,
      marginBottom: spacing.s3,
    },
    claimTargetValue: {
      fontSize: 28,
      fontFamily: font.extraBold,
      color: colors.textPrimary,
      letterSpacing: -0.8,
      fontVariant: ['tabular-nums'],
    },
    claimTargetUnit: {
      fontSize: 16,
      fontFamily: font.bold,
      color: colors.textSecondary,
    },
    claimExercise: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      flexShrink: 1,
    },
    claimProgressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s3,
      marginBottom: spacing.s3,
    },
    claimProgressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.backgroundTertiary,
      overflow: 'hidden',
    },
    claimProgressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    claimProgressLabel: {
      fontSize: 12,
      fontFamily: font.bold,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    claimVotesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s2,
    },
    claimVoteChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s1,
    },
    claimVoteCount: {
      fontSize: 13,
      fontFamily: font.bold,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    claimVoteLabel: {
      ...typography.caption,
      color: colors.textTertiary,
    },
    claimVoteSep: {
      color: colors.textTertiary,
      fontSize: 13,
    },

    // ── Near-miss (claim raté, ORA-081) — discret, ni rouge ni accent ──
    nearMissCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.s4,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s4,
      gap: spacing.s2,
    },
    nearMissHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    nearMissTag: {
      fontSize: 10,
      fontFamily: font.bold,
      color: colors.textSecondary,
      letterSpacing: 1.2,
    },
    nearMissGapLabel: {
      fontSize: 11,
      fontFamily: font.medium,
      color: colors.textTertiary,
      fontVariant: ['tabular-nums'],
    },
    nearMissTarget: {
      fontSize: 20,
      fontFamily: font.bold,
      color: colors.textSecondary,
      letterSpacing: -0.4,
      fontVariant: ['tabular-nums'],
    },
    nearMissReached: {
      ...typography.caption,
      color: colors.textTertiary,
      fontVariant: ['tabular-nums'],
    },
    nearMissActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s3,
      marginTop: spacing.s2,
    },
    reclaimBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.s2,
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      paddingHorizontal: spacing.s5,
      height: touchTarget.min,
    },
    reclaimBtnText: {
      ...typography.body,
      fontFamily: font.bold,
      fontSize: 14,
      color: colors.background,
    },
    reclaimAltBtn: {
      justifyContent: 'center',
      height: touchTarget.min,
      paddingHorizontal: spacing.s2,
    },
    reclaimAltText: {
      ...typography.caption,
      fontFamily: font.medium,
      color: colors.textSecondary,
    },

    // ── PR vedette ──
    prVedetteCard: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: `${colors.prGold}24`,
      paddingVertical: spacing.s4,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s5,
    },
    prVedetteHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.s3,
    },
    prVedetteTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s1,
    },
    prVedetteTagText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: colors.prGold,
      letterSpacing: 1.2,
    },
    prVedetteBadge: {
      backgroundColor: `${colors.prGold}1A`,
      borderRadius: radius.full,
      paddingHorizontal: spacing.s2,
      paddingVertical: 2,
    },
    prVedetteBadgeText: {
      fontSize: 9,
      fontFamily: font.bold,
      color: colors.prGold,
      letterSpacing: 1,
    },
    prVedetteMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s3,
    },
    // Corps aligné à droite → quinconce visuel vs la bande Claim (alignée à gauche)
    prVedetteTextCol: {
      flex: 1,
      alignItems: 'flex-end',
    },
    prVedetteValue: {
      fontSize: 32,
      fontFamily: font.black,
      color: colors.prGold,
      letterSpacing: -1,
      lineHeight: 36,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    prVedetteUnit: {
      fontSize: 18,
      fontFamily: font.bold,
      color: colors.prGold,
    },
    prVedetteExercise: {
      ...typography.body,
      fontFamily: font.bold,
      color: colors.textPrimary,
      marginTop: 2,
      textAlign: 'right',
    },
    prVedetteDelta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'right',
    },
    prVedetteEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s3,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      paddingVertical: spacing.s4,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s5,
    },
    prVedetteEmptyText: {
      ...typography.caption,
      color: colors.textTertiary,
      flex: 1,
    },

    // ── Stats card ──
    statsCard: {
      flexDirection: 'column',
      paddingVertical: spacing.s2,
      marginTop: spacing.s5,
      marginBottom: spacing.s5,
    },
    statHeroRow: {
      alignItems: 'center',
      paddingVertical: spacing.s2,
    },
    statSepH: {
      height: 1,
      backgroundColor: colors.separator,
      marginHorizontal: spacing.s4,
      marginBottom: spacing.s2,
    },
    statSecondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statCol: {
      flex: 1,
      alignItems: 'center',
    },
    statValueSide: {
      ...typography.display,
      fontSize: 22,
      lineHeight: 24,
      letterSpacing: -0.5,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    statValueHero: {
      ...typography.hero,
      fontSize: 34,
      lineHeight: 38,
      letterSpacing: -1,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      marginTop: spacing.s1,
      textAlign: 'center',
    },

    // ── Section label commun ──
    sectionLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.s3,
    },

    // ── Tooltip flottant (calendrier + graph) ──
    tooltip: {
      position: 'absolute',
      top: -54,
      zIndex: 10,
      alignItems: 'center',
      paddingVertical: spacing.s2,
      paddingHorizontal: spacing.s3,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    tooltipTitle: {
      fontSize: 10,
      fontFamily: font.medium,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    tooltipValue: {
      fontSize: 14,
      fontFamily: font.bold,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
      marginTop: 1,
    },
    tooltipPointer: {
      position: 'absolute',
      bottom: -5,
      width: 10,
      height: 10,
      backgroundColor: colors.backgroundTertiary,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      transform: [{ rotate: '45deg' }],
    },

    // ── Calendrier 7 jours ──
    weekInCard: {
      paddingTop: spacing.s1,
    },
    calWrap: {
      position: 'relative',
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    weekCol: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.s2,
    },
    weekLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
    },
    weekLabelToday: {
      color: colors.textPrimary,
    },
    weekCell: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    weekCellActive: {
      backgroundColor: colors.prGold,
      borderColor: colors.prGold,
    },
    weekCellToday: {
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    weekCellSelected: {
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    weekDayNumToday: {
      color: colors.textPrimary,
    },
    weekDayNum: {
      ...typography.caption,
      color: colors.textTertiary,
      fontVariant: ['tabular-nums'],
    },

    // ── Volume hebdomadaire (graph interactif + axe Y discret) ──
    volTopGap: {
      height: spacing.s4,
    },
    volOuter: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    volAxisCol: {
      width: 40,
      height: 72,
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingRight: spacing.s2,
    },
    volAxisLabel: {
      fontSize: 9,
      fontFamily: font.medium,
      color: colors.textTertiary,
      fontVariant: ['tabular-nums'],
      lineHeight: 10,
    },
    volChartArea: {
      flex: 1,
      height: 72,
      position: 'relative',
    },
    volGrid: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.separator,
    },
    volSvg: {
      position: 'absolute',
      left: 0,
      top: 0,
    },
    volTouchLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
    },

    // ── Galerie photos ──
    gallerySection: {
      marginBottom: spacing.s6,
    },
    galleryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.s2,
    },
    galleryTile: {
      borderRadius: radius.md,
      backgroundColor: colors.backgroundTertiary,
    },
    galleryPrivateBadge: {
      position: 'absolute',
      top: spacing.s2,
      left: spacing.s2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(10,10,15,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    galleryEmpty: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      paddingVertical: spacing.s8,
      paddingHorizontal: spacing.s5,
      alignItems: 'center',
      gap: spacing.s3,
    },
    galleryEmptyText: {
      ...typography.caption,
      color: colors.textTertiary,
      textAlign: 'center',
    },

    // ── Historique ──
    sectionTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
    },
    sectionHeader: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingTop: spacing.s6,
      paddingBottom: spacing.s3,
    },

    // ── Déconnexion ──
    footerContainer: {
      paddingVertical: spacing.s6,
      alignItems: 'center',
    },
    deconnexionBtn: {
      alignItems: 'center',
      paddingVertical: spacing.s5,
      minHeight: 44,
      justifyContent: 'center',
    },
    deconnexionText: {
      ...typography.body,
      color: colors.textSecondary,
    },

    // ── Lightbox ──
    lightboxBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    lightboxImage: {
      width: '90%',
      height: '70%',
    },
    lightboxClose: {
      position: 'absolute',
      top: 56,
      right: 24,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lightboxCta: {
      position: 'absolute',
      bottom: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s1,
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      paddingHorizontal: spacing.s5,
      height: touchTarget.min,
    },
    lightboxCtaText: {
      ...typography.body,
      fontFamily: font.bold,
      fontSize: 14,
      color: colors.background,
    },
  })
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s4,
    gap: spacing.s3,
  },
  dateBlock: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  centerCol: {
    flex: 1,
    minWidth: 0,
  },
  rightCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
})
