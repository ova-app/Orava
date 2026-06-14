/**
 * predictor.ts — computeConfidence (ORA-005).
 *
 * Bug historique : poids multipliés (max ≈ 0,0275 < seuil 0,6) → predictor 100 % mort.
 * Fix : somme pondérée (R² 55 % + points 25 % + fréquence 20 %) × fatigue, plafond 1.0.
 *
 * getDB n'est pas appelé par computeConfidence mais predictor.ts l'importe au top-level
 * → mock pour éviter expo-sqlite.
 */

jest.mock('../lib/db', () => ({ getDB: jest.fn() }))

import { computeConfidence } from '../lib/predictor'

describe('computeConfidence — somme pondérée', () => {
  it('fit parfait, données denses, fréquence pleine, zéro fatigue → 1.0', () => {
    expect(computeConfidence(1, 15, 4, 1)).toBeCloseTo(1, 5)
  })

  it('fit parfait seul (R²=1) → 0.55 (atteint le seuil de 0,6 ? non — montre que R² seul ne suffit pas)', () => {
    expect(computeConfidence(1, 0, 0, 1)).toBeCloseTo(0.55, 5)
  })

  it('R²=0.8 + 15 points + 4 séances → dépasse le seuil 0.6', () => {
    const c = computeConfidence(0.8, 15, 4, 1)
    // 0.8*0.55 + 1*0.25 + 1*0.20 = 0.89
    expect(c).toBeCloseTo(0.89, 5)
    expect(c).toBeGreaterThanOrEqual(0.6)
  })

  it('fatigue divise la confiance finale', () => {
    expect(computeConfidence(1, 15, 4, 0.5)).toBeCloseTo(0.5, 5)
  })

  it('jamais > 1.0 même avec tous facteurs au max', () => {
    expect(computeConfidence(1, 100, 100, 1)).toBeLessThanOrEqual(1)
  })

  it('pointsFactor plafonné à 1 (15 points = plein)', () => {
    expect(computeConfidence(0, 15, 0, 1)).toBeCloseTo(0.25, 5)
    expect(computeConfidence(0, 30, 0, 1)).toBeCloseTo(0.25, 5)
  })

  it('freqFactor plafonné à 1 (4 séances = plein)', () => {
    expect(computeConfidence(0, 0, 4, 1)).toBeCloseTo(0.2, 5)
    expect(computeConfidence(0, 0, 8, 1)).toBeCloseTo(0.2, 5)
  })

  it('tout à zéro → 0', () => {
    expect(computeConfidence(0, 0, 0, 1)).toBe(0)
  })

  it('régression : ne retourne plus une valeur microscopique (ancien bug)', () => {
    // Ancienne formule : 0.8*0.55*1*0.25*1*0.20*1 ≈ 0.022 → toujours < 0.6
    const c = computeConfidence(0.8, 15, 4, 1)
    expect(c).toBeGreaterThan(0.1)
  })
})
