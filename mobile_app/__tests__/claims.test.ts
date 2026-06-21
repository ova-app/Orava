/**
 * claims.ts — logique pure de résolution des claims (ORA-080).
 *
 * Testée par IMPORT RÉEL (pas de recopie — cf. ORA-045) : décision de résolution
 * weight/sessions, toggle de pronostic, échéance, track record, deadline. Le module
 * importe lib/supabase au top-level (createClient throw sans EXPO_PUBLIC_* en test)
 * → on le stubbe, les fonctions pures ne l'utilisent pas.
 */

jest.mock('../lib/supabase', () => ({ supabase: {} }))

import {
  claimDeadline,
  decideWeightResolution,
  decideSessionProgress,
  decideManualValidation,
  nextVoteAction,
  isOverdue,
  computeTrackRecord,
  nearMissGap,
} from '../lib/claims'

describe('claimDeadline', () => {
  it("scope 'next_session' → pas d'échéance", () => {
    expect(claimDeadline('next_session', Date.now())).toBeNull()
  })

  it("scope 'week' → now + 7 jours exactement (ISO)", () => {
    const now = Date.UTC(2026, 5, 20, 0, 0, 0)
    const d = claimDeadline('week', now)
    expect(d).toBe(new Date(now + 7 * 86400000).toISOString())
    expect(new Date(d!).getTime() - now).toBe(7 * 86400000)
  })

  it("scope 'month' → now + 30 jours", () => {
    const now = Date.UTC(2026, 5, 20, 0, 0, 0)
    expect(claimDeadline('month', now)).toBe(new Date(now + 30 * 86400000).toISOString())
  })

  it("scope 'custom' → la date fournie", () => {
    const now = Date.UTC(2026, 5, 20)
    const target = Date.UTC(2026, 8, 1, 22, 0, 0)
    expect(claimDeadline('custom', now, target)).toBe(new Date(target).toISOString())
  })

  it("scope 'custom' sans date → pas d'échéance (garde-fou)", () => {
    expect(claimDeadline('custom', Date.now(), null)).toBeNull()
    expect(claimDeadline('custom', Date.now())).toBeNull()
  })
})

describe('decideWeightResolution', () => {
  it('exo non travaillé (undefined) → null (reste actif)', () => {
    expect(decideWeightResolution(undefined, 100)).toBeNull()
  })

  it('exo non travaillé (null) → null', () => {
    expect(decideWeightResolution(null, 100)).toBeNull()
  })

  it('cible atteinte à égalité → succeeded', () => {
    expect(decideWeightResolution(100, 100)).toBe('succeeded')
  })

  it('cible dépassée → succeeded', () => {
    expect(decideWeightResolution(102.5, 100)).toBe('succeeded')
  })

  it('sous la cible → failed', () => {
    expect(decideWeightResolution(97.5, 100)).toBe('failed')
  })

  it('reached 0 → failed (0 = vraie valeur travaillée, pas une absence)', () => {
    expect(decideWeightResolution(0, 100)).toBe('failed')
  })

  it("échéance datée + sous la cible → null (reste actif jusqu'à la deadline)", () => {
    expect(decideWeightResolution(97.5, 100, 'week')).toBeNull()
    expect(decideWeightResolution(97.5, 100, 'month')).toBeNull()
    expect(decideWeightResolution(97.5, 100, 'custom')).toBeNull()
  })

  it('échéance datée + cible atteinte → succeeded (succès anticipé)', () => {
    expect(decideWeightResolution(100, 100, 'week')).toBe('succeeded')
    expect(decideWeightResolution(105, 100, 'custom')).toBe('succeeded')
  })

  it('next_session explicite + sous la cible → failed (un seul essai promis)', () => {
    expect(decideWeightResolution(97.5, 100, 'next_session')).toBe('failed')
  })
})

describe('decideSessionProgress', () => {
  it('incrémente sans atteindre la cible → status null', () => {
    expect(decideSessionProgress(0, 4)).toEqual({ next: 1, status: null })
    expect(decideSessionProgress(2, 4)).toEqual({ next: 3, status: null })
  })

  it('atteint pile la cible → succeeded', () => {
    expect(decideSessionProgress(3, 4)).toEqual({ next: 4, status: 'succeeded' })
  })

  it('dépasse la cible → succeeded', () => {
    expect(decideSessionProgress(5, 4)).toEqual({ next: 6, status: 'succeeded' })
  })
})

describe('decideManualValidation (« Valider » — tranche toujours)', () => {
  it('atteint la cible → succeeded', () => {
    expect(decideManualValidation(100, 100)).toBe('succeeded')
    expect(decideManualValidation(105, 100)).toBe('succeeded')
  })

  it('sous la cible → failed (peu importe le scope, on force la résolution)', () => {
    expect(decideManualValidation(97.5, 100)).toBe('failed')
    expect(decideManualValidation(0, 100)).toBe('failed')
  })
})

describe('nextVoteAction (toggle pronostic)', () => {
  it('aucun vote + believe → pose believe', () => {
    expect(nextVoteAction(null, 'believe')).toEqual({ kind: 'set', vote: 'believe' })
  })

  it('believe + re-tap believe → retrait', () => {
    expect(nextVoteAction('believe', 'believe')).toEqual({ kind: 'retract' })
  })

  it('believe → doubt → écrase en doubt', () => {
    expect(nextVoteAction('believe', 'doubt')).toEqual({ kind: 'set', vote: 'doubt' })
  })

  it('doubt + re-tap doubt → retrait', () => {
    expect(nextVoteAction('doubt', 'doubt')).toEqual({ kind: 'retract' })
  })
})

describe('isOverdue', () => {
  const now = Date.UTC(2026, 5, 20)

  it('pas de deadline (next_session) → jamais en retard', () => {
    expect(isOverdue(null, now)).toBe(false)
  })

  it('deadline future → pas en retard', () => {
    expect(isOverdue(new Date(now + 86400000).toISOString(), now)).toBe(false)
  })

  it('deadline passée → en retard', () => {
    expect(isOverdue(new Date(now - 1).toISOString(), now)).toBe(true)
  })
})

describe('computeTrackRecord', () => {
  it('liste vide → 0/0', () => {
    expect(computeTrackRecord([])).toEqual({ succeeded: 0, total: 0 })
  })

  it('compte succeeded + failed, ignore expired/active', () => {
    expect(computeTrackRecord(['succeeded', 'failed', 'succeeded', 'expired', 'active'])).toEqual({
      succeeded: 2,
      total: 3,
    })
  })

  it('que des succès → total = succeeded', () => {
    expect(computeTrackRecord(['succeeded', 'succeeded'])).toEqual({ succeeded: 2, total: 2 })
  })

  it('que des échecs → succeeded 0', () => {
    expect(computeTrackRecord(['failed', 'failed'])).toEqual({ succeeded: 0, total: 2 })
  })
})

describe('nearMissGap (ORA-081)', () => {
  it('valeur résolue absente → null', () => {
    expect(nearMissGap(100, null)).toBeNull()
  })

  it('manqué = cible − atteint', () => {
    expect(nearMissGap(100, 97.5)).toBe(2.5)
  })

  it('atteint ≥ cible → 0 (jamais négatif)', () => {
    expect(nearMissGap(100, 100)).toBe(0)
    expect(nearMissGap(100, 105)).toBe(0)
  })

  it('sessions : 3 sur 4 → manqué 1', () => {
    expect(nearMissGap(4, 3)).toBe(1)
  })
})
