/**
 * featuredPhoto.ts — photo épinglée de la vitrine (ORA-084).
 *
 * Import RÉEL (cf. ORA-045). Lecture/écriture best-effort (colonne featured_photo
 * absente pré-migration → null/false silencieux). pin/clear exigent un user
 * authentifié (auth.getUser). On stubbe supabase (chaîne select/update + auth) + logger.
 */

const mockSingle = jest.fn()
const mockSelectEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockSelectEq }))
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))
const mockFrom = jest.fn((..._args: unknown[]) => ({ select: mockSelect, update: mockUpdate }))
const mockGetUser = jest.fn()

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  },
}))
jest.mock('../lib/logger', () => ({
  log: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import {
  FeaturedPhoto,
  getFeaturedPhoto,
  pinFeaturedPhoto,
  clearFeaturedPhoto,
} from '../lib/featuredPhoto'

const photo: FeaturedPhoto = {
  id: 'w-42',
  photo_url: 'https://cdn/x.jpg',
  source: 'workout',
  workout_id: 'w-42',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getFeaturedPhoto', () => {
  it('pointeur présent → renvoie le snapshot', async () => {
    mockSingle.mockResolvedValueOnce({ data: { featured_photo: photo }, error: null })
    expect(await getFeaturedPhoto('u1')).toEqual(photo)
    expect(mockSelectEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('rien épinglé (null) → null', async () => {
    mockSingle.mockResolvedValueOnce({ data: { featured_photo: null }, error: null })
    expect(await getFeaturedPhoto('u1')).toBeNull()
  })

  it('erreur supabase (colonne absente) → null', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no column' } })
    expect(await getFeaturedPhoto('u1')).toBeNull()
  })

  it('exception → null (catch)', async () => {
    mockSingle.mockRejectedValueOnce(new Error('net'))
    expect(await getFeaturedPhoto('u1')).toBeNull()
  })
})

describe('pinFeaturedPhoto', () => {
  it('user authentifié + écriture OK → true, update ciblé sur son id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockUpdateEq.mockResolvedValueOnce({ error: null })
    expect(await pinFeaturedPhoto(photo)).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ featured_photo: photo })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('non authentifié → false sans écrire', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await pinFeaturedPhoto(photo)).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('erreur d’écriture → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'rls' } })
    expect(await pinFeaturedPhoto(photo)).toBe(false)
  })
})

describe('clearFeaturedPhoto', () => {
  it('user authentifié → met featured_photo à NULL → true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockUpdateEq.mockResolvedValueOnce({ error: null })
    expect(await clearFeaturedPhoto()).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ featured_photo: null })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('non authentifié → false sans écrire', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    expect(await clearFeaturedPhoto()).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('erreur d’écriture → false', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'denied' } })
    expect(await clearFeaturedPhoto()).toBe(false)
  })
})
