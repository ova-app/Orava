/**
 * ORAVA — Session 06
 * app/workout/timer.tsx
 * Timer repos — modal route
 */

import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: '1:00', seconds: 60 },
  { label: '1:30', seconds: 90 },
  { label: '2:00', seconds: 120 },
  { label: '3:00', seconds: 180 },
]

const DEFAULT_SECONDS = 90

// ─── Composant ───────────────────────────────────────────────────────────────

export default function TimerScreen() {
  const [selected, setSelected] = useState(DEFAULT_SECONDS)
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            Vibration.vibrate([0, 300, 150, 300, 150, 500])
            setTimeout(() => router.back(), 1200)
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

  function selectPreset(seconds: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    setSelected(seconds)
    setRemaining(seconds)
  }

  function adjust(delta: number) {
    const next = Math.max(10, remaining + delta)
    setRemaining(next)
    if (!running) setSelected(next)
  }

  function toggle() {
    if (remaining === 0) {
      setRemaining(selected)
      setRunning(true)
    } else {
      setRunning(r => !r)
    }
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = selected > 0 ? remaining / selected : 0
  const isDone = remaining === 0

  return (
    <SafeAreaView style={styles.container}>
      {/* Handle */}
      <View style={styles.handle} />

      <Text style={styles.title}>Repos</Text>

      {/* Presets */}
      <View style={styles.presets}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p.seconds}
            style={[styles.preset, selected === p.seconds && styles.presetActive]}
            onPress={() => selectPreset(p.seconds)}
          >
            <Text style={[styles.presetText, selected === p.seconds && styles.presetTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Adjust + Display */}
      <View style={styles.timerRow}>
        <TouchableOpacity style={styles.adjustBtn} onPress={() => adjust(-15)}>
          <Text style={styles.adjustText}>−15s</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.timerDisplay} onPress={toggle} activeOpacity={0.8}>
          <Text style={[styles.timerText, isDone && styles.timerTextDone]}>
            {formatTime(remaining)}
          </Text>
          <Text style={styles.timerHint}>
            {isDone ? 'Terminé !' : running ? 'Appuyer pour pause' : 'Appuyer pour démarrer'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.adjustBtn} onPress={() => adjust(15)}>
          <Text style={styles.adjustText}>+15s</Text>
        </TouchableOpacity>
      </View>

      {/* Barre de progression */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeBtnText}>Fermer</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 28,
  },
  presets: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 48,
  },
  preset: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  presetActive: {
    backgroundColor: '#D85A3022',
    borderColor: '#D85A30',
  },
  presetText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#D85A30',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 40,
  },
  adjustBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
  },
  adjustText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  timerDisplay: {
    alignItems: 'center',
    minWidth: 130,
  },
  timerText: {
    color: '#fff',
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timerTextDone: {
    color: '#D85A30',
  },
  timerHint: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 40,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D85A30',
    borderRadius: 2,
  },
  closeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
