import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useAnimatedProps,
  cancelAnimation,
  runOnJS,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Zap,
  Flame,
  Trophy,
  ChevronRight,
  Shield,
  TrendingUp,
  Settings,
  Users,
  UserPlus,
} from 'lucide-react-native'
import Svg, { Circle as SvgCircle } from 'react-native-svg'
import {
  Canvas,
  Path as SkiaPath,
  Skia,
  LinearGradient as SkiaLinearGradient,
  vec,
} from '@shopify/react-native-skia'
import { Dimensions } from 'react-native'
import { supabase } from '@/lib/supabase'

const { width: PROFILE_W } = Dimensions.get('window')
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, font } from '@/constants/theme'
import { formatVolume, formatDuration } from '@/lib/utils'
import { type WorkoutRow } from '@/lib/hooks/useHistoryData'
import { useProfileData, type UserProfile, type SparklineData } from '@/lib/hooks/useProfileData'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAYS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']

function getInitiale(profile: UserProfile): string {
  const src = profile.full_name ?? profile.username ?? 'O'
  return src.charAt(0).toUpperCase()
}

function getUsername(profile: UserProfile): string {
  if (profile.username) return `@${profile.username}`
  if (profile.full_name) return profile.full_name
  return 'Athlète'
}

// ─── Sparkline mini ────────────────────────────────────────────────────────────

function SparklineRow({
  data,
  colors,
}: {
  data: SparklineData[]
  colors: ReturnType<typeof useTheme>['colors']
}) {
  const canvasW = PROFILE_W - spacing.s4 * 4
  const canvasH = 56

  const { linePath, fillPath } = useMemo(() => {
    if (data.length === 0) return { linePath: null, fillPath: null }

    const maxVol = Math.max(...data.map((d) => d.volume), 1)
    const n = data.length
    const padX = 4
    const padY = 6
    const pts = data.map((d, i) => ({
      x: padX + (i / Math.max(n - 1, 1)) * (canvasW - padX * 2),
      y: padY + (1 - d.volume / maxVol) * (canvasH - padY * 2),
    }))

    const line = Skia.Path.Make()
    const fill = Skia.Path.Make()

    line.moveTo(pts[0].x, pts[0].y)
    fill.moveTo(pts[0].x, canvasH)
    fill.lineTo(pts[0].x, pts[0].y)

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const cpx = (prev.x + curr.x) / 2
      line.cubicTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y)
      fill.cubicTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y)
    }

    fill.lineTo(pts[pts.length - 1].x, canvasH)
    fill.close()

    return { linePath: line, fillPath: fill }
  }, [data, canvasW, canvasH])

  if (data.length === 0 || !linePath || !fillPath) {
    return (
      <Text
        style={{
          ...typography.caption,
          color: colors.textTertiary,
          textAlign: 'center',
          marginVertical: spacing.s3,
        }}
      >
        Aucune séance récente
      </Text>
    )
  }

  return (
    <Canvas style={{ width: canvasW, height: canvasH, marginVertical: spacing.s3 }}>
      {/* Zone remplie — gradient vertical */}
      <SkiaPath path={fillPath} style="fill" opacity={0.18}>
        <SkiaLinearGradient
          start={vec(0, 0)}
          end={vec(0, canvasH)}
          colors={['#FFDD00', 'rgba(255,221,0,0)']}
        />
      </SkiaPath>
      {/* Ligne principale */}
      <SkiaPath
        path={linePath}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        strokeJoin="round"
        color="#FFDD00"
      />
    </Canvas>
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

  // Déclenche à chaque 0.5 unité au lieu de chaque entier
  // → mises à jour 2× plus fréquentes, mouvement perçu plus continu
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

// ─── Spark helpers ────────────────────────────────────────────────────────────

const CIRC = 2 * Math.PI * 21 // ≈ 131.9 px (périmètre r=21)
const SPARK_LEN = 9 // longueur du trait en px
const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle)

function useSpark(sparkDelay: number) {
  const dashOffset = useSharedValue(0)
  const sparkOpacity = useSharedValue(0)

  function triggerSpark() {
    cancelAnimation(dashOffset)
    cancelAnimation(sparkOpacity)
    dashOffset.value = 0
    sparkOpacity.value = 0
    // Trait glisse sur la moitié du rebord (12h → 6h) en 2.2s, vitesse constante
    dashOffset.value = withTiming(-(CIRC / 2), { duration: 2200, easing: Easing.linear })
    // Apparaît doucement puis s'efface avant d'arriver
    sparkOpacity.value = withSequence(
      withTiming(0.3, { duration: 400 }),
      withTiming(0.3, { duration: 1100 }),
      withTiming(0, { duration: 700 })
    )
  }

  useEffect(() => {
    const initial = setTimeout(() => triggerSpark(), sparkDelay)
    const interval = setInterval(() => triggerSpark(), 5000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])

  const sparkContainerStyle = useAnimatedStyle(() => ({ opacity: sparkOpacity.value }))
  const animatedCircleProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }))

  return { sparkContainerStyle, animatedCircleProps }
}

