import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  AppStateStatus,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import Svg, { Circle } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, font } from '@/constants/theme'

const PRESETS = [
  { label: '30s',  value: 30  },
  { label: '1min', value: 60  },
  { label: '1:30', value: 90  },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
]

const ARC_DIAMETER = 280
const RADIUS_CIRCLE = 120
const CIRCUMFERENCE = 2 * Math.PI * RADIUS_CIRCLE

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

export default function TimerScreen() {
  const router = useRouter()
  const { colors } = useTheme()

  const [preset, setPreset] = useState<number>(90)
  const [remaining, setRemaining] = useState<number>(90)
  const [paused, setPaused] = useState<boolean>(false)
  const [finished, setFinished] = useState<boolean>(false)

  const totalRef = useRef<number>(90)
  const startTimeRef = useRef<number>(Date.now())
  const pausedAtRef = useRef<number | null>(null)
  const pausedElapsedRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  const overlayOpacity = useRef(new Animated.Value(0)).current

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const triggerFinish = useCallback(() => {
    setFinished(true)
    clearTick()
    setRemaining(0)
    try { Vibration.vibrate(400) } catch (_) {}
    Animated.sequence([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1200),
    ]).start(() => {
      router.back()
    })
  }, [clearTick, overlayOpacity, router])

  const startTick = useCallback((fromRemaining: number) => {
    clearTick()
    startTimeRef.current = Date.now()
    pausedElapsedRef.current = totalRef.current - fromRemaining

    intervalRef.current = setInterval(() => {
      const elapsed = pausedElapsedRef.current + (Date.now() - startTimeRef.current) / 1000
      const next = totalRef.current - elapsed
      if (next <= 0) {
        triggerFinish()
      } else {
        setRemaining(next)
      }
    }, 100)
  }, [clearTick, triggerFinish])

  useEffect(() => {
    AsyncStorage.getItem('timer_default_preset').then(saved => {
      const value = saved ? parseInt(saved, 10) : 90
      const valid = PRESETS.find(p => p.value === value)?.value ?? 90
      setPreset(valid)
      setRemaining(valid)
      totalRef.current = valid
      startTick(valid)
    })

    return () => clearTick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        if (!paused && !finished) {
          const elapsed = pausedElapsedRef.current + (Date.now() - startTimeRef.current) / 1000
          const next = totalRef.current - elapsed
          if (next <= 0) {
            triggerFinish()
          } else {
            setRemaining(next)
            startTick(next)
          }
        }
      }
      appStateRef.current = nextState
    })
    return () => sub.remove()
  }, [paused, finished, startTick, triggerFinish])

  const handleTogglePause = useCallback(() => {
    if (finished) return
    if (paused) {
      setPaused(false)
      startTick(remaining)
    } else {
      clearTick()
      pausedAtRef.current = Date.now()
      setPaused(true)
    }
  }, [finished, paused, remaining, startTick, clearTick])

  const handlePreset = useCallback((value: number) => {
    clearTick()
    setFinished(false)
    setPreset(value)
    setRemaining(value)
    setPaused(false)
    totalRef.current = value
    pausedElapsedRef.current = 0
    AsyncStorage.setItem('timer_default_preset', String(value))
    startTick(value)
  }, [clearTick, startTick])

  const progress = totalRef.current > 0 ? remaining / totalRef.current : 0
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerLabel, { color: colors.textSecondary }]}>REPOS</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.flex} />

      <TouchableOpacity
        onPress={handleTogglePause}
        activeOpacity={0.9}
        style={styles.arcWrapper}
      >
        <Svg
          width={ARC_DIAMETER}
          height={ARC_DIAMETER}
          style={styles.svg}
        >
          <Circle
            cx={ARC_DIAMETER / 2}
            cy={ARC_DIAMETER / 2}
            r={RADIUS_CIRCLE}
            stroke={colors.accent}
            strokeOpacity={0.1}
            strokeWidth={6}
            fill="none"
          />
          <Circle
            cx={ARC_DIAMETER / 2}
            cy={ARC_DIAMETER / 2}
            r={RADIUS_CIRCLE}
            stroke={colors.accent}
            strokeWidth={6}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${ARC_DIAMETER / 2}, ${ARC_DIAMETER / 2}`}
          />
        </Svg>

        <View style={styles.arcCenter} pointerEvents="none">
          <Text
            style={[styles.timerText, { color: colors.accent }]}
            suppressHighlighting
          >
            {formatTime(remaining)}
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={[styles.stateLabel, { color: colors.textTertiary }]}>
        {paused && !finished ? 'En pause' : ''}
      </Text>

      <View style={styles.flex} />

      <View style={styles.presetsRow}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p.value}
            onPress={() => handlePreset(p.value)}
            style={[
              styles.chip,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: preset === p.value ? colors.accent : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                { color: preset === p.value ? colors.accent : colors.textSecondary },
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomSpacer} />

      {finished && (
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: colors.background, opacity: overlayOpacity },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.overlayText, { color: colors.accent }]}>REPOS TERMINÉ</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s2,
    paddingBottom: spacing.s2,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    ...typography.caption,
    letterSpacing: 1.5,
  },
  arcWrapper: {
    width: ARC_DIAMETER,
    height: ARC_DIAMETER,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  arcCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 80,
    fontFamily: font.mono,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    lineHeight: 88,
  },
  stateLabel: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.s3,
    letterSpacing: 0.4,
    height: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.s2,
    paddingHorizontal: spacing.s4,
  },
  chip: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 52,
    alignItems: 'center',
  },
  chipLabel: {
    ...typography.caption,
    letterSpacing: 0.4,
  },
  bottomSpacer: {
    height: spacing.s8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    fontSize: 24,
    fontFamily: font.black,
    letterSpacing: 3,
  },
})
