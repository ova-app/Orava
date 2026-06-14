import { formatVolumeKg, formatDuration, epley1RM } from '../lib/utils'

// ─── formatVolumeKg (ORA-035) ─────────────────────────────────────────────────
describe('formatVolumeKg', () => {
  it('null → tiret', () => {
    expect(formatVolumeKg(null)).toBe('—')
  })
  it('< 1000 → "N kg"', () => {
    expect(formatVolumeKg(750)).toBe('750 kg')
  })
  it('arrondit', () => {
    expect(formatVolumeKg(42.7)).toBe('43 kg')
  })
  it('>= 1000 → espace milliers + suffixe, reste paddé', () => {
    expect(formatVolumeKg(12450)).toBe('12 450 kg')
    expect(formatVolumeKg(1000)).toBe('1 000 kg')
    expect(formatVolumeKg(1001)).toBe('1 001 kg')
    expect(formatVolumeKg(1010)).toBe('1 010 kg')
  })
  it('0 → "0 kg"', () => {
    expect(formatVolumeKg(0)).toBe('0 kg')
  })
})

// ─── formatDuration (ORA-035) ─────────────────────────────────────────────────
describe('formatDuration', () => {
  it('null / 0 / négatif → tiret', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
  })
  it('< 1h → "Nmin"', () => {
    expect(formatDuration(45 * 60)).toBe('45min')
    expect(formatDuration(90)).toBe('1min')
  })
  it('>= 1h → minutes paddées sur 2 chiffres', () => {
    expect(formatDuration(3600 + 5 * 60)).toBe('1h 05min')
    expect(formatDuration(2 * 3600 + 45 * 60)).toBe('2h 45min')
    expect(formatDuration(3600)).toBe('1h 00min')
  })
})

// ─── epley1RM (ORA-035) ───────────────────────────────────────────────────────
describe('epley1RM', () => {
  it('reps === 1 → poids brut (pas de majoration)', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })
  it('reps > 1 → formule Epley w*(1 + r/30)', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 2)
    expect(epley1RM(60, 5)).toBeCloseTo(70, 5)
  })
  it('reps === 0 → 0 (poids × 1, single non atteint)', () => {
    expect(epley1RM(80, 0)).toBe(80)
  })
})
