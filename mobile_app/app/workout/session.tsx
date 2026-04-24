/**
 * ORAVA — Session 06
 * app/workout/session.tsx
 * Écran de log de séance
 */

import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Modal, ActivityIndicator, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useWorkout, WorkoutExercise, WorkoutSet } from '../../context/WorkoutContext'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExerciseResult {
  id: string
  name: string
  muscle_group: string | null
  equipment: string | null
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const EQUIPMENT_SHORT: Record<string, string> = {
  barbell: 'Barre', dumbbell: 'Haltères', machine: 'Machine',
  cable: 'Poulie', bodyweight: 'Poids corps', kettlebell: 'KB',
  band: 'Élastique', other: 'Autre',
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function WorkoutSessionScreen() {
  const workout = useWorkout()
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ExerciseResult[]>([])
  const [searching, setSearching] = useState(false)
  const [prFlash, setPrFlash] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Démarrage automatique si on arrive depuis le FAB
  useEffect(() => {
    if (workout.status === 'idle') workout.startWorkout()
    else if (workout.status === 'done') router.replace('/workout/summary')
  }, [])

  // ─── Exercice courant ─────────────────────────────────────────────────────

  const currentExercise: WorkoutExercise | null =
    workout.exercises[workout.currentIndex] ?? null

  const validatedSets = currentExercise?.sets.filter(s => s.validated) ?? []
  const draft = currentExercise?.sets.find(s => !s.validated) ?? null

  // ─── Chrono ──────────────────────────────────────────────────────────────

  function formatChrono(s: number): string {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ─── Recherche exercice ───────────────────────────────────────────────────

  useEffect(() => {
    if (!showPicker) {
      setSearchQuery('')
      setSearchResults([])
      return
    }
    fetchExercises('')
  }, [showPicker])

  useEffect(() => {
    if (!showPicker) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchExercises(searchQuery), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, showPicker])

  async function fetchExercises(q: string) {
    setSearching(true)
    let query = supabase
      .from('exercises')
      .select(`
        id, name, equipment,
        exercise_muscles!inner ( role, muscles ( muscle_group ) )
      `)
      .eq('exercise_muscles.role', 'primary')
      .order('name')
      .limit(30)

    if (q.trim().length > 0) {
      query = query.ilike('name', `%${q.trim()}%`)
    }

    const { data } = await query
    setSearching(false)

    const results: ExerciseResult[] = (data ?? []).map((ex: any) => ({
      id: ex.id,
      name: ex.name,
      equipment: ex.equipment,
      muscle_group: ex.exercise_muscles?.[0]?.muscles?.muscle_group ?? null,
    }))

    setSearchResults(results)
  }

  async function handleSelectExercise(ex: ExerciseResult) {
    setShowPicker(false)
    await workout.addExercise(ex.id, ex.name, ex.muscle_group)
  }

  // ─── Validation série ─────────────────────────────────────────────────────

  function handleValidate() {
    if (!draft || draft.weight_kg <= 0 || draft.reps <= 0) {
      Alert.alert('Série incomplète', 'Saisis un poids et un nombre de répétitions.')
      return
    }
    const isPr = workout.validateSet(workout.currentIndex)
    if (isPr) {
      setPrFlash(true)
      setTimeout(() => setPrFlash(false), 2000)
    }
  }

  // ─── Fin de séance ────────────────────────────────────────────────────────

  function handleFinish() {
    const totalValidated = workout.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter(s => s.validated).length, 0
    )
    if (totalValidated === 0) {
      Alert.alert(
        'Aucune série enregistrée',
        'Tu n\'as validé aucune série. Abandonner la séance ?',
        [
          { text: 'Continuer', style: 'cancel' },
          {
            text: 'Abandonner', style: 'destructive',
            onPress: () => { workout.resetWorkout(); router.back() }
          },
        ]
      )
      return
    }
    workout.finishWorkout()
    router.push('/workout/summary')
  }

  // ─── Rendu ensemble vide ──────────────────────────────────────────────────

  if (workout.exercises.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.chrono}>{formatChrono(workout.elapsedSeconds)}</Text>
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
            <Text style={styles.finishBtnText}>Fin</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💪</Text>
          <Text style={styles.emptyTitle}>Aucun exercice</Text>
          <Text style={styles.emptySubtitle}>Ajoute ton premier exercice pour commencer</Text>
          <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.addFirstBtnText}>+ Ajouter un exercice</Text>
          </TouchableOpacity>
        </View>

        <ExercisePicker
          visible={showPicker}
          query={searchQuery}
          results={searchResults}
          searching={searching}
          onChangeQuery={setSearchQuery}
          onSelect={handleSelectExercise}
          onClose={() => setShowPicker(false)}
        />
      </View>
    )
  }

  // ─── Rendu principal ──────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.chrono}>{formatChrono(workout.elapsedSeconds)}</Text>
        <TouchableOpacity
          style={styles.timerBtn}
          onPress={() => router.push('/workout/timer')}
        >
          <Text style={styles.timerBtnText}>⏱</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
          <Text style={styles.finishBtnText}>Fin</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation exercice */}
      <View style={styles.exerciseNav}>
        <TouchableOpacity
          style={[styles.navBtn, workout.currentIndex === 0 && styles.navBtnDisabled]}
          onPress={() => workout.setCurrentIndex(workout.currentIndex - 1)}
          disabled={workout.currentIndex === 0}
        >
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.exerciseTitleContainer}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {currentExercise?.name}
          </Text>
          <Text style={styles.exerciseCounter}>
            {workout.currentIndex + 1} / {workout.exercises.length}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.navBtn,
            workout.currentIndex === workout.exercises.length - 1 && styles.navBtnDisabled,
          ]}
          onPress={() => workout.setCurrentIndex(workout.currentIndex + 1)}
          disabled={workout.currentIndex === workout.exercises.length - 1}
        >
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Séries validées */}
      <ScrollView
        style={styles.setsScroll}
        contentContainerStyle={styles.setsContent}
        showsVerticalScrollIndicator={false}
      >
        {validatedSets.length === 0 ? (
          <Text style={styles.noSetsText}>Première série — c'est parti !</Text>
        ) : (
          validatedSets.map((set, idx) => (
            <SetRow
              key={idx}
              set={set}
              onRemove={() => workout.removeSet(workout.currentIndex, idx)}
            />
          ))
        )}
      </ScrollView>

      {/* PR Flash */}
      {prFlash && (
        <View style={styles.prFlashBanner}>
          <Text style={styles.prFlashText}>🏆 Nouveau PR !</Text>
        </View>
      )}

      {/* Série en cours (draft) */}
      {draft && (
        <View style={styles.draftContainer}>
          <Text style={styles.draftLabel}>Série {draft.set_number}</Text>

          <View style={styles.stepperRow}>
            {/* Poids */}
            <View style={styles.stepperGroup}>
              <Text style={styles.stepperLabel}>Poids (kg)</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => workout.updateDraftSet(workout.currentIndex, 'weight_kg', draft.weight_kg - 2.5)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepValue}>
                  {draft.weight_kg % 1 === 0 ? draft.weight_kg : draft.weight_kg.toFixed(1)}
                </Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => workout.updateDraftSet(workout.currentIndex, 'weight_kg', draft.weight_kg + 2.5)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperDivider} />

            {/* Reps */}
            <View style={styles.stepperGroup}>
              <Text style={styles.stepperLabel}>Répétitions</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => workout.updateDraftSet(workout.currentIndex, 'reps', draft.reps - 1)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepValue}>{draft.reps}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => workout.updateDraftSet(workout.currentIndex, 'reps', draft.reps + 1)}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.validateBtn} onPress={handleValidate}>
            <Text style={styles.validateBtnText}>✓  Valider la série</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pied : ajouter exercice */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.addExerciseBtnText}>+ Ajouter un exercice</Text>
        </TouchableOpacity>
      </View>

      {/* Modal sélection exercice */}
      <ExercisePicker
        visible={showPicker}
        query={searchQuery}
        results={searchResults}
        searching={searching}
        onChangeQuery={setSearchQuery}
        onSelect={handleSelectExercise}
        onClose={() => setShowPicker(false)}
      />
    </KeyboardAvoidingView>
  )
}

