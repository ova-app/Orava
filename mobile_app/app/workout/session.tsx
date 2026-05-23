import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Timer, Plus, Trash2, X, Search, Zap, Flame, Trophy } from 'lucide-react-native'
import { useTheme } from '@/context/ThemeContext'
import { spacing, radius, typography, touchTarget } from '@/constants/theme'
import {
  useWorkout,
  computePodium,
  WorkoutExercise,
  WorkoutSet,
  PrLevel,
} from '@/context/WorkoutContext'
import { storage } from '@/lib/storage'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseRow {
  id: string
  name_fr: string
  muscle_group: string | null
  equipment_type: string | null
}

interface PrFlash {
  level: 'gold' | 'silver' | 'bronze'
  label: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 60
const VISIBLE_ITEMS = 3
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS

const REPS_VALUES = Array.from({ length: 50 }, (_, i) => i + 1)

function getWeightValues(equipType: string | null): number[] {
  if (equipType === 'bodyweight') return []
  if (equipType === 'dumbbell') return Array.from({ length: 30 }, (_, i) => (i + 1) * 2)
  if (equipType === 'barbell') return [20, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220]
  if (equipType === 'kettlebell') return Array.from({ length: 12 }, (_, i) => (i + 1) * 4)
  return Array.from({ length: 80 }, (_, i) => (i + 1) * 2.5)
}

function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function snapshotToMMKV(
  exercises: WorkoutExercise[],
  currentIndex: number,
  startedAt: Date | null,
): void {
  storage.set(
    'workout_session_draft',
    JSON.stringify({ exercises, currentIndex, startedAt: startedAt?.toISOString() ?? null }),
  )
}

function prLevelColor(level: PrLevel, colors: ReturnType<typeof useTheme>['colors']): string {
  if (level === 'gold') return colors.prGold
  if (level === 'silver') return colors.prSilver
  if (level === 'bronze') return colors.prBronze
  return colors.textSecondary
}

function bestPrLevel(a: PrLevel, b: PrLevel): PrLevel {
  const rank = (l: PrLevel) => (l === 'gold' ? 3 : l === 'silver' ? 2 : l === 'bronze' ? 1 : 0)
  return rank(a) >= rank(b) ? a : b
}

// ─── WheelPicker ─────────────────────────────────────────────────────────────

interface WheelPickerProps {
  values: number[]
  selectedValue: number
  onValueChange: (val: number) => void
  unit?: string
}

function WheelPicker({ values, selectedValue, onValueChange, unit }: WheelPickerProps) {
  const { colors } = useTheme()
  const scrollRef = useRef<ScrollView>(null)
  const selectedIndex = values.indexOf(selectedValue)
  const currentIndex = selectedIndex === -1 ? 0 : selectedIndex

  useEffect(() => {
    if (scrollRef.current && values.length > 0) {
      scrollRef.current.scrollTo({ y: currentIndex * ITEM_HEIGHT, animated: false })
    }
  }, []) // scroll to initial position on mount only

  const snapOffsets = useMemo(
    () => values.map((_, i) => i * ITEM_HEIGHT),
    [values],
  )

  function handleMomentumScrollEnd(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(idx, values.length - 1))
    onValueChange(values[clamped])
  }

