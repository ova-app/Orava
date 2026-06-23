/**
 * featuredPr.ts — fonctions ASYNC du PR vedette, par IMPORT RÉEL (cf. ORA-045 / ORA-080).
 *
 * featuredPr.test.ts couvre déjà les helpers purs (selectBestPrSet, computePrDelta).
 * Ici : lecture du pin manuel + pin/clear/hide (auth.getUser + update users.featured_pr).
 * Même mock « builder thenable » que claimsAsync : un from() = un résultat en file.
 */

type Res = { data?: unknown; error?: unknown }
const mockQueue: Res[] = []
const mockUpdate = jest.fn()
const mockGetUser = jest.fn()

function mockBuilder(): unknown {
  const res = mockQueue.shift() ?? { data: null, error: null }
  const pr = Promise.resolve(res)
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return pr.then.bind(pr)
        if (prop === 'catch') return pr.catch.bind(pr)
        if (prop === 'finally') return pr.finally.bind(pr)
        if (prop === 'update')
          return (payload: unknown) => {
            mockUpdate(payload)
            return proxy
          }
        return () => proxy
      },
    }
  )
  return proxy
}

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => mockBuilder(),
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
  },
}))
jest.mock('../lib/logger', () => ({
  log: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import {
  getManualFeaturedPr,
  pinFeaturedPr,
  clearFeaturedPr,
  hideFeaturedPr,
} from '../lib/featuredPr'

const enqueue = (...rs: Res[]) => mockQueue.push(...rs)

const pr = {
  set_id: 's1',
  exercise_id: 'e1',
  exercise_name: 'Développé couché',
  weight_kg: 100,
  reps: 5,
  achieved_at: 1_700_000_000_000,
  delta_kg: 5,
}

beforeEach(() => {
  mockQueue.length = 0
  jest.clearAllMocks()
})

describe('getManualFeaturedPr', () => {
  it('pin présent → renvoie le snapshot', async () => {
    enqueue({ data: { featured_pr: { ...pr, manual: true } }, error: null })
    expect(await getManualFeaturedPr('u1')).toMatchObject({ manual: true, weight_kg: 100 })
  })
  it('rien d’épinglé → null', async () => {
    enqueue({ data: { featured_pr: null }, error: null })
    expect(await getManualFeaturedPr('u1')).toBeNull()
  })
  it('erreur (colonne absente pré-migration) → null', async () => {
    enqueue({ data: null, error: { message: 'no column' } })
    expect(await getManualFeaturedPr('u1')).toBeNull()
  })
})

describe('pinFeaturedPr', () => {
  it('authentifié → écrit manual:true → true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: null })
    expect(await pinFeaturedPr(pr)).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ featured_pr: { ...pr, manual: true } })
  })
  it('non authentifié → false sans écrire', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await pinFeaturedPr(pr)).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
  it('erreur d’écriture → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: { message: 'rls' } })
    expect(await pinFeaturedPr(pr)).toBe(false)
  })
})

describe('clearFeaturedPr', () => {
  it('authentifié → met featured_pr à NULL → true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: null })
    expect(await clearFeaturedPr()).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ featured_pr: null })
  })
  it('non authentifié → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await clearFeaturedPr()).toBe(false)
  })
})

describe('hideFeaturedPr', () => {
  it('authentifié → écrit la sentinelle hidden → true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: null })
    expect(await hideFeaturedPr()).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({
      featured_pr: expect.objectContaining({ hidden: true, manual: true }),
    })
  })
  it('non authentifié → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await hideFeaturedPr()).toBe(false)
  })
  it('erreur d’écriture → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: { message: 'x' } })
    expect(await hideFeaturedPr()).toBe(false)
  })
})
