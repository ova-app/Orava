/**
 * workoutPayload.ts — construction du payload `create_workout` + lignes SQLite (ORA-007).
 *
 * Chemin de données le plus risqué de l'app (save séance). Couvre :
 *   - mapping correct set/exercice → payload
 *   - filtrage des séries non validées / reps = 0
 *   - exercice sans série valide ignoré SANS décaler order_index
 *   - pr_exercice délégué à computePodium
 *   - logged_at (validated_at → ISO, sinon endedAtIso ; SQLite → validated_at ?? now())
 *   - IDEMPOTENCE : payload.id stable + localSets[].id déterministes (anti double-comptage)
 *
 * Aucun mock : workoutPayload.ts n'a que des `import type` (zéro dépendance runtime).
 */

import { buildWorkoutPayload, type WorkoutMeta } from '../lib/workoutPayload'
import type { WorkoutSet, WorkoutExercise, PrLevel } from '../context/WorkoutContext'

const NOW = 1_700_000_000_000

function mkSet(p: Partial<WorkoutSet> & { set_number: number }): WorkoutSet {
  return {
    weight_kg: 100,
    reps: 10,
    is_pr: false,
    pr_charge: null,
    pr_serie: null,
    rest_seconds: 90,
    validated_at: null,
    validated: true,
    ...p,
  }
}

function mkEx(p: Partial<WorkoutExercise> & { exercise_id: string }): WorkoutExercise {
  return {
    name: 'Exercice',
    muscle_group: null,
    equipment_type: null,
    sets: [],
    pr_top3_charge: { pr1: 0, pr2: null, pr3: null },
    pr_top3_serie: { pr1: 0, pr2: null, pr3: null },
    pr_top3_exercice: { pr1: 0, pr2: null, pr3: null },
    pr_exercice: null,
    ...p,
  }
}

const meta: WorkoutMeta = {
  workoutId: 'W-1',
  title: 'Push A',
  startedAtIso: '2026-06-14T08:00:00.000Z',
  endedAtIso: '2026-06-14T09:00:00.000Z',
  durationSec: 3600,
  totalVolume: 12450,
  isPublic: false,
  poidsCorps: 80,
  prSeance: 'gold' as PrLevel,
}

const noPodium = () => null as PrLevel
const seqId = () => {
  let n = 0
  return () => `id${++n}`
}
const fixedNow = () => NOW