function SparkOverlay({
  colors,
  sparkContainerStyle,
  animatedCircleProps,
}: {
  colors: ReturnType<typeof useTheme>['colors']
  sparkContainerStyle: ReturnType<typeof useAnimatedStyle>
  animatedCircleProps: ReturnType<typeof useAnimatedProps>
}) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, sparkContainerStyle]} pointerEvents="none">
      <Svg width={44} height={44}>
        <AnimatedSvgCircle
          cx={22}
          cy={22}
          r={21}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          strokeDasharray={`${SPARK_LEN} ${CIRC - SPARK_LEN}`}
          strokeLinecap="round"
          rotation={-90}
          origin="22, 22"
          animatedProps={animatedCircleProps}
        />
      </Svg>
    </Animated.View>
  )
}

// ─── Follow stat button ───────────────────────────────────────────────────────

function FollowStatButton({
  icon: Icon,
  count,
  label,
  delay,
  colors,
  sparkDelay,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  count: number
  label: string
  delay: number
  colors: ReturnType<typeof useTheme>['colors']
  sparkDelay: number
}) {
  const scale = useSharedValue(1)
  const mountOpacity = useSharedValue(0)
  const translateX = useSharedValue(-18)
  const { sparkContainerStyle, animatedCircleProps } = useSpark(sparkDelay)

  useEffect(() => {
    mountOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
    )
    translateX.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 300 }))
  }, [delay])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
    opacity: mountOpacity.value,
    alignItems: 'center',
  }))

  return (
    <Animated.View style={containerStyle}>
      <Pressable
        accessibilityLabel={label}
        onPressIn={() => {
          scale.value = withSpring(0.78, { damping: 20, stiffness: 600 })
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 200 })
        }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 9999,
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Icon size={18} color={colors.textSecondary} strokeWidth={1.5} />
      </Pressable>
      <SparkOverlay
        colors={colors}
        sparkContainerStyle={sparkContainerStyle}
        animatedCircleProps={animatedCircleProps}
      />
      <Text
        style={{
          fontSize: 11,
          fontVariant: ['tabular-nums'],
          color: colors.textSecondary,
          marginTop: 4,
          letterSpacing: 0.2,
        }}
      >
        {count}
      </Text>
    </Animated.View>
  )
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickActionButton({
  icon: Icon,
  label,
  onPress,
  delay,
  colors,
  sparkDelay,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  label: string
  onPress: () => void
  delay: number
  colors: ReturnType<typeof useTheme>['colors']
  sparkDelay: number
}) {
  const scale = useSharedValue(1)
  const mountOpacity = useSharedValue(0)
  const translateX = useSharedValue(18)
  const { sparkContainerStyle, animatedCircleProps } = useSpark(sparkDelay)

  useEffect(() => {
    mountOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
    )
    translateX.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 300 }))
  }, [delay])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
    opacity: mountOpacity.value,
  }))

  return (
    <Animated.View style={containerStyle}>
      <Pressable
        accessibilityLabel={label}
        onPressIn={() => {
          scale.value = withSpring(0.78, { damping: 20, stiffness: 600 })
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 200 })
        }}
        onPress={onPress}
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.full,
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Icon size={18} color={colors.textSecondary} strokeWidth={1.5} />
      </Pressable>
      <SparkOverlay
        colors={colors}
        sparkContainerStyle={sparkContainerStyle}
        animatedCircleProps={animatedCircleProps}
      />
    </Animated.View>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  const {
    profile,
    stats,
    topPRs,
    followers,
    follows,
    sparklineData,
    historySections,
    refreshing,
    onRefresh,
  } = useProfileData()

  const [deconnexionLoading, setDeconnexionLoading] = useState<boolean>(false)

  async function seDeconnecter(): Promise<void> {
    setDeconnexionLoading(true)
    await supabase.auth.signOut()
    setDeconnexionLoading(false)
    router.replace('/auth/login')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const s = buildStyles(colors)

  const initiale = profile ? getInitiale(profile) : 'O'
  const displayName = profile ? getUsername(profile) : '@athlète'
  const isPro = profile?.plan === 'premium'

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
            {/* Avatar + Nom + Quick actions */}
            <View style={s.headerSection}>
              {/* Gauche : followers + following */}
              <View style={s.leftActionsCol}>
                <FollowStatButton
                  icon={Users}
                  count={followers}
                  label="Followers"
                  delay={100}
                  sparkDelay={2200}
                  colors={colors}
                />
                <FollowStatButton
                  icon={UserPlus}
                  count={follows}
                  label="Follows"
                  delay={180}
                  sparkDelay={3500}
                  colors={colors}
                />
              </View>

              {/* Centre : avatar + identité */}
              <View style={s.avatarBlock}>
                <View style={s.avatarCircle}>
                  <Text style={s.avatarLetter}>{initiale}</Text>
                </View>
                <Text style={s.username}>{displayName}</Text>
                {isPro && (
                  <View style={s.proBadge}>
                    <Text style={s.proBadgeText}>PRO</Text>
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push('/edit-profile')}
                >
                  <Text style={s.editBtnText}>Modifier</Text>
                </Pressable>
              </View>

              {/* Droite : 3 icônes actions rapides */}
              <View style={s.quickActionsCol}>
                <QuickActionButton
                  icon={Shield}
                  label="Armurerie"
                  onPress={() => router.push('/prs')}
                  delay={100}
                  sparkDelay={1800}
                  colors={colors}
                />
                <QuickActionButton
                  icon={TrendingUp}
                  label="Analytics"
                  onPress={() => router.push('/analytics')}
                  delay={180}
                  sparkDelay={3100}
                  colors={colors}
                />
                <QuickActionButton
                  icon={Settings}
                  label="Paramètres"
                  onPress={() => router.push('/settings')}
                  delay={260}
                  sparkDelay={4400}
                  colors={colors}
                />
              </View>
            </View>

            {/* Stats row */}
            <View style={s.statsCard}>
              <View style={s.statHeroRow}>
                <AnimatedCounter
                  target={stats.volumeKg}
                  duration={1400}
                  delay={0}
                  style={s.statValueHero}
                  formatter={formatVolume}
                />
                <Text style={[s.statLabel, s.statLabelAccent]}>KG CE MOIS</Text>
              </View>
              <View style={s.statSepH} />
              <View style={s.statSecondaryRow}>
                <View style={s.statCol}>
                  <AnimatedCounter
                    target={stats.seances}
                    duration={1000}
                    delay={120}
                    style={s.statValueSide}
                  />
                  <Text style={s.statLabel}>SÉANCES</Text>
                </View>
                <View style={s.statSep} />
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
            </View>

            {/* Sparkline */}
            <View style={s.sparklineSection}>
              <Text style={s.sparklineTitle}>8 DERNIÈRES SÉANCES</Text>
              <SparklineRow data={sparklineData} colors={colors} />
            </View>

            {/* Muscle Map */}
            <View style={s.muscleMappingSection}>
              <Text style={s.muscleMappingTitle}>CARTE MUSCULAIRE</Text>
              <View style={s.muscleMappingPlaceholder}>
                <View style={s.muscleMappingBody} />
                <Text style={s.muscleMappingHint}>Visualisation corps bientôt disponible</Text>
              </View>
            </View>

            {/* PRs */}
            <View style={s.prsSection}>
              <Text style={s.prsTitle}>MES PRs</Text>
              {topPRs.length === 0 ? (
                <Text style={s.emptyText}>Aucun record encore. Lance une séance !</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.prsScrollContent}
                >
                  {topPRs.map((pr, idx) => (
                    <View key={idx} style={s.prCard}>
                      <View style={s.prIconRow}>
                        <Text style={s.prExercise} numberOfLines={2}>
                          {pr.exerciseName.toUpperCase()}
                        </Text>
                        {pr.level === 'gold' ? (
                          <Zap
                            size={14}
                            color={colors.prGold}
                            fill={colors.prGold}
                            strokeWidth={0}
                          />
                        ) : (
                          <Flame
                            size={14}
                            color={colors.accent}
                            fill={colors.accent}
                            strokeWidth={0}
                          />
                        )}
                      </View>
                      <Text style={s.prValue}>
                        {pr.value}
                        <Text style={s.prUnit}> kg</Text>
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <Pressable
                style={({ pressed }) => [s.armurerieBtn, pressed && { opacity: 0.7 }]}
                onPress={() => router.push('/prs')}
              >
                <Text style={s.armurerieBtnText}>Voir l'Armurerie →</Text>
              </Pressable>
            </View>

            {/* Historique title */}
            <Text style={[s.sectionTitle, { marginTop: spacing.s8, marginBottom: spacing.s4 }]}>
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
    loader: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerContent: {},
    contentContainer: {
      paddingHorizontal: spacing.s5,
    },
    headerContainer: {
      paddingHorizontal: spacing.s5,
      paddingTop: spacing.s6,
      paddingBottom: spacing.s2,
    },

    // ── Avatar section ──
    headerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.s6,
    },
    avatarBlock: {
      flex: 1,
      alignItems: 'center',
    },
    leftActionsCol: {
      gap: spacing.s3,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: spacing.s4,
    },
    quickActionsCol: {
      gap: spacing.s3,
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: spacing.s4,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.s3,
    },
    avatarLetter: {
      ...typography.display,
      fontFamily: font.black,
      color: colors.background,
    },
    username: {
      ...typography.body,
      color: colors.textPrimary,
      marginBottom: spacing.s2,
      fontFamily: font.bold,
    },
    proBadge: {
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      height: 28,
      paddingHorizontal: spacing.s3,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.s2,
      marginBottom: spacing.s3,
    },
    proBadgeText: {
      ...typography.caption,
      fontFamily: font.bold,
      color: colors.background,
      letterSpacing: 1,
    },
    editBtn: {
      paddingVertical: spacing.s2,
      paddingHorizontal: spacing.s4,
      minHeight: 44,
      justifyContent: 'center',
    },
    editBtnText: {
      ...typography.body,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },

    // ── Stats card ──
    statsCard: {
      flexDirection: 'column',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      paddingVertical: spacing.s5,
      paddingHorizontal: spacing.s4,
      marginBottom: spacing.s6,
    },
    statHeroRow: {
      alignItems: 'center',
      paddingBottom: spacing.s4,
    },
    statSepH: {
      height: 1,
      backgroundColor: colors.separator,
      marginHorizontal: spacing.s4,
      marginBottom: spacing.s4,
    },
    statSecondaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statCol: {
      flex: 1,
      alignItems: 'center',
    },
    statColCenter: {
      flex: 1,
      alignItems: 'center',
    },
    statSep: {
      width: 1,
      height: 40,
      backgroundColor: colors.separator,
    },
    statValueSide: {
      ...typography.display,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    statValueHero: {
      ...typography.hero,
      color: colors.accent,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      marginTop: spacing.s1,
      textAlign: 'center',
    },
    statLabelAccent: {
      color: colors.accent,
    },

    // ── Followers ──
    followersRow: {
      flexDirection: 'row',
      gap: spacing.s4,
      marginBottom: spacing.s6,
    },
    followerCol: {
      flex: 1,
      alignItems: 'center',
      padding: spacing.s4,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      minHeight: 60,
      justifyContent: 'center',
    },
    followerValue: {
      ...typography.display,
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    followerLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      marginTop: spacing.s1,
    },

    // ── Sparkline ──
    sparklineSection: {
      marginBottom: spacing.s6,
    },
    sparklineTitle: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.s3,
    },

    // ── Muscle Mapping ──
    muscleMappingSection: {
      marginBottom: spacing.s6,
    },
    muscleMappingTitle: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.s3,
    },
    muscleMappingPlaceholder: {
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      paddingVertical: spacing.s8,
      paddingHorizontal: spacing.s5,
      alignItems: 'center',
      gap: spacing.s4,
    },
    muscleMappingBody: {
      width: 80,
      height: 160,
      borderRadius: radius.md,
      backgroundColor: colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    muscleMappingHint: {
      ...typography.caption,
      color: colors.textTertiary,
      textAlign: 'center',
    },

    // ── PRs ──
    prsSection: {
      marginBottom: spacing.s6,
    },
    prsTitle: {
      ...typography.subtitle,
      color: colors.textPrimary,
      marginBottom: spacing.s4,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.s4,
    },
    prsScrollContent: {
      gap: spacing.s3,
      paddingRight: spacing.s5,
    },
    prCard: {
      minWidth: 140,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      padding: spacing.s4,
    },
    prIconRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.s2,
    },
    prExercise: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      flex: 1,
      marginRight: spacing.s1,
    },
    prValue: {
      fontSize: 20,
      fontFamily: font.bold,
      color: colors.textPrimary,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    prUnit: {
      fontSize: 14,
      fontFamily: font.regular,
      color: colors.textPrimary,
    },
    armurerieBtn: {
      alignSelf: 'center',
      paddingVertical: spacing.s2,
      marginTop: spacing.s3,
      minHeight: 44,
      justifyContent: 'center',
    },
    armurerieBtnText: {
      ...typography.body,
      color: colors.accent,
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
