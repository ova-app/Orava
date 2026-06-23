/**
 * claims.ts — fonctions ASYNC (accès Supabase) par IMPORT RÉEL (cf. ORA-045 / ORA-080).
 *
 * Le fichier claims.test.ts couvre déjà les helpers PURS. Ici on exerce les fonctions
 * qui parlent à Supabase, via un mock « builder thenable » : chaque supabase.from()
 * renvoie un proxy chaînable (.select/.eq/.in/.order/.limit/.maybeSingle… renvoient le
 * même proxy) qui résout vers le prochain résultat mis en file (mockQueue). Une file =
 * un from() consommé dans l'ordre d'appel. supabase.auth.getUser est mocké à part.
 */

type Res = { data?: unknown; error?: unknown; count?: number | null }
const mockQueue: Res[] = []
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

import type { Claim } from '../lib/claims'
import {
  getActiveClaim,
  cancelClaim,
  abandonClaim,
  getResolvedClaims,
  getRecentFailedClaim,
  getClaimVotes,
  voteClaim,
  toggleClaimLike,
  fetchClaimComments,
  fetchClaimLikeUsers,
  postClaimComment,
  deleteClaimComment,
  getTrackRecord,
  resolveClaimsAfterWorkout,
  expireOverdueClaims,
} from '../lib/claims'

const enqueue = (...rs: Res[]) => mockQueue.push(...rs)

// Claim minimal — les fonctions castent `data as Claim`, la forme exacte n'importe pas ici.
const claim = (over: Record<string, unknown> = {}): Claim =>
  ({
    id: 'c1',
    user_id: 'u1',
    type: 'weight',
    exercise_id: 'e1',
    exercise_name: 'Développé couché',
    target_value: 100,
    unit: 'kg',
    scope: 'next_session',
    status: 'active',
    progress_current: 0,
    resolved_value: null,
    resolved_at: null,
    deadline: null,
    is_public: true,
    created_at: '2026-06-01T00:00:00.000Z',
    ...over,
  }) as Claim

beforeEach(() => {
  mockQueue.length = 0
  jest.clearAllMocks()
})

describe('getActiveClaim', () => {
  it('renvoie le claim actif', async () => {
    enqueue({ data: claim(), error: null })
    expect(await getActiveClaim('u1')).toMatchObject({ id: 'c1' })
  })
  it('aucun actif → null', async () => {
    enqueue({ data: null, error: null })
    expect(await getActiveClaim('u1')).toBeNull()
  })
  it('erreur → null', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await getActiveClaim('u1')).toBeNull()
  })
})

describe('cancelClaim', () => {
  it('succès → ne throw pas', async () => {
    enqueue({ error: null })
    await expect(cancelClaim('c1')).resolves.toBeUndefined()
  })
  it('erreur → avalée (log)', async () => {
    enqueue({ error: { message: 'x' } })
    await expect(cancelClaim('c1')).resolves.toBeUndefined()
  })
})

describe('abandonClaim', () => {
  it('renvoie le claim marqué failed', async () => {
    enqueue({ data: claim({ status: 'failed', resolved_value: null }), error: null })
    const r = await abandonClaim(claim())
    expect(r).toMatchObject({ status: 'failed' })
  })
  it('erreur → null', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await abandonClaim(claim())).toBeNull()
  })
})

describe('getResolvedClaims', () => {
  it('renvoie la liste', async () => {
    enqueue({
      data: [claim({ status: 'succeeded' }), claim({ id: 'c2', status: 'failed' })],
      error: null,
    })
    expect(await getResolvedClaims('u1')).toHaveLength(2)
  })
  it('erreur → []', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await getResolvedClaims('u1')).toEqual([])
  })
})

describe('getRecentFailedClaim', () => {
  it('renvoie le dernier failed récent', async () => {
    enqueue({ data: claim({ status: 'failed' }), error: null })
    expect(await getRecentFailedClaim('u1')).toMatchObject({ status: 'failed' })
  })
  it('erreur → null', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await getRecentFailedClaim('u1')).toBeNull()
  })
})

describe('getClaimVotes', () => {
  it('agrège believe/doubt + repère mon vote', async () => {
    enqueue({
      data: [
        { user_id: 'a', vote: 'believe' },
        { user_id: 'b', vote: 'believe' },
        { user_id: 'c', vote: 'doubt' },
        { user_id: 'me', vote: 'doubt' },
      ],
      error: null,
    })
    expect(await getClaimVotes('c1', 'me')).toEqual({ believe: 2, doubt: 2, mine: 'doubt' })
  })
  it('je n’ai pas voté → mine null', async () => {
    enqueue({ data: [{ user_id: 'a', vote: 'believe' }], error: null })
    expect(await getClaimVotes('c1', 'me')).toEqual({ believe: 1, doubt: 0, mine: null })
  })
  it('erreur → compteurs à zéro', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await getClaimVotes('c1', 'me')).toEqual({ believe: 0, doubt: 0, mine: null })
  })
})

