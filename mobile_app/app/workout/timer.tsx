import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration,
  AppState, AppStateStatus, TextInput,
} from 'react-native'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../../context/ThemeContext'

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '45s', seconds: 45 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2min', seconds: 120 },
  { label: '3min', seconds: 180 },
]

const FACTORY_DEFAULT = 90

// ─── Composant ───────────────────────────────────────────────────────────────

export default function TimerScreen() {
  const { colors, themeName } = useTheme()
  const [selected, setSelected] = useState(FACTORY_DEFAULT)
  const [remaining, setRemaining] = useState(FACTORY_DEFAULT)
  const [running, setRunning] = useState(false)
  const [customMin, setCustomMin] = useState('')
  const [customSec, setCustomSec] = useState('')

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimestampRef = useRef<number | null>(null)
  const startRemainingRef = useRef<number>(FACTORY_DEFAULT)
  const runningRef = useRef(false)
  runningRef.current = running

  // Read default from AsyncStorage and auto-start
  useEffect(() => {
    AsyncStorage.getItem('default_rest').then(value => {
      if (!value || value === 'disabled') return
      const secs = parseInt(value, 10)
      if (!isNaN(secs) && secs > 0) {
        setSelected(secs)
        setRemaining(secs)
        setRunning(true)
      }
    })
  }, [])

  // Countdown interval
  useEffect(() => {
    if (running) {
      startTimestampRef.current = Date.now()
      startRemainingRef.current = remaining
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            Vibration.vibrate([0, 300, 150, 300, 150, 500])
            setTimeout(() => router.back(), 1000)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  // Background resilience
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && runningRef.current && startTimestampRef.current !== null) {
        const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000)
        const newRemaining = Math.max(0, startRemainingRef.current - elapsed)
        setRemaining(newRemaining)
        startTimestampRef.current = Date.now()
        startRemainingRef.current = newRemaining
        if (newRemaining === 0) {
          setRunning(false)
          Vibration.vibrate([0, 300, 150, 300, 150, 500])
          setTimeout(() => router.back(), 1000)
        }
      }
    })
    return () => sub.remove()
  }, [])

  function selectPreset(seconds: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    setSelected(seconds)
    setRemaining(seconds)
    setTimeout(() => setRunning(true), 50)
  }

  function togglePause() {
    if (remaining === 0) return
    if (running) {
      // Pause: record how much time is left
      startRemainingRef.current = remaining
      setRunning(false)
    } else {
      // Resume
      setRunning(true)
    }
  }

  function applyCustom() {
    const m = parseInt(customMin || '0', 10)
    const s = parseInt(customSec || '0', 10)
    const total = (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s)
    if (total <= 0) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    setSelected(total)
    setRemaining(total)
    setCustomMin('')
    setCustomSec('')
    setTimeout(() => setRunning(true), 50)
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const isDone = remaining === 0
  const textColor = isDone ? colors.accent : colors.textPrimary

  return (
    <View style={[styles.overlay, { backgroundColor: themeName === 'dark' ? 'rgba(0,0,0,0.95)' : colors.background }]}>
      {/* Handle */}
      <View style={[styles.handle, { backgroundColor: colors.separator }]} />

      <Text style={[styles.title, { color: colors.textPrimary }]}>Repos</Text>

      {/* Main circle */}
      <View style={styles.circleContainer}>
        <View style={[styles.circleOuter, { borderColor: colors.backgroundSecondary }]}>
          <View style={[styles.circleInner, {
            borderColor: isDone ? colors.accent : colors.accent,
            opacity: isDone ? 0.3 : 1,
          }]} />
          <View style={styles.circleContent}>
            <Text style={[styles.timerText, { color: textColor }]}>
              {formatTime(remaining)}
            </Text>
            <Text style={[styles.timerHint, { color: colors.textSecondary }]}>
              {isDone ? 'Terminé !' : running ? 'En cours' : 'Pausé'}
            </Text>
          </View>
        </View>
      </View>

      {/* Pause / Reprendre button — prominent orange */}
      {!isDone && (
        <TouchableOpacity
          style={[styles.pauseBtn, { backgroundColor: running ? colors.accent : colors.backgroundSecondary }]}
          onPress={togglePause}
          activeOpacity={0.85}
        >
          <Text style={[styles.pauseBtnText, { color: running ? '#fff' : colors.textPrimary }]}>
            {running ? '⏸  Pause' : '▶  Reprendre'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Presets */}
      <View style={styles.presets}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p.seconds}
            style={[
              styles.preset,
              { backgroundColor: colors.card, borderColor: colors.separator },
              selected === p.seconds && { backgroundColor: colors.accent + '22', borderColor: colors.accent },
            ]}
            onPress={() => selectPreset(p.seconds)}
          >
            <Text style={[
              styles.presetText,
              { color: selected === p.seconds ? colors.accent : colors.textSecondary },
              selected === p.seconds && { fontWeight: '700' },
            ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom duration input */}
      <View style={[styles.customRow, { backgroundColor: colors.card, borderColor: colors.separator }]}>
        <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Durée custom</Text>
        <View style={styles.customInputs}>
          <TextInput
            style={[styles.customInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.separator }]}
            value={customMin}
            onChangeText={v => setCustomMin(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={[styles.customSep, { color: colors.textSecondary }]}>min</Text>
          <TextInput
            style={[styles.customInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.separator }]}
            value={customSec}
            onChangeText={v => setCustomSec(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={[styles.customSep, { color: colors.textSecondary }]}>sec</Text>
        </View>
        <TouchableOpacity
          style={[styles.customOkBtn, { backgroundColor: colors.accent }, (!customMin && !customSec) && styles.customOkDisabled]}
          onPress={applyCustom}
          disabled={!customMin && !customSec}
        >
          <Text style={styles.customOkText}>OK</Text>
        </TouchableOpacity>
      </View>

      {/* Stop button */}
      <TouchableOpacity
        style={[styles.stopBtn, { backgroundColor: colors.card }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.stopBtnText, { color: colors.textSecondary }]}>Arrêter</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 32,
    letterSpacing: 0.3,
  },
  circleContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInner: {
    position: 'absolute',
    width: 204,
    height: 204,
    borderRadius: 102,
    borderWidth: 4,
  },
  circleContent: {
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timerHint: {
    fontSize: 13,
  },
  pauseBtn: {
    width: '100%',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pauseBtnText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  presets: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customRow: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  customLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  customInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customInput: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  customSep: {
    fontSize: 12,
  },
  customOkBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  customOkDisabled: { opacity: 0.4 },
  customOkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stopBtn: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  stopBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
