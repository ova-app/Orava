/**
 * prs.tsx — tests des fonctions pures buildPodium et buildExercisePRs.
 *
 * Ces fonctions ne sont pas exportées (UI inline). On les réimplante ici
 * depuis la source (même pattern que sessionUx.test.ts / myoDims.test.ts).
 *
 * On teste :
 *   - buildPodium : déduplication par level, tri gold→silver→bronze
 *   - buildExercisePRs : groupement par exercice, fusion charge+série, tri gold-first
 */

// ─── Copie locale des types et fonctions pures (source : app/prs.tsx) ─────────

type PrLevel = 'gold' | 'silver' | 'bronze'

interface PodiumSlot {
  level: PrLevel
  weight_kg: number
  reps: number | null
}

interface ExercisePR {
  exerciseId: string
  nameFr: string
  muscleGroup: string
  podiumCharge: PodiumSlot[]
  podiumSerie: PodiumSlot[]
}

interface RawSetRow {
  weight_kg: number | null
  reps: number | null
  pr_charge: string | null
  pr_serie: string | null
  workout_exercises:
    | { exercise_id: string; exercises: { name_fr: string; muscle_group: string } | { name_fr: string; muscle_group: string }[] }[]
    | { exercise_id: string; exercises: { name_fr: string; muscle_group: string } | { name_fr: string; muscle_group: string }[] }
}

const LEVEL_ORDER: Record<PrLevel, number> = { gold: 0, silver: 1, bronze: 2 }

function resolveWE(raw: RawSetRow['workout_exercises']) {
  return Array.isArray(raw) ? raw[0] : raw
}

function resolveExercise(
  raw: { name_fr: string; muscle_group: string } | { name_fr: string; muscle_group: string }[]
) {
  return Array.isArray(raw) ? raw[0] : raw
}

function buildPodium(
  entries: { weight_kg: number; reps: number | null; level: PrLevel }[],
): PodiumSlot[] {
  const byLevel = new Map<PrLevel, PodiumSlot>()
  for (const e of entries) {
    const existing = byLevel.get(e.level)
    if (!existing || e.weight_kg > existing.weight_kg) {
      byLevel.set(e.level, { level: e.level, weight_kg: e.weight_kg, reps: e.reps })
    }
  }
  return ([...byLevel.values()] as PodiumSlot[]).sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
  )
}

function buildExercisePRs(rows: RawSetRow[]): ExercisePR[] {
  type EntryBuf = { weight_kg: number; reps: number | null; level: PrLevel; nameFr: string; muscleGroup: string }

  const chargeMap = new Map<string, EntryBuf[]>()
  const serieMap  = new Map<string, EntryBuf[]>()

  for (const row of rows) {
    if (!row.workout_exercises) continue
    const we = resolveWE(row.workout_exercises)
    if (!we) continue
    const ex = resolveExercise(we.exercises)
    if (!ex) continue

    const id          = we.exercise_id
    const nameFr      = ex.name_fr
    const muscleGroup = ex.muscle_group

    if (row.pr_charge !== null) {
      const level = row.pr_charge as PrLevel
      const arr = chargeMap.get(id) ?? []
      arr.push({ weight_kg: row.weight_kg ?? 0, reps: row.reps, level, nameFr, muscleGroup })
      chargeMap.set(id, arr)
    }

    if (row.pr_serie !== null) {
      const level = row.pr_serie as PrLevel
      const arr = serieMap.get(id) ?? []
      arr.push({ weight_kg: row.weight_kg ?? 0, reps: row.reps, level, nameFr, muscleGroup })
      serieMap.set(id, arr)
    }
  }

  const allIds = new Set([...chargeMap.keys(), ...serieMap.keys()])
  const result: ExercisePR[] = []

  for (const id of allIds) {
    const chargeEntries = chargeMap.get(id) ?? []
    const serieEntries  = serieMap.get(id)  ?? []
    const anyEntry = chargeEntries[0] ?? serieEntries[0]
    if (!anyEntry) continue

    result.push({
      exerciseId:   id,
      nameFr:       anyEntry.nameFr,
      muscleGroup:  anyEntry.muscleGroup,
      podiumCharge: buildPodium(chargeEntries),
      podiumSerie:  buildPodium(serieEntries),
    })
  }

  result.sort((a, b) => {
    const aGold = a.podiumCharge.some(s => s.level === 'gold') ? 0 : 1
    const bGold = b.podiumCharge.some(s => s.level === 'gold') ? 0 : 1
    if (aGold !== bGold) return aGold - bGold
    const aMax = a.podiumCharge[0]?.weight_kg ?? 0
    const bMax = b.podiumCharge[0]?.weight_kg ?? 0
    return bMax - aMax
  })

  return result
}

