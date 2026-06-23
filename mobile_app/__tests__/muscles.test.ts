/**
 * muscles.ts — référentiel des libellés muscles FR (ORA-035, source unique).
 *
 * Import RÉEL (cf. ORA-045). Module pur (aucune dépendance native). On verrouille
 * la cohérence des 3 tables de libellés + le fallback de muscleGroupLabel, pour
 * éviter qu'un renommage casse silencieusement analytics / prs / library / etc.
 */

import {
  MUSCLE_LABELS,
  MUSCLE_LABELS_DETAILED,
  MUSCLE_GROUP_LABELS,
  muscleGroupLabel,
} from '../lib/muscles'

describe('MUSCLE_LABELS (libellés groupés, clé = exercise_muscles.muscle)', () => {
  it('fusionne les trois fessiers sous « Fessiers »', () => {
    expect(MUSCLE_LABELS.fessier_maximus).toBe('Fessiers')
    expect(MUSCLE_LABELS.fessier_median).toBe('Fessiers')
    expect(MUSCLE_LABELS.fessier_minimus).toBe('Fessiers')
  })

  it('abdominaux affichés « Core » (cohérence Myo famille 6)', () => {
    expect(MUSCLE_LABELS.abdominaux).toBe('Core')
  })

  it('clés en snake_case français (= colonnes DB)', () => {
    expect(Object.keys(MUSCLE_LABELS).every((k) => /^[a-z_]+$/.test(k))).toBe(true)
  })
})

describe('MUSCLE_LABELS_DETAILED (vue anatomique exercise/[id])', () => {
  it('distingue les fessiers au lieu de les fusionner', () => {
    expect(MUSCLE_LABELS_DETAILED.fessier_maximus).toBe('Fessier maximus')
    expect(MUSCLE_LABELS_DETAILED.fessier_median).toBe('Fessier médian')
    expect(MUSCLE_LABELS_DETAILED.fessier_minimus).toBe('Fessier minimus')
  })

  it('abdominaux nommés « Abdominaux » (pas « Core » ici)', () => {
    expect(MUSCLE_LABELS_DETAILED.abdominaux).toBe('Abdominaux')
  })

  it('couvre des muscles secondaires absents de la vue groupée', () => {
    expect(MUSCLE_LABELS_DETAILED.brachial).toBe('Brachial')
    expect(MUSCLE_LABELS_DETAILED.iliopsoas).toBe('Iliopsoas')
    expect(MUSCLE_LABELS.brachial).toBeUndefined()
  })
})

describe('MUSCLE_GROUP_LABELS (clé = exercises.muscle_group FR)', () => {
  it('mappe les groupes DB français', () => {
    expect(MUSCLE_GROUP_LABELS.dos).toBe('Dos')
    expect(MUSCLE_GROUP_LABELS.epaules).toBe('Épaules')
    expect(MUSCLE_GROUP_LABELS.ischio_jambiers).toBe('Ischio-jambiers')
  })
})

describe('muscleGroupLabel — libellé + fallback', () => {
  it('valeur connue → libellé mappé', () => {
    expect(muscleGroupLabel('pectoraux')).toBe('Pectoraux')
  })

  it('valeur inconnue → snake_case converti en espaces', () => {
    expect(muscleGroupLabel('avant_bras_gauche')).toBe('avant bras gauche')
  })

  it('valeur sans underscore inconnue → renvoyée telle quelle', () => {
    expect(muscleGroupLabel('cardio')).toBe('cardio')
  })

  it('chaîne vide → chaîne vide (pas de crash)', () => {
    expect(muscleGroupLabel('')).toBe('')
  })
})
