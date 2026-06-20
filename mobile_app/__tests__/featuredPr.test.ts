/**
 * featuredPr.ts — logique pure du PR vedette (ORA-080).
 *
 * Import réel des helpers extraits de getAutoFeaturedPr : sélection du meilleur set
 * (priorité 'gold') + calcul du delta vs ancien record. Stub supabase (import top-level).
 */

jest.mock('../lib/supabase', () => ({ supabase: {} }))

import { selectBestPrSet, computePrDelta } from '../lib/featuredPr'

interface PrSetRow {
  weight_kg: number | null
  reps: number | null
  pr_charge: string | null
  logged_at: string | null
  workout_exercise_id: string
}

const mk = (weight: number | null, pr_charge: string | null, id = 'we1'): PrSetRow => ({
  weight_kg: weight,
  reps: 5,
  pr_charge,
  logged_at: null,
  workout_exercise_id: id,
})

describe('selectBestPrSet', () => {
  it('liste vide → null', () => {
    expect(selectBestPrSet([])).toBeNull()
  })

  it('priorité aux gold même si un non-gold est plus lourd', () => {
    const sets = [mk(120, 'silver'), mk(100, 'gold'), mk(90, 'gold')]
    expect(selectBestPrSet(sets)?.weight_kg).toBe(100) // meilleur gold, pas le silver 120
  })

  it('aucun gold → meilleur poids tous statuts confondus', () => {
    const sets = [mk(80, 'silver'), mk(110, 'bronze'), mk(95, 'silver')]
    expect(selectBestPrSet(sets)?.weight_kg).toBe(110)
  })

  it('weight_kg null traité comme 0', () => {
    const sets = [mk(null, 'gold'), mk(50, 'gold')]
    expect(selectBestPrSet(sets)?.weight_kg).toBe(50)
  })

  it('un seul set → ce set', () => {
    expect(selectBestPrSet([mk(60, 'gold')])?.weight_kg).toBe(60)
  })
})

describe('computePrDelta', () => {
  it('aucun poids inférieur (premier record) → null', () => {
    expect(computePrDelta(100, [100, 120])).toBeNull()
  })

  it('delta vs le meilleur poids strictement inférieur', () => {
    expect(computePrDelta(100, [100, 90, 80, 95])).toBe(5) // 100 - 95
  })

  it('liste vide → null', () => {
    expect(computePrDelta(100, [])).toBeNull()
  })

  it('un seul poids inférieur → delta direct', () => {
    expect(computePrDelta(100, [82.5])).toBe(17.5)
  })
})
