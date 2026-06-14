// ─── Formatage volume avec espace milliers (fr-FR style) ──────────────────────
// Source unique (ORA-035) — auparavant redéclaré dans feed / history / feed[id] /
// history[id] / analytics.

export function formatVolume(kg: number | null): string {
  if (kg == null) return '—'
  const rounded = Math.round(kg)
  if (rounded >= 1000) {
    const thousands = Math.floor(rounded / 1000)
    const rest = rounded % 1000
    return `${thousands} ${rest.toString().padStart(3, '0')}`
  }
  return `${rounded}`
}

// Idem formatVolume mais avec suffixe " kg" (feed[id] / history[id]).
export function formatVolumeKg(kg: number | null): string {
  if (kg == null) return '—'
  const rounded = Math.round(kg)
  if (rounded >= 1000) {
    const thousands = Math.floor(rounded / 1000)
    const rest = rounded % 1000
    return `${thousands} ${rest.toString().padStart(3, '0')} kg`
  }
  return `${rounded} kg`
}

// ─── Formatage durée — secondes → "1h 05min" / "45min" / "—" ──────────────────
// Source unique (ORA-035) — auparavant ×6 (feed, history, profile, history[id],
// feed[id], summary). Format canonique : minutes paddées sur 2 chiffres si heures.

export function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${m}min`
}

// ─── 1RM estimé (formule Epley) ───────────────────────────────────────────────
// Source unique (ORA-035) — auparavant dupliqué predictor.ts + summary.tsx.
// reps === 1 → poids brut (évite la majoration Epley sur un single).

export function epley1RM(weight_kg: number, reps: number): number {
  return reps === 1 ? weight_kg : weight_kg * (1 + reps / 30)
}
