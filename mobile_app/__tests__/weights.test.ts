/**
 * weights.ts — granulométrie poids/reps + conversions d'unité (ORA-035).
 *
 * Import RÉEL (pas de recopie — cf. ORA-045). Module pur sans dépendance native :
 * il n'importe ni supabase ni storage, donc aucun mock requis.
 *
 * On verrouille la granulométrie figée (rules/workout.md « ne pas modifier ») +
 * la conversion kg↔lbs (la DB stocke TOUJOURS des kg, l'unité n'est qu'affichage).
 */

import {
  REPS_VALUES,
  getWeightValues,
  getWeightValuesLbs,
  getWeightValuesForUnit,
  convertFromKg,
  convertToKg,
  formatWeight,
  formatVolumeUnit,
} from '../lib/weights'

describe('REPS_VALUES', () => {
  it('couvre 1..50 exactement', () => {
    expect(REPS_VALUES).toHaveLength(50)
    expect(REPS_VALUES[0]).toBe(1)
    expect(REPS_VALUES[49]).toBe(50)
  })
})

describe('getWeightValues (kg) — granulométrie figée', () => {
  it('bodyweight → aucune valeur (reps only)', () => {
    expect(getWeightValues('bodyweight')).toEqual([])
  })

  it('dumbbell → pas de 2 kg, 2→60', () => {
    const v = getWeightValues('dumbbell')
    expect(v).toHaveLength(30)
    expect(v[0]).toBe(2)
    expect(v[v.length - 1]).toBe(60)
    expect(v.every((x, i) => i === 0 || x - v[i - 1] === 2)).toBe(true)
  })

  it('barbell → démarre à 20, finit à 220', () => {
    const v = getWeightValues('barbell')
    expect(v[0]).toBe(20)
    expect(v[v.length - 1]).toBe(220)
  })

  it('kettlebell → pas de 4 kg, 4→48', () => {
    const v = getWeightValues('kettlebell')
    expect(v).toHaveLength(12)
    expect(v[0]).toBe(4)
    expect(v[v.length - 1]).toBe(48)
  })

  it('défaut (poulie/machine/null) → pas de 2,5 kg, 2,5→200', () => {
    const v = getWeightValues(null)
    expect(v).toHaveLength(80)
    expect(v[0]).toBe(2.5)
    expect(v[v.length - 1]).toBe(200)
  })

  it('type inconnu → granulométrie par défaut (2,5 kg)', () => {
    expect(getWeightValues('barbell-smith')[0]).toBe(2.5)
  })
})

describe('getWeightValuesLbs (lbs) — granulométrie impériale parallèle', () => {
  it('bodyweight → vide', () => {
    expect(getWeightValuesLbs('bodyweight')).toEqual([])
  })

  it('dumbbell → 5→150 par pas de 5', () => {
    const v = getWeightValuesLbs('dumbbell')
    expect(v[0]).toBe(5)
    expect(v[v.length - 1]).toBe(150)
  })

  it('barbell → démarre à 45 (barre olympique)', () => {
    expect(getWeightValuesLbs('barbell')[0]).toBe(45)
  })

  it('défaut → 5→400 par pas de 5', () => {
    const v = getWeightValuesLbs(null)
    expect(v).toHaveLength(80)
    expect(v[0]).toBe(5)
    expect(v[v.length - 1]).toBe(400)
  })
})

describe('getWeightValuesForUnit — aiguille vers la bonne granulométrie', () => {
  it("unit 'kg' → valeurs kg", () => {
    expect(getWeightValuesForUnit('dumbbell', 'kg')).toEqual(getWeightValues('dumbbell'))
  })

  it("unit 'lbs' → valeurs lbs", () => {
    expect(getWeightValuesForUnit('dumbbell', 'lbs')).toEqual(getWeightValuesLbs('dumbbell'))
  })
})

describe('conversions kg ↔ lbs', () => {
  it("convertFromKg en 'kg' = identité", () => {
    expect(convertFromKg(100, 'kg')).toBe(100)
  })

  it("convertFromKg en 'lbs' applique le facteur", () => {
    expect(convertFromKg(100, 'lbs')).toBeCloseTo(220.462, 2)
  })

  it("convertToKg en 'kg' = identité", () => {
    expect(convertToKg(100, 'kg')).toBe(100)
  })

  it("convertToKg en 'lbs' applique l'inverse", () => {
    expect(convertToKg(135, 'lbs')).toBeCloseTo(61.235, 2)
  })

  it('aller-retour kg → lbs → kg ≈ identité', () => {
    const kg = 82.5
    expect(convertToKg(convertFromKg(kg, 'lbs'), 'lbs')).toBeCloseTo(kg, 6)
  })
})

describe('formatWeight', () => {
  it('null/undefined → tiret', () => {
    expect(formatWeight(null, 'kg')).toBe('—')
    expect(formatWeight(undefined, 'lbs')).toBe('—')
  })

  it("kg → arrondi au dixième + suffixe 'kg'", () => {
    expect(formatWeight(82.54, 'kg')).toBe('82.5 kg')
  })

  it("lbs → entier + suffixe 'lbs'", () => {
    expect(formatWeight(100, 'lbs')).toBe('220 lbs')
  })

  it('suffix:false → nombre seul', () => {
    expect(formatWeight(100, 'kg', { suffix: false })).toBe('100')
  })
})

describe('formatVolumeUnit — espacement par milliers', () => {
  it('null → tiret', () => {
    expect(formatVolumeUnit(null, 'kg')).toBe('—')
  })

  it('< 1000 → tel quel', () => {
    expect(formatVolumeUnit(450, 'kg')).toBe('450')
  })

  it('>= 1000 → millier espacé, reste paddé sur 3', () => {
    expect(formatVolumeUnit(12450, 'kg')).toBe('12 450')
    expect(formatVolumeUnit(1005, 'kg')).toBe('1 005')
  })

  it('suffix:true → ajoute l’unité', () => {
    expect(formatVolumeUnit(450, 'kg', { suffix: true })).toBe('450 kg')
  })

  it('lbs → convertit avant formatage', () => {
    expect(formatVolumeUnit(1000, 'lbs')).toBe('2 205')
  })
})
