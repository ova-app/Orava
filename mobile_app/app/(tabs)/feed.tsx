import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Heart, MessageCircle } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography } from '@/constants/theme'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeedWorkout {
  id: string
  title: string
  total_volume_kg: number | null
  started_at: string
  pr_seance: 'gold' | 'silver' | 'bronze' | null
  user: {
    id: string
    username: string | null
    full_name: string | null
  }
  likes_count: number
  comments_count: number
  user_has_liked: boolean
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  const { colors } = useTheme()
  const anim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [anim])

  return (
    <Animated.View
      style={[
        styles.row,
        {
          backgroundColor: colors.backgroundSecondary,
          opacity: anim,
          marginBottom: 4,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: '50%', height: 12, borderRadius: 4, backgroundColor: colors.backgroundTertiary }} />
        <View style={{ width: '30%', height: 10, borderRadius: 4, backgroundColor: colors.backgroundTertiary }} />
      </View>
    </Animated.View>
  )
}

// ─── Feed item ────────────────────────────────────────────────────────────────

interface FeedItemProps {
  item: FeedWorkout
  currentUserId: string | null
  onLike: (workoutId: string, hasLiked: boolean) => void
}

function FeedItem({ item, currentUserId, onLike }: FeedItemProps) {
  const { colors } = useTheme()

  const displayName = item.user.username ?? item.user.full_name ?? '?'
  const initial = displayName.charAt(0).toUpperCase()

  const volumeFormatted =
    item.total_volume_kg != null
      ? `${Math.round(item.total_volume_kg)} kg`
      : '—'

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
      {/* Row principale */}
      <View style={styles.row}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]}>
          <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
            {initial}
          </Text>
        </View>

        {/* Centre */}
        <View style={{ flex: 1, paddingHorizontal: spacing.s3 }}>
          <Text
            style={[typography.body, { color: colors.textPrimary, fontFamily: 'Barlow_700Bold' }]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>

        {/* Right : placeholder Myo + volume */}
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.accent,
              opacity: 0.3,
            }}
          />
          <Text style={[typography.caption, { color: colors.accent, fontVariant: ['tabular-nums'] }]}>
            {volumeFormatted}
          </Text>
        </View>
      </View>

      {/* Barre likes/comments */}
      <View style={[styles.likeBar, { borderTopColor: colors.separator }]}>
        <TouchableOpacity
          style={styles.likeBtn}
          onPress={() => onLike(item.id, item.user_has_liked)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Heart
            size={16}
            color={item.user_has_liked ? colors.error : colors.textTertiary}
            fill={item.user_has_liked ? colors.error : 'transparent'}
          />
          <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 4 }]}>
            {item.likes_count}
          </Text>
        </TouchableOpacity>

        <View style={styles.likeBtn}>
          <MessageCircle size={16} color={colors.textTertiary} />
          <Text style={[typography.caption, { color: colors.textTertiary, marginLeft: 4 }]}>
            {item.comments_count}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const { colors } = useTheme()
  const [workouts, setWorkouts] = useState<FeedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ─── Auth ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFeed = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser()
    const uid = authData.user?.id
    if (!uid) return

    // Workouts publics — fetch principal sans count inline (évite ambiguïté types Supabase v2)
    const { data, error } = await supabase
      .from('workouts')
      .select(`
        id,
        title,
        total_volume_kg,
        started_at,
        pr_seance,
        user:user_id (
          id,
          username,
          full_name
        )
      `)
      .eq('is_public', true)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error || !data) return

    type RawWorkout = {
      id: string
      title: string
      total_volume_kg: number | null
      started_at: string
      pr_seance: 'gold' | 'silver' | 'bronze' | null
      user: { id: string; username: string | null; full_name: string | null } | null
    }

    const workoutIds = (data as RawWorkout[]).map(w => w.id)

    // Counts likes + comments par workout
    const [likesRes, commentsRes, userLikesRes] = await Promise.all([
      supabase.from('likes').select('workout_id').in('workout_id', workoutIds),
      supabase.from('comments').select('workout_id').in('workout_id', workoutIds),
      supabase.from('likes').select('workout_id').eq('user_id', uid).in('workout_id', workoutIds),
    ])

    const likesCount = new Map<string, number>()
    const commentsCount = new Map<string, number>()
    for (const r of likesRes.data ?? []) {
      const id = (r as { workout_id: string }).workout_id
      likesCount.set(id, (likesCount.get(id) ?? 0) + 1)
    }
    for (const r of commentsRes.data ?? []) {
      const id = (r as { workout_id: string }).workout_id
      commentsCount.set(id, (commentsCount.get(id) ?? 0) + 1)
    }
    const likedSet = new Set(
      (userLikesRes.data ?? []).map((l: { workout_id: string }) => l.workout_id)
    )

    const mapped: FeedWorkout[] = (data as RawWorkout[]).map(w => ({
      id: w.id,
      title: w.title ?? '—',
      total_volume_kg: w.total_volume_kg,
      started_at: w.started_at,
      pr_seance: w.pr_seance,
      user: w.user ?? { id: '', username: null, full_name: null },
      likes_count: likesCount.get(w.id) ?? 0,
      comments_count: commentsCount.get(w.id) ?? 0,
      user_has_liked: likedSet.has(w.id),
    }))

    setWorkouts(mapped)
  }, [])

  useEffect(() => {
    fetchFeed().finally(() => setLoading(false))
  }, [fetchFeed])

  // ─── Pull to refresh ────────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchFeed()
    setRefreshing(false)
  }, [fetchFeed])

  // ─── Like toggle ────────────────────────────────────────────────────────────

  const handleLike = useCallback(async (workoutId: string, hasLiked: boolean) => {
    if (!currentUserId) return

    // Optimistic update
    setWorkouts(prev =>
      prev.map(w =>
        w.id === workoutId
          ? {
              ...w,
              user_has_liked: !hasLiked,
              likes_count: hasLiked ? w.likes_count - 1 : w.likes_count + 1,
            }
          : w
      )
    )

    if (hasLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', currentUserId)
        .eq('workout_id', workoutId)
    } else {
      await supabase
        .from('likes')
        .insert({ user_id: currentUserId, workout_id: workoutId })
    }
  }, [currentUserId])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Text style={[typography.title, { color: colors.textPrimary, paddingHorizontal: spacing.s5, paddingTop: spacing.s12, paddingBottom: spacing.s4 }]}>
        Feed
      </Text>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.s5, paddingTop: spacing.s2 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={item => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.s5,
            paddingBottom: spacing.s12,
          }}
          ItemSeparatorComponent={() => null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          renderItem={({ item }) => (
            <FeedItem
              item={item}
              currentUserId={currentUserId}
              onLike={handleLike}
            />
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={[typography.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
                Ton feed est vide.
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderRadius: radius.md,
    marginBottom: 4,
    overflow: 'hidden',
  },
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBar: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
    gap: spacing.s5,
    borderTopWidth: 1,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empty: {
    paddingTop: spacing.s12,
    paddingHorizontal: spacing.s6,
    alignItems: 'center',
  },
})
