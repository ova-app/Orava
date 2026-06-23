/**
 * profileBio.ts — bio courte du profil (ORA-085).
 *
 * Import RÉEL (cf. ORA-045). sanitizeBio est pure ; getProfileBio/saveProfileBio
 * sont best-effort (colonne users.bio absente pré-migration → null/false silencieux).
 * On stubbe supabase (chaîne select/update) + logger pour exercer les deux chemins.
 */

const mockSingle = jest.fn()
const mockSelectEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockSelectEq }))
const mockUpdateEq = jest.fn()
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }))
const mockFrom = jest.fn((..._args: unknown[]) => ({ select: mockSelect, update: mockUpdate }))

jest.mock('../lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))
jest.mock('../lib/logger', () => ({
  log: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import { BIO_MAX, sanitizeBio, getProfileBio, saveProfileBio } from '../lib/profileBio'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('sanitizeBio (pure)', () => {
  it('compresse espaces/sauts de ligne en un seul espace + trim', () => {
    expect(sanitizeBio('  coach\n\n  de   force  ')).toBe('coach de force')
  })

  it('coupe à BIO_MAX caractères', () => {
    const long = 'a'.repeat(200)
    expect(sanitizeBio(long)).toHaveLength(BIO_MAX)
  })

  it('compte les caractères APRÈS normalisation (espaces multiples ne gonflent pas)', () => {
    const raw = `${'x'.repeat(68)}     ${'y'.repeat(20)}`
    const out = sanitizeBio(raw)
    expect(out.length).toBeLessThanOrEqual(BIO_MAX)
    expect(out.startsWith('x'.repeat(68))).toBe(true)
  })

  it('chaîne vide / blancs → vide', () => {
    expect(sanitizeBio('   \n  ')).toBe('')
  })
})

describe('getProfileBio', () => {
  it('bio présente → renvoie la valeur', async () => {
    mockSingle.mockResolvedValueOnce({ data: { bio: 'Powerlifteur' }, error: null })
    expect(await getProfileBio('u1')).toBe('Powerlifteur')
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(mockSelectEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('bio blanche en base → null', async () => {
    mockSingle.mockResolvedValueOnce({ data: { bio: '   ' }, error: null })
    expect(await getProfileBio('u1')).toBeNull()
  })

  it('bio null → null', async () => {
    mockSingle.mockResolvedValueOnce({ data: { bio: null }, error: null })
    expect(await getProfileBio('u1')).toBeNull()
  })

  it('erreur supabase (colonne absente pré-migration) → null', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'column bio does not exist' },
    })
    expect(await getProfileBio('u1')).toBeNull()
  })

  it('exception réseau → null (catch, ne throw pas)', async () => {
    mockSingle.mockRejectedValueOnce(new Error('network'))
    expect(await getProfileBio('u1')).toBeNull()
  })
})

describe('saveProfileBio', () => {
  it('persiste la bio nettoyée → true', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: null })
    expect(await saveProfileBio('u1', '  salle   de   sport  ')).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ bio: 'salle de sport' })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('bio vide → écrit NULL', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: null })
    expect(await saveProfileBio('u1', '    ')).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ bio: null })
  })

  it('erreur supabase → false', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'denied' } })
    expect(await saveProfileBio('u1', 'x')).toBe(false)
  })

  it('exception → false (catch)', async () => {
    mockUpdateEq.mockRejectedValueOnce(new Error('boom'))
    expect(await saveProfileBio('u1', 'x')).toBe(false)
  })
})