  function handleScrollEndDrag(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(idx, values.length - 1))
    onValueChange(values[clamped])
  }

  if (values.length === 0) {
    return (
      <View style={[styles.pickerContainer, { height: PICKER_HEIGHT }]}>
        <View style={styles.pickerCenterHighlight} />
        <View style={styles.pickerCenterItem}>
          <Text style={[styles.pickerItemSelected, { color: colors.textSecondary }]}>—</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.pickerContainer, { height: PICKER_HEIGHT }]}>
      <View style={[styles.pickerCenterHighlight, { borderColor: colors.border }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        scrollEventThrottle={16}
      >
        {values.map((val, idx) => {
          const dist = Math.abs(idx - currentIndex)
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : 0.2
          const isSelected = idx === currentIndex
          return (
            <View key={val} style={styles.pickerItem}>
              <Text
                style={[
                  isSelected ? styles.pickerItemSelected : styles.pickerItemNormal,
                  { color: colors.textPrimary, opacity },
                ]}
              >
                {val}
                {unit && isSelected ? (
                  <Text style={[styles.pickerUnit, { color: colors.textSecondary }]}> {unit}</Text>
                ) : null}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ─── SetRow (swipe delete) ────────────────────────────────────────────────────

interface SetRowProps {
  set: WorkoutSet
  onDelete: () => void
  colors: ReturnType<typeof useTheme>['colors']
}

function SetRow({ set, onDelete, colors }: SetRowProps) {
  const translateX = useRef(new Animated.Value(0)).current
  const THRESHOLD = 80

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dy) < 20,
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) translateX.setValue(g.dx)
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -THRESHOLD) {
            Animated.spring(translateX, { toValue: -300, useNativeDriver: true, ...{ damping: 20, stiffness: 600 } }).start(() => onDelete())
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, ...{ damping: 20, stiffness: 600 } }).start()
          }
        },
      }),
    [onDelete, translateX],
  )

  const prLevel = bestPrLevel(set.pr_charge, set.pr_serie)
  const prColor = prLevelColor(prLevel, colors)

  return (
    <View style={styles.setRowWrapper}>
      <View style={[styles.setRowDeleteBg, { backgroundColor: colors.error }]}>
        <Trash2 size={20} color="#fff" />
      </View>
      <Animated.View
        style={[styles.setRowContent, { backgroundColor: colors.backgroundSecondary, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Text style={[styles.setRowLabel, { color: colors.textSecondary }]}>
          Set {set.set_number}
        </Text>
        <Text style={[styles.setRowValue, { color: colors.textPrimary }]} numberOfLines={1}>
          {set.weight_kg > 0 ? `${set.weight_kg} kg × ${set.reps}` : `${set.reps} reps`}
        </Text>
        {prLevel !== null && (
          <View style={[styles.prBadge, { borderColor: prColor }]}>
            {prLevel === 'gold' || prLevel === 'silver' ? (
              <Zap size={10} color={prColor} />
            ) : (
              <Flame size={10} color={prColor} />
            )}
            <Text style={[styles.prBadgeText, { color: prColor }]}>
              {prLevel === 'gold' ? 'PR' : prLevel === 'silver' ? '2e' : '3e'}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

// ─── ExerciseModal ────────────────────────────────────────────────────────────

interface ExerciseModalProps {
  visible: boolean
  onClose: () => void
  onSelect: (ex: ExerciseRow) => void
  colors: ReturnType<typeof useTheme>['colors']
}

function ExerciseModal({ visible, onClose, onSelect, colors }: ExerciseModalProps) {
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const MUSCLE_GROUPS = useMemo(
    () => ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischio_jambiers', 'fessiers', 'mollets', 'abdominaux'],
    [],
  )
  const MUSCLE_LABELS: Record<string, string> = {
    pectoraux: 'Pecs', dos: 'Dos', epaules: 'Épaules', biceps: 'Biceps',
    triceps: 'Triceps', quadriceps: 'Quads', ischio_jambiers: 'IJ',
    fessiers: 'Fessiers', mollets: 'Mollets', abdominaux: 'Core',
  }

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 300 }).start()
      fetchExercises()
    } else {
      Animated.spring(slideAnim, { toValue: Dimensions.get('window').height, useNativeDriver: true, damping: 20, stiffness: 600 }).start()
      setSearch('')
      setFilter(null)
    }
  }, [visible])

  async function fetchExercises() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('exercises')
        .select('id, name_fr, muscle_group, equipment_type')
        .order('name_fr')
      if (data) setExercises(data as ExerciseRow[])
    } finally {
      setLoading(false)
    }
  }

  const normalizeNFD = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const filtered = useMemo(() => {
    let list = exercises
    if (filter) list = list.filter(e => e.muscle_group === filter)
    if (search.trim()) {
      const q = normalizeNFD(search.trim())
      list = list.filter(e => normalizeNFD(e.name_fr).includes(q))
    }
    return list
  }, [exercises, search, filter])

  if (!visible) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.modalSheet,
          { backgroundColor: colors.backgroundTertiary, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <View style={[styles.modalHeader, { borderBottomColor: colors.separator }]}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Exercice</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchRow, { backgroundColor: colors.inputBackground }]}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Rechercher…"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: filter === null ? colors.accent : colors.backgroundSecondary, borderColor: colors.border },
            ]}
            onPress={() => setFilter(null)}
          >
            <Text style={[styles.chipText, { color: filter === null ? '#0A0A0F' : colors.textSecondary }]}>
              Tous
            </Text>
          </TouchableOpacity>
          {MUSCLE_GROUPS.map(mg => (
            <TouchableOpacity
              key={mg}
              style={[
                styles.chip,
                { backgroundColor: filter === mg ? colors.accent : colors.backgroundSecondary, borderColor: colors.border },
              ]}
              onPress={() => setFilter(filter === mg ? null : mg)}
            >
              <Text style={[styles.chipText, { color: filter === mg ? '#0A0A0F' : colors.textSecondary }]}>
                {MUSCLE_LABELS[mg] ?? mg}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.exerciseListContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.exerciseRow, { borderBottomColor: colors.separator }]}
              onPress={() => {
                onSelect(item)
                Keyboard.dismiss()
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.exerciseName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name_fr}
              </Text>
              {item.muscle_group && (
                <Text style={[styles.exerciseMuscle, { color: colors.textSecondary }]}>
                  {MUSCLE_LABELS[item.muscle_group] ?? item.muscle_group}
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            loading ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Chargement…</Text>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucun exercice</Text>
            )
          }
        />
      </Animated.View>
    </View>
  )
}