// ─── buildPodium ──────────────────────────────────────────────────────────────

describe('buildPodium — construction du podium', () => {
  it('retourne un tableau vide si aucune entrée', () => {
    expect(buildPodium([])).toEqual([])
  })

  it('retourne 1 slot pour un seul niveau', () => {
    const result = buildPodium([{ weight_kg: 100, reps: 5, level: 'gold' }])
    expect(result).toHaveLength(1)
    expect(result[0].level).toBe('gold')
    expect(result[0].weight_kg).toBe(100)
  })

  it('trie gold → silver → bronze', () => {
    const entries = [
      { weight_kg: 70, reps: 5, level: 'bronze' as PrLevel },
      { weight_kg: 100, reps: 5, level: 'gold' as PrLevel },
      { weight_kg: 80, reps: 5, level: 'silver' as PrLevel },
    ]
    const result = buildPodium(entries)
    expect(result[0].level).toBe('gold')
    expect(result[1].level).toBe('silver')
    expect(result[2].level).toBe('bronze')
  })

  it('déduplique par level — garde le poids le plus lourd pour chaque niveau', () => {
    const entries = [
      { weight_kg: 100, reps: 5, level: 'gold' as PrLevel },
      { weight_kg: 95,  reps: 6, level: 'gold' as PrLevel },  // doublon gold — plus léger
    ]
    const result = buildPodium(entries)
    expect(result).toHaveLength(1)
    expect(result[0].weight_kg).toBe(100)
  })

  it('garde le second doublon gold s\'il est plus lourd que le premier', () => {
    const entries = [
      { weight_kg: 95,  reps: 5, level: 'gold' as PrLevel },
      { weight_kg: 100, reps: 4, level: 'gold' as PrLevel },  // plus lourd → remplace
    ]
    const result = buildPodium(entries)
    expect(result).toHaveLength(1)
    expect(result[0].weight_kg).toBe(100)
  })

  it('retourne 3 slots distincts pour gold+silver+bronze', () => {
    const entries = [
      { weight_kg: 100, reps: 5, level: 'gold' as PrLevel },
      { weight_kg: 90,  reps: 5, level: 'silver' as PrLevel },
      { weight_kg: 80,  reps: 5, level: 'bronze' as PrLevel },
    ]
    const result = buildPodium(entries)
    expect(result).toHaveLength(3)
  })

  it('préserve reps null dans le slot', () => {
    const entries = [{ weight_kg: 100, reps: null, level: 'gold' as PrLevel }]
    const result = buildPodium(entries)
    expect(result[0].reps).toBeNull()
  })

  it('podium partiel (seulement gold+bronze) conserve les 2 niveaux', () => {
    const entries = [
      { weight_kg: 100, reps: 5, level: 'gold' as PrLevel },
      { weight_kg: 80,  reps: 5, level: 'bronze' as PrLevel },
    ]
    const result = buildPodium(entries)
    expect(result).toHaveLength(2)
    expect(result[0].level).toBe('gold')
    expect(result[1].level).toBe('bronze')
  })
})

// ─── buildExercisePRs ─────────────────────────────────────────────────────────

function makeRow(
  exerciseId: string,
  nameFr: string,
  muscleGroup: string,
  weight_kg: number,
  reps: number,
  pr_charge: string | null,
  pr_serie: string | null,
): RawSetRow {
  return {
    weight_kg,
    reps,
    pr_charge,
    pr_serie,
    workout_exercises: {
      exercise_id: exerciseId,
      exercises: { name_fr: nameFr, muscle_group: muscleGroup },
    },
  }
}