describe('voteClaim', () => {
  it('non authentifié → no-op', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(voteClaim('c1', 'believe')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0) // aucun résultat consommé
  })
  it('nouveau vote → upsert (existing null)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ data: null, error: null }) // select existing
    enqueue({ error: null }) // upsert
    await expect(voteClaim('c1', 'believe')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0)
  })
  it('re-tap le même vote → retract (delete)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ data: { vote: 'believe' }, error: null }) // existing = believe
    enqueue({ error: null }) // delete
    await expect(voteClaim('c1', 'believe')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0)
  })
})

describe('toggleClaimLike', () => {
  it('non authentifié → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await toggleClaimLike('c1', false)).toBe(false)
  })
  it('like (insert) succès → true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: null })
    expect(await toggleClaimLike('c1', false)).toBe(true)
  })
  it('unlike (delete) erreur → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: { message: 'x' } })
    expect(await toggleClaimLike('c1', true)).toBe(false)
  })
})

describe('fetchClaimComments', () => {
  it('mappe + normalise l’embed users (objet ou tableau)', async () => {
    enqueue({
      data: [
        {
          id: 'k1',
          content: 'go',
          created_at: 't',
          user_id: 'a',
          users: { id: 'a', username: 'al' },
        },
        {
          id: 'k2',
          content: 'gg',
          created_at: 't',
          user_id: 'b',
          users: [{ id: 'b', username: 'bo' }],
        },
      ],
      error: null,
    })
    const r = await fetchClaimComments('c1')
    expect(r).toHaveLength(2)
    expect(r[0].users).toMatchObject({ username: 'al' })
    expect(r[1].users).toMatchObject({ username: 'bo' }) // tableau aplati
  })
  it('erreur → []', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await fetchClaimComments('c1')).toEqual([])
  })
})

describe('fetchClaimLikeUsers', () => {
  it('mappe les likers + embed users', async () => {
    enqueue({
      data: [{ user_id: 'a', created_at: 't', users: { id: 'a', username: 'al' } }],
      error: null,
    })
    const r = await fetchClaimLikeUsers('c1')
    expect(r[0]).toMatchObject({ user_id: 'a', users: { username: 'al' } })
  })
  it('erreur → []', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await fetchClaimLikeUsers('c1')).toEqual([])
  })
})

describe('postClaimComment / deleteClaimComment', () => {
  it('post non authentifié → no-op', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(postClaimComment('c1', 'hi')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0)
  })
  it('post authentifié → insert', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    enqueue({ error: null })
    await expect(postClaimComment('c1', 'hi')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0)
  })
  it('delete → ne throw pas', async () => {
    enqueue({ error: null })
    await expect(deleteClaimComment('k1')).resolves.toBeUndefined()
  })
})

describe('getTrackRecord', () => {
  it('compte succeeded / total (succeeded+failed)', async () => {
    enqueue({
      data: [{ status: 'succeeded' }, { status: 'succeeded' }, { status: 'failed' }],
      error: null,
    })
    expect(await getTrackRecord('u1')).toEqual({ succeeded: 2, total: 3 })
  })
  it('erreur → 0/0', async () => {
    enqueue({ data: null, error: { message: 'x' } })
    expect(await getTrackRecord('u1')).toEqual({ succeeded: 0, total: 0 })
  })
})

describe('resolveClaimsAfterWorkout', () => {
  it('aucun claim actif → []', async () => {
    enqueue({ data: [], error: null }) // fetchAllActive
    expect(await resolveClaimsAfterWorkout('u1', { maxWeightByExercise: {} })).toEqual([])
  })

  it('claim weight atteint → résolu succeeded', async () => {
    enqueue({ data: [claim()], error: null }) // fetchAllActive
    enqueue({ data: claim({ status: 'succeeded', resolved_value: 110 }), error: null }) // applyResolution
    const r = await resolveClaimsAfterWorkout('u1', { maxWeightByExercise: { e1: 110 } })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ status: 'succeeded' })
  })

  it('claim weight exo non travaillé → reste actif (rien résolu)', async () => {
    enqueue({ data: [claim()], error: null }) // fetchAllActive ; exo e1 absent du contexte
    const r = await resolveClaimsAfterWorkout('u1', { maxWeightByExercise: { autre: 50 } })
    expect(r).toEqual([])
  })

  it('claim sessions non atteint → incrémente progress (rien résolu)', async () => {
    enqueue({
      data: [claim({ type: 'sessions', exercise_id: null, target_value: 5, progress_current: 1 })],
      error: null,
    })
    enqueue({ error: null }) // update progress_current
    const r = await resolveClaimsAfterWorkout('u1', { maxWeightByExercise: {} })
    expect(r).toEqual([])
  })
})

describe('expireOverdueClaims', () => {
  it('claim échu → applyResolution failed', async () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    enqueue({ data: [claim({ scope: 'week', deadline: past })], error: null }) // fetchAllActive
    enqueue({ data: claim({ status: 'failed' }), error: null }) // applyResolution
    await expect(expireOverdueClaims('u1')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0)
  })

  it('claim non échu → rien (deadline future)', async () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    enqueue({ data: [claim({ scope: 'week', deadline: future })], error: null })
    await expect(expireOverdueClaims('u1')).resolves.toBeUndefined()
    expect(mockQueue.length).toBe(0) // pas d'applyResolution consommé
  })
})