describe('buildWorkoutPayload — mapping', () => {
  it('mappe exercices et séries dans le payload + localSets', () => {
    const exercises = [
      mkEx({
        exercise_id: 'E1',
        sets: [
          mkSet({ set_number: 1, weight_kg: 100, reps: 10, rest_seconds: 90 }),
          mkSet({ set_number: 2, weight_kg: 105, reps: 8, is_pr: true, pr_charge: 'gold' }),
        ],
      }),
    ]
    const { payload, localSets } = buildWorkoutPayload(
      exercises,
      { E1: 2000 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )

    expect(payload.exercises).toHaveLength(1)
    const ex = payload.exercises[0]
    expect(ex.exercise_id).toBe('E1')
    expect(ex.order_index).toBe(0)
    expect(ex.sets).toHaveLength(2)
    expect(ex.sets[1]).toMatchObject({
      set_number: 2,
      weight_kg: 105,
      reps: 8,
      is_pr: true,
      pr_charge: 'gold',
      pr_serie: null,
      rest_seconds: 90,
    })
    expect(localSets).toHaveLength(2)
    expect(localSets[0]).toMatchObject({
      exercise_id: 'E1',
      weight_kg: 100,
      reps: 10,
      session_id: 'W-1',
    })
  })

  it('recopie les métadonnées séance dans le payload', () => {
    const { payload } = buildWorkoutPayload(
      [mkEx({ exercise_id: 'E1', sets: [mkSet({ set_number: 1 })] })],
      { E1: 1000 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(payload).toMatchObject({
      id: 'W-1',
      title: 'Push A',
      started_at: meta.startedAtIso,
      ended_at: meta.endedAtIso,
      duration_sec: 3600,
      total_volume_kg: 12450,
      is_public: false,
      poids_corps_kg: 80,
      pr_seance: 'gold',
    })
  })

  it('série au poids du corps (weight_kg = 0) conservée si reps > 0', () => {
    const { payload, localSets } = buildWorkoutPayload(
      [mkEx({ exercise_id: 'E1', sets: [mkSet({ set_number: 1, weight_kg: 0, reps: 12 })] })],
      {},
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(payload.exercises[0].sets).toHaveLength(1)
    expect(localSets).toHaveLength(1)
  })
})

describe('buildWorkoutPayload — filtrage', () => {
  it('ignore séries non validées et reps = 0', () => {
    const { payload, localSets } = buildWorkoutPayload(
      [
        mkEx({
          exercise_id: 'E1',
          sets: [
            mkSet({ set_number: 1, validated: true, reps: 10 }),
            mkSet({ set_number: 2, validated: false, reps: 10 }), // non validée
            mkSet({ set_number: 3, validated: true, reps: 0 }), // reps 0
          ],
        }),
      ],
      { E1: 1000 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(payload.exercises[0].sets).toHaveLength(1)
    expect(payload.exercises[0].sets[0].set_number).toBe(1)
    expect(localSets).toHaveLength(1)
  })

  it('exercice sans série valide → exclu SANS décaler order_index des suivants', () => {
    const exercises = [
      mkEx({ exercise_id: 'E0', sets: [mkSet({ set_number: 1, validated: false })] }), // tout invalide
      mkEx({ exercise_id: 'E1', sets: [mkSet({ set_number: 1, validated: true, reps: 5 })] }),
    ]
    const { payload } = buildWorkoutPayload(
      exercises,
      { E1: 500 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(payload.exercises).toHaveLength(1)
    expect(payload.exercises[0].exercise_id).toBe('E1')
    expect(payload.exercises[0].order_index).toBe(1) // garde l'index original, pas 0
  })
})

describe('buildWorkoutPayload — pr_exercice & logged_at', () => {
  it('pr_exercice = résultat de computePodium(volume, top3)', () => {
    const podium = jest.fn().mockReturnValue('silver' as PrLevel)
    const top3 = { pr1: 1500, pr2: 1000, pr3: 800 }
    const { payload } = buildWorkoutPayload(
      [mkEx({ exercise_id: 'E1', pr_top3_exercice: top3, sets: [mkSet({ set_number: 1 })] })],
      { E1: 1200 },
      meta,
      podium,
      seqId(),
      fixedNow
    )
    expect(podium).toHaveBeenCalledWith(1200, top3)
    expect(payload.exercises[0].pr_exercice).toBe('silver')
  })

  it('logged_at : validated_at → ISO ; absent → endedAtIso (payload) et now() (SQLite)', () => {
    const tsMs = Date.parse('2026-06-14T08:30:00.000Z')
    const { payload, localSets } = buildWorkoutPayload(
      [
        mkEx({
          exercise_id: 'E1',
          sets: [
            mkSet({ set_number: 1, validated_at: tsMs }),
            mkSet({ set_number: 2, validated_at: null }),
          ],
        }),
      ],
      { E1: 1000 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(payload.exercises[0].sets[0].logged_at).toBe('2026-06-14T08:30:00.000Z')
    expect(payload.exercises[0].sets[1].logged_at).toBe(meta.endedAtIso)
    expect(localSets[0].logged_at).toBe(tsMs)
    expect(localSets[1].logged_at).toBe(NOW) // fallback now() injecté
  })
})

describe('buildWorkoutPayload — idempotence (anti double-save / double-comptage)', () => {
  const exercises = [
    mkEx({
      exercise_id: 'E1',
      sets: [mkSet({ set_number: 1 }), mkSet({ set_number: 2 })],
    }),
  ]

  it('payload.id = workoutId stable (ancre d’idempotence de la RPC)', () => {
    const { payload } = buildWorkoutPayload(
      exercises,
      { E1: 1000 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(payload.id).toBe('W-1')
  })

  it('localSets[].id déterministe = ${workoutId}-${exercise_id}-${set_number}', () => {
    const { localSets } = buildWorkoutPayload(
      exercises,
      { E1: 1000 },
      meta,
      noPodium,
      seqId(),
      fixedNow
    )
    expect(localSets.map((l) => l.id)).toEqual(['W-1-E1-1', 'W-1-E1-2'])
  })

  it('deux builds (retry) → localSets identiques même avec genId frais', () => {
    const a = buildWorkoutPayload(exercises, { E1: 1000 }, meta, noPodium, seqId(), fixedNow)
    const b = buildWorkoutPayload(exercises, { E1: 1000 }, meta, noPodium, seqId(), fixedNow)
    expect(b.localSets).toEqual(a.localSets) // ids SQLite stables → INSERT OR REPLACE ne double pas
    expect(b.payload.id).toBe(a.payload.id) // même ancre RPC
  })
})