// ─── PR Flash ─────────────────────────────────────────────────────────────────

interface PrFlashOverlayProps {
  flash: PrFlash | null
  colors: ReturnType<typeof useTheme>['colors']
}

function PrFlashOverlay({ flash, colors }: PrFlashOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const prevFlash = useRef<PrFlash | null>(null)

  useEffect(() => {
    if (flash && flash !== prevFlash.current) {
      prevFlash.current = flash
      opacity.setValue(0)
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start()
    }
  }, [flash])

  if (!flash) return null

  const color = prLevelColor(flash.level, colors)

  return (
    <Animated.View
      style={[styles.prFlashContainer, { opacity }]}
      pointerEvents="none"
    >
      <View style={[styles.prFlashCard, { backgroundColor: colors.backgroundTertiary, borderColor: color }]}>
        {flash.level === 'gold' ? (
          <Trophy size={28} color={color} />
        ) : flash.level === 'silver' ? (
          <Zap size={28} color={color} />
        ) : (
          <Flame size={28} color={color} />
        )}
        <Text style={[styles.prFlashText, { color }]}>{flash.label}</Text>
      </View>
    </Animated.View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SessionScreen() {
  const { colors } = useTheme()
  const router = useRouter()
  const {
    status,
    startedAt,
    exercises,
    currentIndex,
    elapsedSeconds,
    startWorkout,
    finishWorkout,
    addExercise,
    removeExercise,
    setCurrentIndex,
    updateDraftSet,
    validateSet,
    removeSet,
  } = useWorkout()

  const [modalVisible, setModalVisible] = useState(false)
  const [prFlash, setPrFlash] = useState<PrFlash | null>(null)

  const tabsScrollRef = useRef<ScrollView>(null)

  // ── Status done redirect ──
  useEffect(() => {
    if (status === 'done') {
      router.replace('/workout/summary')
    }
  }, [status])

  // ── Snapshot after exercises change ──
  useEffect(() => {
    if (status === 'active') {
      snapshotToMMKV(exercises, currentIndex, startedAt)
    }
  }, [exercises, currentIndex, startedAt, status])

  // ── Scroll tabs to current ──
  useEffect(() => {
    if (tabsScrollRef.current && exercises.length > 0) {
      tabsScrollRef.current.scrollTo({ x: currentIndex * 120, animated: true })
    }
  }, [currentIndex, exercises.length])

  const currentExercise: WorkoutExercise | undefined = exercises[currentIndex]
  const draftSet: WorkoutSet | undefined = currentExercise?.sets.find(s => !s.validated)
  const validatedSets: WorkoutSet[] = currentExercise?.sets.filter(s => s.validated) ?? []

  const weightValues = useMemo(
    () => getWeightValues(currentExercise?.equipment_type ?? null),
    [currentExercise?.equipment_type],
  )

  const draftWeight = draftSet?.weight_kg ?? (weightValues[0] ?? 0)
  const draftReps = draftSet?.reps ?? 1

  function handleWeightChange(val: number) {
    if (currentExercise) {
      updateDraftSet(currentIndex, 'weight_kg', val)
      snapshotToMMKV(exercises, currentIndex, startedAt)
    }
  }

  function handleRepsChange(val: number) {
    if (currentExercise) {
      updateDraftSet(currentIndex, 'reps', val)
      snapshotToMMKV(exercises, currentIndex, startedAt)
    }
  }

  function handleValidate() {
    if (!currentExercise) return
    const { prCharge, prSerie } = validateSet(currentIndex)
    snapshotToMMKV(exercises, currentIndex, startedAt)

    const level = bestPrLevel(prCharge, prSerie)
    if (level !== null) {
      const label =
        level === 'gold' ? 'NOUVEAU RECORD 🥇'
        : level === 'silver' ? '2ème MEILLEURE PERF 🥈'
        : '3ème MEILLEURE PERF 🥉'
      setPrFlash({ level, label })
    }
  }

  async function handleAddExercise(ex: ExerciseRow) {
    setModalVisible(false)
    await addExercise(ex.id, ex.name_fr, ex.muscle_group, ex.equipment_type)
    snapshotToMMKV(exercises, currentIndex, startedAt)
  }

  function handleRemoveExercise(index: number) {
    removeExercise(index)
    snapshotToMMKV(exercises, currentIndex, startedAt)
  }

  function handleRemoveSet(setIndex: number) {
    removeSet(currentIndex, setIndex)
    snapshotToMMKV(exercises, currentIndex, startedAt)
  }

  // ── IDLE screen ──
  if (status === 'idle') {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.idleContainer}>
          <Text style={[styles.idleTitle, { color: colors.textPrimary }]}>Orava</Text>
          <Text style={[styles.idleSubtitle, { color: colors.textSecondary }]}>Prêt à s'entraîner ?</Text>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: colors.accent }]}
            onPress={startWorkout}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>DÉMARRER UNE SÉANCE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── ACTIVE screen ──
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <TouchableOpacity
            style={styles.timerButton}
            onPress={() => router.push('/workout/timer')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Timer size={16} color={colors.accent} />
            <Text style={[styles.timerText, { color: colors.accent }]}>
              {formatElapsed(elapsedSeconds)}
            </Text>
          </TouchableOpacity>
          {exercises.length > 0 && (
            <TouchableOpacity
              style={[styles.finishButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={finishWorkout}
              activeOpacity={0.85}
            >
              <Text style={[styles.finishText, { color: colors.textPrimary }]}>TERMINER</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Exercise tabs */}
        <ScrollView
          ref={tabsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          style={[styles.tabsRow, { borderBottomColor: colors.separator }]}
          keyboardShouldPersistTaps="handled"
        >
          {exercises.map((ex, idx) => (
            <TouchableOpacity
              key={ex.exercise_id + idx}
              style={[
                styles.tab,
                idx === currentIndex && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
              ]}
              onPress={() => setCurrentIndex(idx)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: idx === currentIndex ? colors.textPrimary : colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {ex.name.length > 12 ? ex.name.slice(0, 12) + '…' : ex.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.tabAdd}
            onPress={() => setModalVisible(true)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Plus size={18} color={colors.accent} />
            <Text style={[styles.tabAddText, { color: colors.accent }]}>Exercice</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* No exercise yet */}
        {exercises.length === 0 ? (
          <View style={styles.emptyExerciseContainer}>
            <Text style={[styles.emptyExerciseText, { color: colors.textSecondary }]}>
              Ajoute un exercice pour commencer
            </Text>
            <TouchableOpacity
              style={[styles.addFirstButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.85}
            >
              <Plus size={20} color={colors.accent} />
              <Text style={[styles.addFirstText, { color: colors.textPrimary }]}>Ajouter un exercice</Text>
            </TouchableOpacity>
          </View>
        ) : currentExercise ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.exerciseContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Exercise header */}
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseTitleRow}>
                <Text style={[styles.exerciseTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                  {currentExercise.name}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveExercise(currentIndex)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.removeExButton}
                >
                  <Trash2 size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              {currentExercise.muscle_group && (
                <Text style={[styles.muscleChip, { color: colors.textSecondary, backgroundColor: colors.backgroundSecondary }]}>
                  {currentExercise.muscle_group.toUpperCase()}
                </Text>
              )}
            </View>

            {/* Validated sets */}
            {validatedSets.length > 0 && (
              <View style={styles.setsContainer}>
                {validatedSets.map((set, idx) => (
                  <SetRow
                    key={`${set.set_number}-${idx}`}
                    set={set}
                    onDelete={() => handleRemoveSet(idx)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Draft pickers */}
            <View style={[styles.pickersCard, { backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.draftLabel, { color: colors.textSecondary }]}>
                Set {(draftSet?.set_number ?? validatedSets.length + 1)}
              </Text>
              <View style={styles.pickersRow}>
                {weightValues.length > 0 ? (
                  <>
                    <View style={styles.pickerWrapper}>
                      <WheelPicker
                        values={weightValues}
                        selectedValue={draftWeight}
                        onValueChange={handleWeightChange}
                        unit="kg"
                      />
                    </View>
                    <Text style={[styles.pickerSeparator, { color: colors.textTertiary }]}>×</Text>
                  </>
                ) : null}
                <View style={styles.pickerWrapper}>
                  <WheelPicker
                    values={REPS_VALUES}
                    selectedValue={draftReps}
                    onValueChange={handleRepsChange}
                    unit="reps"
                  />
                </View>
              </View>
            </View>

            {/* Validate button */}
            <TouchableOpacity
              style={[styles.validateButton, { backgroundColor: colors.accent }]}
              onPress={handleValidate}
              activeOpacity={0.85}
            >
              <Text style={styles.validateText}>VALIDER</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}

        {/* PR Flash overlay */}
        <PrFlashOverlay flash={prFlash} colors={colors} />

        {/* Exercise modal */}
        <ExerciseModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSelect={handleAddExercise}
          colors={colors}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // ── Idle ──
  idleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s6,
    gap: spacing.s4,
  },
  idleTitle: {
    ...typography.hero,
    marginBottom: spacing.s2,
  },
  idleSubtitle: {
    ...typography.subtitle,
    marginBottom: spacing.s8,
  },
  startButton: {
    height: touchTarget.hero,
    width: '100%',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    ...typography.subtitle,
    color: '#0A0A0F',
    letterSpacing: 1,
  },

  // ── Header ──
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    height: touchTarget.min,
    paddingHorizontal: spacing.s2,
  },
  timerText: {
    ...typography.mono,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    height: 36,
    paddingHorizontal: spacing.s4,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  finishText: {
    ...typography.caption,
    letterSpacing: 1,
  },

  // ── Tabs ──
  tabsRow: {
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabsContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
    gap: spacing.s2,
  },
  tab: {
    height: 44,
    paddingHorizontal: spacing.s3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  tabText: {
    ...typography.caption,
    letterSpacing: 0.5,
  },
  tabAdd: {
    height: 44,
    paddingHorizontal: spacing.s3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s1,
  },
  tabAddText: {
    ...typography.caption,
    letterSpacing: 0.5,
  },

  // ── Empty exercise state ──
  emptyExerciseContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s4,
    paddingHorizontal: spacing.s6,
  },
  emptyExerciseText: {
    ...typography.body,
    textAlign: 'center',
  },
  addFirstButton: {
    height: touchTarget.hero,
    paddingHorizontal: spacing.s6,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
    borderWidth: 1,
  },
  addFirstText: {
    ...typography.subtitle,
  },

  // ── Exercise content ──
  exerciseContent: {
    padding: spacing.s4,
    gap: spacing.s4,
    paddingBottom: spacing.s12,
  },
  exerciseHeader: {
    gap: spacing.s2,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.s3,
  },
  exerciseTitle: {
    ...typography.title,
    flex: 1,
  },
  removeExButton: {
    padding: spacing.s2,
    marginTop: 2,
  },
  muscleChip: {
    ...typography.caption,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.s2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },

  // ── Sets list ──
  setsContainer: {
    gap: spacing.s2,
  },
  setRowWrapper: {
    height: touchTarget.hero,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  setRowDeleteBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.s4,
    borderRadius: radius.md,
  },
  setRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.s4,
    gap: spacing.s3,
    borderRadius: radius.md,
  },
  setRowLabel: {
    ...typography.caption,
    width: 40,
  },
  setRowValue: {
    ...typography.body,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  prBadgeText: {
    ...typography.caption,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ── Pickers ──
  pickersCard: {
    borderRadius: radius.lg,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s4,
    gap: spacing.s3,
  },
  draftLabel: {
    ...typography.caption,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s3,
  },
  pickerWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  pickerSeparator: {
    ...typography.subtitle,
    fontSize: 22,
    marginTop: 4,
  },
  pickerContainer: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  pickerCenterHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
    pointerEvents: 'none',
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemSelected: {
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pickerItemNormal: {
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
  },
  pickerUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  pickerCenterItem: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Validate button ──
  validateButton: {
    height: touchTarget.hero,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateText: {
    ...typography.subtitle,
    color: '#0A0A0F',
    letterSpacing: 1.5,
  },

  // ── PR Flash ──
  prFlashContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    pointerEvents: 'none',
  },
  prFlashCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s4,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  prFlashText: {
    ...typography.subtitle,
    letterSpacing: 0.5,
  },

  // ── Modal ──
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginTop: spacing.s3,
    marginBottom: spacing.s2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    ...typography.title,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
    margin: spacing.s4,
    paddingHorizontal: spacing.s3,
    borderRadius: radius.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    height: 44,
  },
  chipsContainer: {
    paddingHorizontal: spacing.s4,
    gap: spacing.s2,
    paddingBottom: spacing.s3,
  },
  chip: {
    paddingHorizontal: spacing.s3,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: {
    ...typography.caption,
    letterSpacing: 0.3,
  },
  exerciseListContent: {
    paddingBottom: spacing.s12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    minHeight: touchTarget.comfort,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    ...typography.body,
    flex: 1,
  },
  exerciseMuscle: {
    ...typography.caption,
    letterSpacing: 0.3,
    marginLeft: spacing.s2,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.s8,
  },
})
