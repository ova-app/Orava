// ─── Référentiel muscles — source unique (ORA-035) ───────────────────────────
// Centralise les libellés FR auparavant dupliqués dans analytics / history[id] /
// feed[id] / exercise[id] / prs / library. Vocabulaire snake_case = colonnes DB.

// Libellés "groupés" — clé = exercise_muscles.muscle
// (faisceaux d'un même muscle partagent un libellé court ; fessiers fusionnés).
// Usage : analytics.tsx, history/[id].tsx, feed/[id].tsx
export const MUSCLE_LABELS: Record<string, string> = {
  grand_pectoral: 'Pectoraux',
  deltoide: 'Deltoïdes',
  grand_dorsal: 'Grand dorsal',
  trapeze: 'Trapèze',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quadriceps',
  ischio_jambiers: 'Ischio-jambiers',
  fessier_maximus: 'Fessiers',
  fessier_median: 'Fessiers',
  fessier_minimus: 'Fessiers',
  mollets: 'Mollets',
  abdominaux: 'Core',
  grand_rond: 'Grand rond',
  rhomboide: 'Rhomboïdes',
  erecteurs_rachis: 'Érecteurs rachis',
  avant_bras: 'Avant-bras',
}

// Libellés "anatomiques détaillés" — clé = exercise_muscles.muscle
// (fessiers distingués, muscles secondaires/stabilisateurs nommés).
// Usage : exercise/[id].tsx
export const MUSCLE_LABELS_DETAILED: Record<string, string> = {
  grand_pectoral: 'Grand pectoral',
  deltoide: 'Deltoïde',
  grand_dorsal: 'Grand dorsal',
  trapeze: 'Trapèze',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quadriceps',
  ischio_jambiers: 'Ischio-jambiers',
  fessier_maximus: 'Fessier maximus',
  fessier_median: 'Fessier médian',
  fessier_minimus: 'Fessier minimus',
  mollets: 'Mollets',
  abdominaux: 'Abdominaux',
  grand_rond: 'Grand rond',
  rhomboide: 'Rhomboïdes',
  erecteurs_rachis: 'Érecteurs rachis',
  avant_bras: 'Avant-bras',
  brachial: 'Brachial',
  brachioradial: 'Brachioradial',
  adducteurs: 'Adducteurs',
  iliopsoas: 'Iliopsoas',
  infra_epineux: 'Infra-épineux',
  serratus_anterieur: 'Serratus ant.',
}

// Libellés groupes musculaires — clé = exercises.muscle_group (FR DB).
// Usage : prs.tsx, library.tsx
export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quadriceps: 'Quadriceps',
  ischio_jambiers: 'Ischio-jambiers',
  fessiers: 'Fessiers',
  mollets: 'Mollets',
  abdominaux: 'Abdominaux',
  avant_bras: 'Avant-bras',
}

// Libellé groupe musculaire avec fallback snake_case → espaces.
export function muscleGroupLabel(raw: string): string {
  return MUSCLE_GROUP_LABELS[raw] ?? raw.replace(/_/g, ' ')
}
