/**
 * feedSignal.ts — drapeau module-scope d'invalidation du feed (ORA-067).
 *
 * Import RÉEL (cf. ORA-045). Comportement attendu : consommation unique (lire
 * réarme à false). On draine le drapeau en beforeEach (consume → false) pour
 * repartir d'un état propre, indépendamment de l'ordre des tests.
 */

import { markFeedDirty, consumeFeedDirty } from '../lib/feedSignal'

describe('feedSignal — markFeedDirty / consumeFeedDirty', () => {
  beforeEach(() => {
    consumeFeedDirty() // draine un éventuel drapeau résiduel
  })

  it('état initial propre → consume renvoie false', () => {
    expect(consumeFeedDirty()).toBe(false)
  })

  it('mark puis consume → true', () => {
    markFeedDirty()
    expect(consumeFeedDirty()).toBe(true)
  })

  it('consommation unique : deuxième consume → false', () => {
    markFeedDirty()
    expect(consumeFeedDirty()).toBe(true)
    expect(consumeFeedDirty()).toBe(false)
  })

  it('marks multiples → un seul consume true (drapeau, pas compteur)', () => {
    markFeedDirty()
    markFeedDirty()
    markFeedDirty()
    expect(consumeFeedDirty()).toBe(true)
    expect(consumeFeedDirty()).toBe(false)
  })

  it('re-mark après consume → de nouveau true', () => {
    markFeedDirty()
    consumeFeedDirty()
    markFeedDirty()
    expect(consumeFeedDirty()).toBe(true)
  })
})
