/**
 * predictor.ts — régression linéaire pondérée + computePrediction (ORA-005).
 *
 * Couvre le cœur math non testé jusqu'ici :
 *   - weight()                   : décroissance temporelle de la pondération
 *   - weightedLinearRegression() : pente/intercept + cas dégénérés (null)
 *   - weightedR2()               : qualité du fit + cas plat
 *   - computePrediction()        : pipeline complet via DB mockée (branches null + happy path)
 *
 * getDB est mocké (predictor.ts l'importe au top-level → évite expo-sqlite).
 * epley1RM (utils.ts) reste réel — fonction pure.
 */

const mockGetAllAsync = jest.fn()
jest.mock('../lib/db', () => ({ getDB: () => ({ getAllAsync: mockGetAllAsync }) }))

import { weight, weightedLinearRegression, weightedR2, computePrediction } from '../lib/predictor'

const MS_PER_DAY = 24 * 60 * 60 * 1000

describe('weight — décroissance temporelle', () => {
  const now = 1_700_000_000_000

  it('aujourd’hui (âge 0j) → 1.0', () => {
    expect(weight(now, now)).toBeCloseTo(1.0, 6)
  })

  it('90j → 0.65 (décroissance linéaire)', () => {
    expect(weight(now - 90 * MS_PER_DAY, now)).toBeCloseTo(0.65, 6)
  })

  it('180j → plancher 0.3', () => {
    expect(weight(now - 180 * MS_PER_DAY, now)).toBeCloseTo(0.3, 6)
  })

  it('au-delà de 180j → plancher dur 0.1', () => {
    expect(weight(now - 200 * MS_PER_DAY, now)).toBeCloseTo(0.1, 6)
    expect(weight(now - 365 * MS_PER_DAY, now)).toBeCloseTo(0.1, 6)
  })
})

describe('weightedLinearRegression', () => {
  it('droite parfaite y=2x+5 (poids uniformes) → slope 2, intercept 5', () => {
    const reg = weightedLinearRegression([0, 1, 2, 3], [5, 7, 9, 11], [1, 1, 1, 1])
    expect(reg).not.toBeNull()
    expect(reg!.slope).toBeCloseTo(2, 9)
    expect(reg!.intercept).toBeCloseTo(5, 9)
  })

  it('somme des poids nulle → null', () => {
    expect(weightedLinearRegression([0, 1, 2], [1, 2, 3], [0, 0, 0])).toBeNull()
  })

  it('tous les x identiques (déterminant ≈ 0) → null', () => {
    expect(weightedLinearRegression([5, 5, 5], [1, 2, 3], [1, 1, 1])).toBeNull()
  })

  it('point unique (déterminant 0) → null', () => {
    expect(weightedLinearRegression([3], [9], [1])).toBeNull()
  })

  it('la pondération déplace la droite vers les points lourds', () => {
    const uniform = weightedLinearRegression([-2, -1, 0], [0, 0, 10], [1, 1, 1])!
    const weighted = weightedLinearRegression([-2, -1, 0], [0, 0, 10], [1, 1, 5])!
    // Le point (0,10) pèse davantage → intercept tiré vers 10
    expect(weighted.intercept).toBeGreaterThan(uniform.intercept)
  })
})

describe('weightedR2', () => {
  it('fit parfait → 1', () => {
    expect(weightedR2([0, 1, 2], [1, 3, 5], [1, 1, 1], 2, 1)).toBeCloseTo(1, 9)
  })

  it('y constant (variance totale nulle) → 0', () => {
    expect(weightedR2([0, 1, 2], [5, 5, 5], [1, 1, 1], 2, 0)).toBe(0)
  })

  it('fit partiel → strictement entre 0 et 1', () => {
    // ys=[0,2,3] vs droite y=2x : résidu uniquement sur le dernier point
    const r2 = weightedR2([0, 1, 2], [0, 2, 3], [1, 1, 1], 2, 0)
    expect(r2).toBeCloseTo(0.7857, 3)
    expect(r2).toBeGreaterThan(0)
    expect(r2).toBeLessThan(1)
  })

  it('jamais négatif (clamp à 0 si le modèle est pire que la moyenne)', () => {
    const r2 = weightedR2([0, 1, 2], [0, 2, 4], [1, 1, 1], -5, 100)
    expect(r2).toBe(0)
  })
})

