import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography } from '@/constants/theme'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  username: string | null
  full_name: string | null
  plan: 'free' | 'premium'
  avatar_url: string | null
}

interface MonthStats {
  seances: number
  volumeKg: number
  streakSemaines: number
}

interface TopPR {
  exerciseName: string
  prType: 'charge' | 'serie'
  value: number
  unit: string
  level: 'gold' | 'silver' | 'bronze'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitiale(profile: UserProfile): string {
  const src = profile.full_name ?? profile.username ?? 'O'
  return src.charAt(0).toUpperCase()
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`
  return `${Math.round(kg)}`
}

const PR_LABEL: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: 'Or',
  silver: 'Argent',
  bronze: 'Bronze',
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileScreen(): React.JSX.Element {
  const { colors } = useTheme()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<MonthStats>({ seances: 0, volumeKg: 0, streakSemaines: 0 })
  const [topPRs, setTopPRs] = useState<TopPR[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [deconnexionLoading, setDeconnexionLoading] = useState<boolean>(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/auth/login')
      return
    }

    const { data: profileData } = await supabase
      .from('users')
      .select('id, username, full_name, plan, avatar_url')
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData as UserProfile)
    }

    // Séances + volume ce mois
    const debutMois = new Date()
    debutMois.setDate(1)
    debutMois.setHours(0, 0, 0, 0)

    const { data: workoutsData } = await supabase
      .from('workouts')
      .select('id, total_volume_kg, started_at')
      .eq('user_id', user.id)
      .gte('started_at', debutMois.toISOString())
      .order('started_at', { ascending: false })

    const seances = workoutsData?.length ?? 0
    const volumeKg = workoutsData?.reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0) ?? 0

    // Streak semaines : workout_metrics.data.streak_semaines depuis la dernière séance
    let streakSemaines = 0
    if (workoutsData && workoutsData.length > 0) {
      const { data: metricsData } = await supabase
        .from('workout_metrics')
        .select('data')
        .eq('workout_id', workoutsData[0].id)
        .single()

      if (metricsData?.data && typeof metricsData.data === 'object') {
        const d = metricsData.data as Record<string, unknown>
        streakSemaines = typeof d.streak_semaines === 'number' ? d.streak_semaines : 0
      }
    }

    setStats({ seances, volumeKg, streakSemaines })

    // Top PRs — 3 records charge les plus récents
    const { data: setsData } = await supabase
      .from('workout_sets')
      .select(`
        id, weight_kg, reps, pr_charge, pr_serie,
        workout_exercises!inner(
          exercise_id,
          exercises!inner(name_fr)
        )
      `)
      .eq('workout_exercises.workouts.user_id', user.id)
      .not('pr_charge', 'is', null)
      .order('weight_kg', { ascending: false })
      .limit(10)

    if (setsData) {
      const prs: TopPR[] = setsData
        .filter(s => s.pr_charge !== null)
        .slice(0, 3)
        .map(s => {
          const ex = (s.workout_exercises as { exercises: { name_fr: string } }).exercises
          return {
            exerciseName: ex.name_fr,
            prType: 'charge' as const,
            value: s.weight_kg ?? 0,
            unit: 'kg',
            level: (s.pr_charge ?? 'bronze') as 'gold' | 'silver' | 'bronze',
          }
        })
      setTopPRs(prs)
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  async function seDeconnecter(): Promise<void> {
    setDeconnexionLoading(true)
    await supabase.auth.signOut()
    setDeconnexionLoading(false)
    router.replace('/auth/login')
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const s = buildStyles(colors)

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  const initiale = profile ? getInitiale(profile) : 'O'
  const displayName = profile?.full_name ?? profile?.username ?? 'Athlète'
  const isPro = profile?.plan === 'premium'

  return (
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + Nom ── */}
        <View style={s.headerSection}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>{initiale}</Text>
          </View>

          <View style={s.nameRow}>
            <Text style={s.username}>{displayName}</Text>
            {isPro && (
              <View style={s.proBadge}>
                <Text style={s.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Hero Stats ── */}
        <View style={s.statsCard}>
          <View style={s.statCol}>
            <Text
              style={s.statValue}
              accessibilityLabel={`${stats.seances} séances ce mois`}
            >
              {stats.seances}
            </Text>
            <Text style={s.statLabel}>SÉANCES</Text>
          </View>

          <View style={s.statSep} />

          <View style={s.statCol}>
            <Text
              style={[s.statValue, s.statValueAccent]}
              accessibilityLabel={`${formatVolume(stats.volumeKg)} kilogrammes ce mois`}
            >
              {formatVolume(stats.volumeKg)}
            </Text>
            <Text style={s.statLabel}>KG CE MOIS</Text>
          </View>

          <View style={s.statSep} />

          <View style={s.statCol}>
            <Text
              style={s.statValue}
              accessibilityLabel={`${stats.streakSemaines} semaines de streak`}
            >
              {stats.streakSemaines}
            </Text>
            <Text style={s.statLabel}>STREAK SEM.</Text>
          </View>
        </View>

        {/* ── PRs ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MES PRs</Text>

          {topPRs.length === 0 ? (
            <Text style={s.emptyText}>Aucun record encore. Lance une séance !</Text>
          ) : (
            <View style={s.prsRow}>
              {topPRs.map((pr, idx) => {
                const levelColor =
                  pr.level === 'gold'
                    ? colors.prGold
                    : pr.level === 'silver'
                    ? colors.prSilver
                    : colors.prBronze

                return (
                  <View key={idx} style={s.prCard}>
                    <Text style={s.prExercise} numberOfLines={2}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={[s.prValue, { color: levelColor }]} accessibilityLabel={`${pr.value} ${pr.unit}`}>
                      {pr.value}
                      <Text style={s.prUnit}> {pr.unit}</Text>
                    </Text>
                    <Text style={[s.prLevel, { color: levelColor }]}>
                      {PR_LABEL[pr.level].toUpperCase()}
                    </Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* ── Lien Armurerie ── */}
        <Pressable
          style={({ pressed }) => [s.armurerieBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/prs')}
          accessibilityRole="button"
          accessibilityLabel="Voir tous mes records"
        >
          <Text style={s.armurerieBtnText}>Voir tous mes records →</Text>
        </Pressable>

        {/* ── Spacer ── */}
        <View style={s.bottomSpacer} />
      </ScrollView>

      {/* ── Déconnexion ── */}
      <Pressable
        style={({ pressed }) => [s.deconnexionBtn, pressed && { opacity: 0.6 }]}
        onPress={() => void seDeconnecter()}
        disabled={deconnexionLoading}
        accessibilityRole="button"
        accessibilityLabel="Se déconnecter"
      >
        {deconnexionLoading ? (
          <ActivityIndicator color={colors.textTertiary} size="small" />
        ) : (
          <Text style={s.deconnexionText}>Déconnexion</Text>
        )}
      </Pressable>
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
      paddingTop: 64,
      paddingHorizontal: spacing.s6,
      paddingBottom: spacing.s12,
    },

    // Avatar
    headerSection: {
      alignItems: 'center',
      marginBottom: spacing.s8,
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.backgroundTertiary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.s3,
    },
    avatarLetter: {
      fontSize: 32,
      fontFamily: 'Barlow_700Bold',
      color: colors.accent,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s2,
    },
    username: {
      ...typography.subtitle,
      fontFamily: 'Barlow_700Bold',
      color: colors.textPrimary,
    },
    proBadge: {
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      paddingVertical: 2,
      paddingHorizontal: spacing.s2,
    },
    proBadgeText: {
      ...typography.caption,
      fontFamily: 'Barlow_700Bold',
      color: colors.background,
      letterSpacing: 0.8,
    },

    // Stats card
    statsCard: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.lg,
      padding: spacing.s5,
      marginBottom: spacing.s8,
    },
    statCol: {
      flex: 1,
      alignItems: 'center',
    },
    statSep: {
      width: 1,
      backgroundColor: colors.separator,
    },
    statValue: {
      fontSize: 40,
      fontFamily: 'Barlow_800ExtraBold',
      color: colors.textPrimary,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    statValueAccent: {
      color: colors.accent,
    },
    statLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: spacing.s1,
      textAlign: 'center',
    },

    // Section
    section: {
      marginBottom: spacing.s8,
    },
    sectionTitle: {
      ...typography.subtitle,
      fontFamily: 'Barlow_700Bold',
      color: colors.textPrimary,
      marginBottom: spacing.s4,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    prsRow: {
      flexDirection: 'row',
      gap: spacing.s3,
    },
    prCard: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: radius.md,
      padding: spacing.s3,
      alignItems: 'center',
    },
    prExercise: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.s2,
    },
    prValue: {
      fontSize: 24,
      fontFamily: 'Barlow_800ExtraBold',
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    },
    prUnit: {
      fontSize: 12,
      fontFamily: 'Barlow_400Regular',
    },
    prLevel: {
      ...typography.caption,
      letterSpacing: 1,
      marginTop: spacing.s1,
      textTransform: 'uppercase',
    },

    // Lien armurerie
    armurerieBtn: {
      alignItems: 'center',
      paddingVertical: spacing.s3,
      minHeight: 44,
      justifyContent: 'center',
    },
    armurerieBtnText: {
      ...typography.body,
      color: colors.textSecondary,
    },

    bottomSpacer: {
      height: spacing.s12,
    },

    // Déconnexion
    deconnexionBtn: {
      alignItems: 'center',
      paddingVertical: spacing.s4,
      paddingBottom: spacing.s8,
      minHeight: 52,
      justifyContent: 'center',
    },
    deconnexionText: {
      ...typography.body,
      color: colors.textTertiary,
    },
  })
}
