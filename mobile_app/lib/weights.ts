// ─── Granulométrie poids + reps — source unique (ORA-035) ────────────────────
// Auparavant dupliqué dans session.tsx et wheel-picker-modal.tsx.
// Granulométrie figée (cf. rules/workout.md — ne pas modifier).

export const REPS_VALUES = Array.from({ length: 50 }, (_, i) => i + 1)

// Valeurs de poids sélectionnables selon l'équipement.
// dumbbell : 2 kg · barbell : barre + disques · kettlebell : 4 kg · défaut (poulie/machine) : 2,5 kg
export function getWeightValues(equipType: string | null): number[] {
  if (equipType === 'bodyweight') return []
  if (equipType === 'dumbbell') return Array.from({ length: 30 }, (_, i) => (i + 1) * 2)
  if (equipType === 'barbell') {
    return [
      20, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150, 160,
      170, 180, 190, 200, 210, 220,
    ]
  }
  if (equipType === 'kettlebell') return Array.from({ length: 12 }, (_, i) => (i + 1) * 4)
  return Array.from({ length: 80 }, (_, i) => (i + 1) * 2.5)
}