// ─── SetRow ──────────────────────────────────────────────────────────────────

function SetRow({ set, onRemove }: { set: WorkoutSet; onRemove: () => void }) {
  return (
    <View style={setStyles.row}>
      <Text style={setStyles.number}>Série {set.set_number}</Text>
      <Text style={setStyles.data}>
        {set.weight_kg % 1 === 0 ? set.weight_kg : set.weight_kg.toFixed(1)} kg × {set.reps} reps
      </Text>
      {set.is_pr && (
        <View style={setStyles.prBadge}>
          <Text style={setStyles.prBadgeText}>PR</Text>
        </View>
      )}
      <TouchableOpacity style={setStyles.deleteBtn} onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={setStyles.deleteText}>×</Text>
      </TouchableOpacity>
    </View>
  )
}

const setStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 8,
  },
  number: { color: '#555', fontSize: 13, width: 54 },
  data: { color: '#ccc', fontSize: 15, fontWeight: '500', flex: 1 },
  prBadge: {
    backgroundColor: '#FAC77520',
    borderWidth: 1,
    borderColor: '#FAC77540',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  prBadgeText: { color: '#FAC775', fontSize: 11, fontWeight: '700' },
  deleteBtn: { paddingHorizontal: 4 },
  deleteText: { color: '#444', fontSize: 20, lineHeight: 22 },
})