describe('buildExercisePRs — groupement par exercice', () => {
  it('retourne un tableau vide pour une liste vide', () => {
    expect(buildExercisePRs([])).toEqual([])
  })

  it('crée 1 ExercisePR pour 1 seul exercice', () => {
    const rows = [makeRow('ex-1', 'Bench Press', 'pectoraux', 100, 5, 'gold', null)]
    const result = buildExercisePRs(rows)
    expect(result).toHaveLength(1)
    expect(result[0].nameFr).toBe('Bench Press')
    expect(result[0].exerciseId).toBe('ex-1')
  })

  it('crée 2 ExercisePR pour 2 exercices distincts', () => {
    const rows = [
      makeRow('ex-1', 'Bench Press', 'pectoraux',  100, 5, 'gold', null),
      makeRow('ex-2', 'Squat',       'quadriceps', 150, 5, 'gold', null),
    ]
    const result = buildExercisePRs(rows)
    expect(result).toHaveLength(2)
  })

  it('regroupe plusieurs rows du même exercice dans 1 seul ExercisePR', () => {
    const rows = [
      makeRow('ex-1', 'Bench Press', 'pectoraux', 100, 5, 'gold',   null),
      makeRow('ex-1', 'Bench Press', 'pectoraux', 90,  5, 'silver', null),
      makeRow('ex-1', 'Bench Press', 'pectoraux', 80,  5, 'bronze', null),
    ]
    const result = buildExercisePRs(rows)
    expect(result).toHaveLength(1)
    expect(result[0].podiumCharge).toHaveLength(3)
  })

  it('remplit podiumCharge et podiumSerie indépendamment', () => {
    const rows = [
      makeRow('ex-1', 'Bench Press', 'pectoraux', 100, 5, 'gold', null),
      makeRow('ex-1', 'Bench Press', 'pectoraux', 80,  8, null,   'gold'),
    ]
    const result = buildExercisePRs(rows)
    expect(result[0].podiumCharge).toHaveLength(1)
    expect(result[0].podiumSerie).toHaveLength(1)
    expect(result[0].podiumCharge[0].weight_kg).toBe(100)
    expect(result[0].podiumSerie[0].weight_kg).toBe(80)
  })

  it('ignore les rows sans pr_charge ET sans pr_serie', () => {
    const rows = [
      makeRow('ex-1', 'Bench Press', 'pectoraux', 100, 5, null, null),  // pas de PR
      makeRow('ex-2', 'Squat',       'pectoraux', 150, 5, 'gold', null),
    ]
    const result = buildExercisePRs(rows)
    expect(result).toHaveLength(1)
    expect(result[0].exerciseId).toBe('ex-2')
  })

  it('ignore les rows avec workout_exercises null/undefined', () => {
    const badRow = { weight_kg: 100, reps: 5, pr_charge: 'gold', pr_serie: null, workout_exercises: null as unknown as RawSetRow['workout_exercises'] }
    const result = buildExercisePRs([badRow])
    expect(result).toHaveLength(0)
  })

  it('weight_kg null traité comme 0 (set sans poids)', () => {
    const rows = [
      {
        weight_kg: null,
        reps: 10,
        pr_charge: 'gold',
        pr_serie: null,
        workout_exercises: {
          exercise_id: 'ex-bw',
          exercises: { name_fr: 'Pompes', muscle_group: 'pectoraux' },
        },
      } as RawSetRow,
    ]
    const result = buildExercisePRs(rows)
    expect(result[0].podiumCharge[0].weight_kg).toBe(0)
  })
})

describe('buildExercisePRs — tri gold-first puis poids DESC', () => {
  it('exercice avec gold apparaît avant exercice sans gold', () => {
    const rows = [
      makeRow('ex-1', 'Curl',  'biceps',     60, 10, 'silver', null),
      makeRow('ex-2', 'Bench', 'pectoraux', 100,  5, 'gold',   null),
    ]
    const result = buildExercisePRs(rows)
    expect(result[0].exerciseId).toBe('ex-2')
    expect(result[1].exerciseId).toBe('ex-1')
  })

  it('à même niveau gold, trie par poids max descendant', () => {
    const rows = [
      makeRow('ex-1', 'Curl',  'biceps',     50, 10, 'gold', null),
      makeRow('ex-2', 'Bench', 'pectoraux', 120,  5, 'gold', null),
      makeRow('ex-3', 'Squat', 'quadriceps', 80,  8, 'gold', null),
    ]
    const result = buildExercisePRs(rows)
    expect(result[0].podiumCharge[0].weight_kg).toBe(120)
    expect(result[1].podiumCharge[0].weight_kg).toBe(80)
    expect(result[2].podiumCharge[0].weight_kg).toBe(50)
  })

  it('exercices sans gold triés entre eux par poids max DESC', () => {
    const rows = [
      makeRow('ex-1', 'Leg Press', 'quadriceps', 200, 10, 'silver', null),
      makeRow('ex-2', 'Curl',      'biceps',      40,  12, 'bronze', null),
      makeRow('ex-3', 'Face Pull', 'epaules',     70,   8, 'silver', null),
    ]
    const result = buildExercisePRs(rows)
    const weights = result.map(r => r.podiumCharge[0]?.weight_kg ?? 0)
    expect(weights[0]).toBeGreaterThanOrEqual(weights[1])
    expect(weights[1]).toBeGreaterThanOrEqual(weights[2])
  })
})
