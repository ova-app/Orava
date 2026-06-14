/**
 * myo.ts — normalisation z-score → [0,1] (cœur du rendu de l'orbe Myo).
 *
 * Jusqu'ici seul computeMuscleDims était testé. Ce fichier couvre les deux
 * fonctions publiques qui transforment les métriques brutes en sessionValues
 * affichées dans l'orbe et le feed :
 *   - computeSessionValues()       : métriques locales → 8 familles (baselines population)
 *   - sessionValuesFromSignature() : ligne myo_signatures → 8 familles
 *
 * Invariants vérifiés : structure (8 familles, longueurs 6/5/5/5/5/5/17/5),
 * bornes [0,1], valeur = moyenne pop → 0.5, clamp ±3σ, et la règle critique
 * "muscle non sollicité (raw 0) → 0 exact = invisible dans l'orbe".
 */

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

import {
  computeSessionValues,
  sessionValuesFromSignature,
  type LocalSessionMetrics,
} from '../lib/myo'

const FAMILY_LENGTHS = [6, 5, 5, 5, 5, 5, 17, 5]

// Métriques exactement égales aux moyennes population (POP_MEAN dans myo.ts)
// → chaque z-score = 0 → chaque norm = 0.5.
const POP_MEAN_METRICS: LocalSessionMetrics = {
  volume_kg: 5000,
  densite: 80,
  nb_series: 20,
  nb_exercices: 5,
  nb_pr: 1,
  streak: 3,
  frequence_hebdo: 3,
  nb_seances_30j: 8,
  duree_sec: 3600,
  temps_repos_moy_sec: 120,
  ratio_actif: 0.5,
  poids_max_kg: 80,
  charge_relative: 65,
  muscleDims: new Array(17).fill(0),
}

describe('computeSessionValues — structure', () => {
  it('renvoie 8 familles aux longueurs attendues (6/5/5/5/5/5/17/5)', () => {
    const sv = computeSessionValues(POP_MEAN_METRICS)
    expect(sv).toHaveLength(8)
    expect(sv.map((f) => f.length)).toEqual(FAMILY_LENGTHS)
  })

  it('toutes les valeurs restent dans [0,1]', () => {
    const sv = computeSessionValues(POP_MEAN_METRICS)
    for (const fam of sv)
      for (const v of fam) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
  })
})

describe('computeSessionValues — normalisation', () => {
  it('métriques = moyenne population → 0.5 partout (familles 0-5,7)', () => {
    const sv = computeSessionValues(POP_MEAN_METRICS)
    for (let f = 0; f < 8; f++) {
      if (f === 6) continue // famille muscles : règle 0 spécifique
      for (const v of sv[f]) expect(v).toBeCloseTo(0.5, 6)
    }
  })

  it('muscleDims tous à 0 → famille 6 entièrement 0 (invisible dans l’orbe)', () => {
    const sv = computeSessionValues(POP_MEAN_METRICS)
    expect(sv[6]).toEqual(new Array(17).fill(0))
  })

  it('valeur très au-dessus de la moyenne → clamp +3σ → 1.0', () => {
    const sv = computeSessionValues({ ...POP_MEAN_METRICS, volume_kg: 1e9 })
    expect(sv[0][0]).toBeCloseTo(1, 6)
  })

  it('valeur très en-dessous de la moyenne → clamp −3σ → 0.0', () => {
    // charge_relative pop = 65, σ = 15 → besoin de ≤ 65 - 45 = 20 pour clamper
    const sv = computeSessionValues({ ...POP_MEAN_METRICS, charge_relative: -1000 })
    expect(sv[1][1]).toBeCloseTo(0, 6)
  })

  it('un muscleDim non nul → entrée > 0 ; les autres restent 0', () => {
    const dims = new Array(17).fill(0)
    dims[10] = 1e9 // biceps saturé → clamp → 1
    const sv = computeSessionValues({ ...POP_MEAN_METRICS, muscleDims: dims })
    expect(sv[6][10]).toBeCloseTo(1, 6)
    expect(sv[6][5]).toBe(0)
    expect(sv[6][0]).toBe(0)
  })
})

describe('sessionValuesFromSignature — structure', () => {
  const baseRow = {
    z_volume: 0,
    z_intensite: 0,
    z_structure: 0,
    z_recovery: 0,
    z_performance: 0,
    z_regularite: 0,
    z_extended: {} as Record<string, unknown>,
  }

  it('renvoie 8 familles aux longueurs attendues', () => {
    const sv = sessionValuesFromSignature(baseRow)
    expect(sv).toHaveLength(8)
    expect(sv.map((f) => f.length)).toEqual(FAMILY_LENGTHS)
  })

  it('z = 0 → 0.5 ; z_extended absent → 0.5 (g() défaut 0)', () => {
    const sv = sessionValuesFromSignature(baseRow)
    expect(sv[0][0]).toBeCloseTo(0.5, 6) // z_volume = 0
    expect(sv[0][1]).toBeCloseTo(0.5, 6) // g('nb_series') absent → 0
  })

  it('z = +3 → 1.0 et z = -3 → 0.0', () => {
    expect(sessionValuesFromSignature({ ...baseRow, z_volume: 3 })[0][0]).toBeCloseTo(1, 6)
    expect(sessionValuesFromSignature({ ...baseRow, z_volume: -3 })[0][0]).toBeCloseTo(0, 6)
  })
})

describe('sessionValuesFromSignature — famille muscles', () => {
  const baseRow = {
    z_volume: 0,
    z_intensite: 0,
    z_structure: 0,
    z_recovery: 0,
    z_performance: 0,
    z_regularite: 0,
    z_extended: {} as Record<string, unknown>,
  }

  it('muscles_raw[i] = 0 → famille 6 entrée 0 même si muscles[i] ≠ 0', () => {
    const muscles = new Array(17).fill(0.6)
    const musclesRaw = new Array(17).fill(100)
    musclesRaw[3] = 0 // muscle non sollicité
    const sv = sessionValuesFromSignature({
      ...baseRow,
      z_extended: { muscles, muscles_raw: musclesRaw },
    })
    expect(sv[6][3]).toBe(0)
    expect(sv[6][0]).toBeCloseTo((0.6 + 3) / 6, 6) // norm(0.6)
  })

  it('z_extended sans muscles/muscles_raw → défaut raw=1 (≠0) → norm(0)=0.5', () => {
    const sv = sessionValuesFromSignature(baseRow)
    for (const v of sv[6]) expect(v).toBeCloseTo(0.5, 6)
  })
})