// ─── ExercisePicker ──────────────────────────────────────────────────────────

interface ExercisePickerProps {
  visible: boolean
  query: string
  results: ExerciseResult[]
  searching: boolean
  onChangeQuery: (q: string) => void
  onSelect: (ex: ExerciseResult) => void
  onClose: () => void
}

function ExercisePicker({
  visible, query, results, searching, onChangeQuery, onSelect, onClose,
}: ExercisePickerProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.container}>
        <View style={pickerStyles.header}>
          <Text style={pickerStyles.title}>Exercice</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={pickerStyles.closeText}>Annuler</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={pickerStyles.search}
          placeholder="Rechercher..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={onChangeQuery}
          autoFocus
          clearButtonMode="while-editing"
        />

        {searching ? (
          <ActivityIndicator color="#D85A30" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={pickerStyles.row} onPress={() => onSelect(item)}>
                <Text style={pickerStyles.rowName}>{item.name}</Text>
                {item.equipment && (
                  <Text style={pickerStyles.rowSub}>
                    {EQUIPMENT_SHORT[item.equipment] ?? item.equipment}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </Modal>
  )
}

const pickerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeText: { color: '#D85A30', fontSize: 16 },
  search: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  row: { paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1 },
  rowSub: { color: '#555', fontSize: 12 },
  separator: { height: 1, backgroundColor: '#1A1A1A', marginLeft: 20 },
})

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 10,
  },
  chrono: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  timerBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
  },
  timerBtnText: { fontSize: 18 },
  finishBtn: {
    backgroundColor: '#D85A30',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  finishBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  exerciseNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  navBtn: {
    padding: 10,
    width: 44,
    alignItems: 'center',
  },
  navBtnDisabled: { opacity: 0.2 },
  navBtnText: { color: '#D85A30', fontSize: 28, fontWeight: '300', lineHeight: 30 },
  exerciseTitleContainer: { flex: 1, alignItems: 'center', gap: 2 },
  exerciseName: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  exerciseCounter: { color: '#555', fontSize: 12 },

  setsScroll: { flex: 1 },
  setsContent: { paddingTop: 4, paddingBottom: 16 },
  noSetsText: { color: '#444', fontSize: 14, textAlign: 'center', marginTop: 24 },

  prFlashBanner: {
    position: 'absolute',
    top: 140,
    alignSelf: 'center',
    backgroundColor: '#FAC775',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  prFlashText: { color: '#412402', fontSize: 16, fontWeight: '700' },

  draftContainer: {
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    padding: 16,
    gap: 14,
  },
  draftLabel: { color: '#888', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  stepperGroup: { flex: 1, alignItems: 'center', gap: 8 },
  stepperLabel: { color: '#555', fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
  },
  stepBtnText: { color: '#fff', fontSize: 24, fontWeight: '300' },
  stepValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepperDivider: { width: 1, height: 48, backgroundColor: '#1A1A1A', marginHorizontal: 8 },

  validateBtn: {
    backgroundColor: '#D85A30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  validateBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
  addExerciseBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExerciseBtnText: { color: '#888', fontSize: 15, fontWeight: '600' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  emptySubtitle: { color: '#555', fontSize: 14, textAlign: 'center' },
  addFirstBtn: {
    marginTop: 8,
    backgroundColor: '#D85A30',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  addFirstBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