describe('computePrediction — pipeline via DB mockée', () => {
  const NOW = 1_700_000_000_000
  let nowSpy: jest.SpyInstance

  beforeEach(() => {
    mockGetAllAsync.mockReset()
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW)
  })
  afterEach(() => nowSpy.mockRestore())

  // Façonne mockGetAllAsync : 1er appel = sets ; ensuite COUNT / SUM selon le SQL.
  function mockDb(
    sets: Array<{ weight_kg: number; reps: number; logged_at: number }>,
    opts?: {
      recentSessions?: number
      vol7?: number
      vol30?: number
    }
  ) {
    const { recentSessions = 4, vol7 = 10000, vol30 = 40000 } = opts ?? {}
    mockGetAllAsync.mockImplementation((query: string) => {
      if (query.includes('ORDER BY logged_at ASC')) return Promise.resolve(sets)
      if (query.includes('COUNT(DISTINCT')) return Promise.resolve([{ cnt: recentSessions }])
      if (query.includes('SUM(volume)')) {
        // 7j passé avant 30j → on distingue par l'ordre d'appel restant
        const v = mockGetAllAsync.mock.calls.filter((c) =>
          String(c[0]).includes('SUM(volume)')
        ).length
        return Promise.resolve([{ v: v === 1 ? vol7 : vol30 }])
      }
      return Promise.resolve([])
    })
  }

  it('moins de 4 points → null', async () => {
    mockDb([
      { weight_kg: 50, reps: 1, logged_at: NOW - 3 * MS_PER_DAY },
      { weight_kg: 52, reps: 1, logged_at: NOW - 2 * MS_PER_DAY },
      { weight_kg: 54, reps: 1, logged_at: NOW - 1 * MS_PER_DAY },
    ])
    expect(await computePrediction('ex1', 'Développé')).toBeNull()
  })

  it('tous les sets le même jour (dédup → 1 point) → null', async () => {
    const day = NOW - 2 * MS_PER_DAY
    mockDb([
      { weight_kg: 50, reps: 1, logged_at: day + 1 },
      { weight_kg: 52, reps: 1, logged_at: day + 2 },
      { weight_kg: 54, reps: 1, logged_at: day + 3 },
      { weight_kg: 56, reps: 1, logged_at: day + 4 },
      { weight_kg: 58, reps: 1, logged_at: day + 5 },
    ])
    expect(await computePrediction('ex1', 'Développé')).toBeNull()
  })

  it('charges décroissantes (pente ≤ 0) → null', async () => {
    // charges qui baissent dans le temps → pas de progression à prédire
    const decreasing = [
      { weight_kg: 70, reps: 1, logged_at: NOW - 8 * MS_PER_DAY },
      { weight_kg: 66, reps: 1, logged_at: NOW - 6 * MS_PER_DAY },
      { weight_kg: 62, reps: 1, logged_at: NOW - 4 * MS_PER_DAY },
      { weight_kg: 58, reps: 1, logged_at: NOW - 2 * MS_PER_DAY },
      { weight_kg: 54, reps: 1, logged_at: NOW - 0 * MS_PER_DAY },
    ]
    mockDb(decreasing)
    expect(await computePrediction('ex1', 'Squat')).toBeNull()
  })

  it('progression nette avec pic au-dessus de la tendance → prédiction valide', async () => {
    // 12 jours, charge croissante + un pic (jour -5) au-dessus de la tendance.
    const weights: Record<number, number> = {
      11: 40,
      10: 42,
      9: 44,
      8: 46,
      7: 48,
      6: 50,
      5: 58, // pic / PR au-dessus de la droite
      4: 52,
      3: 53,
      2: 54,
      1: 55,
      0: 56,
    }
    const sets = Object.entries(weights).map(([dayAgo, w], i) => ({
      weight_kg: w,
      reps: 1,
      logged_at: NOW - Number(dayAgo) * MS_PER_DAY,
      session_id: `s${i}`,
    }))
    mockDb(sets, { recentSessions: 4, vol7: 10000, vol30: 40000 })

    const pred = await computePrediction('ex1', 'Développé couché')
    expect(pred).not.toBeNull()
    expect(pred!.exerciseId).toBe('ex1')
    expect(pred!.exerciseName).toBe('Développé couché')
    expect(pred!.daysUntilPR).toBeGreaterThan(0)
    expect(pred!.daysUntilPR).toBeLessThanOrEqual(120)
    expect(pred!.confidence).toBeGreaterThanOrEqual(0.6)
    expect(pred!.confidence).toBeLessThanOrEqual(1)
    // Le PR prédit dépasse le record actuel (max = 58)
    expect(pred!.predictedPR).toBeGreaterThan(58)
    expect(pred!.delta).toBeGreaterThan(0)
  })

  it('erreur DB → null (catch global)', async () => {
    mockGetAllAsync.mockRejectedValue(new Error('db down'))
    expect(await computePrediction('ex1', 'Squat')).toBeNull()
  })
})
