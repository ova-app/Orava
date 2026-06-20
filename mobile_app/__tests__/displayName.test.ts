jest.mock('../lib/supabase', () => ({ supabase: {} }))

import { splitFullName, joinFullName, resolveDisplayName } from '@/lib/displayName'

describe('splitFullName', () => {
  it('vide → prénom et nom vides', () => {
    expect(splitFullName(null)).toEqual({ firstName: '', lastName: '' })
    expect(splitFullName('')).toEqual({ firstName: '', lastName: '' })
    expect(splitFullName('   ')).toEqual({ firstName: '', lastName: '' })
  })

  it('un seul mot → prénom seul', () => {
    expect(splitFullName('Sofiane')).toEqual({ firstName: 'Sofiane', lastName: '' })
  })

  it('deux mots → prénom + nom', () => {
    expect(splitFullName('Sofiane Bessila')).toEqual({ firstName: 'Sofiane', lastName: 'Bessila' })
  })

  it('nom composé → 1er mot prénom, reste = nom', () => {
    expect(splitFullName('Jean Pierre De La Tour')).toEqual({
      firstName: 'Jean',
      lastName: 'Pierre De La Tour',
    })
  })

  it('espaces multiples normalisés', () => {
    expect(splitFullName('  Sofiane   Bessila  ')).toEqual({
      firstName: 'Sofiane',
      lastName: 'Bessila',
    })
  })
})

describe('joinFullName', () => {
  it('concatène prénom + nom', () => {
    expect(joinFullName('Sofiane', 'Bessila')).toBe('Sofiane Bessila')
  })

  it('ignore les champs vides', () => {
    expect(joinFullName('Sofiane', '')).toBe('Sofiane')
    expect(joinFullName('', 'Bessila')).toBe('Bessila')
    expect(joinFullName('', '')).toBe('')
  })

  it('trim les bords', () => {
    expect(joinFullName('  Sofiane  ', '  Bessila ')).toBe('Sofiane Bessila')
  })
})

describe('resolveDisplayName', () => {
  it('full_name : nom complet prioritaire, repli sur username', () => {
    expect(resolveDisplayName('full_name', 'Sofiane Bessila', 'sof')).toBe('Sofiane Bessila')
    expect(resolveDisplayName('full_name', '', 'sof')).toBe('sof')
    expect(resolveDisplayName('full_name', null, null)).toBe('Athlète')
  })

  it('username : pseudo prioritaire, repli sur nom complet', () => {
    expect(resolveDisplayName('username', 'Sofiane Bessila', 'sof')).toBe('sof')
    expect(resolveDisplayName('username', 'Sofiane Bessila', '')).toBe('Sofiane Bessila')
    expect(resolveDisplayName('username', null, null)).toBe('Athlète')
  })
})
