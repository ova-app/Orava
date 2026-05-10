import { supabase } from './supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MyoRaw {
  volume_kg: number
  densite: number
  nb_series: number
  recuperation: number
  nb_pr: number
  streak: number
}

interface Baselines { n: number; mean: MyoRaw; std: MyoRaw }

// ─── Fallback population — utilisé si < 5 séances historiques ────────────────
// TODO: calibrer depuis les agrégats réels une fois la base suffisante

const POP_MEAN: MyoRaw = {
  volume_kg: 5000, densite: 80, nb_series: 20, recuperation: 55, nb_pr: 1, streak: 3,
}
const POP_STD: MyoRaw = {
  volume_kg: 3000, densite: 40, nb_series: 8, recuperation: 20, nb_pr: 1.5, streak: 2.5,
}

// ─── Hash déterministe (pas cryptographique) ──────────────────────────────────

function djb2(s: string): number {
  let h = 5381 >>> 0
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0
  return h
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampZ(z: number): number {
  return Number.isFinite(z) ? Math.max(-3, Math.min(3, z)) : 0
}

async function fetchBaselines(userId: string, beforeIso: string): Promise<Baselines> {
  const { data: wIds } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .lt('started_at', beforeIso)
    .order('started_at', { ascending: false })
    .limit(30)

  if (!wIds?.length) return { n: 0, mean: { ...POP_MEAN }, std: { ...POP_STD } }

  const { data: mData } = await supabase
    .from('workout_metrics')
    .select('data')
    .in('workout_id', (wIds as any[]).map((w: any) => w.id))

  const rows: MyoRaw[] = ((mData ?? []) as any[])
    .map((r: any) => ({
      volume_kg: r.data?.volume_total_kg ?? 0,
      densite: r.data?.densite_kg_par_min ?? 0,
      nb_series: r.data?.nb_series_total ?? 0,
      recuperation: r.data?.score_recuperation_estime ?? 50,
      nb_pr: r.data?.nb_pr_seance ?? 0,
      streak: r.data?.streak_semaines_actives ?? 0,
    }))
    .filter((r: MyoRaw) => r.volume_kg > 0)

  if (rows.length < 5) return { n: rows.length, mean: { ...POP_MEAN }, std: { ...POP_STD } }

  const keys = Object.keys(POP_MEAN) as (keyof MyoRaw)[]
  const mean = {} as MyoRaw
  const std = {} as MyoRaw
  for (const k of keys) {
    const vals = rows.map(r => r[k])
    const m = vals.reduce((a, b) => a + b, 0) / vals.length
    mean[k] = m
    std[k] = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length) || 1
  }
  return { n: rows.length, mean, std }
}

// ─── API publique ─────────────────────────────────────────────────────────────

export interface SaveMyoParams {
  userId: string
  workoutId: string
  startedAtIso: string
  volume_total_kg: number
  densite_kg_par_min: number
  nb_series_total: number
  score_recuperation_estime: number | null
  nb_pr_seance: number
  streak_semaines_actives: number
}

export async function saveMyoSignature(p: SaveMyoParams): Promise<void> {
  const { data: existing } = await supabase
    .from('myo_signatures')
    .select('workout_id')
    .eq('workout_id', p.workoutId)
    .maybeSingle()
  if (existing) return

  const raw: MyoRaw = {
    volume_kg: p.volume_total_kg,
    densite: p.densite_kg_par_min,
    nb_series: p.nb_series_total,
    recuperation: p.score_recuperation_estime ?? 50,
    nb_pr: p.nb_pr_seance,
    streak: p.streak_semaines_actives,
  }

  const bl = await fetchBaselines(p.userId, p.startedAtIso)

  const z_volume      = clampZ((raw.volume_kg    - bl.mean.volume_kg)    / bl.std.volume_kg)
  const z_intensite   = clampZ((raw.densite       - bl.mean.densite)      / bl.std.densite)
  const z_structure   = clampZ((raw.nb_series     - bl.mean.nb_series)    / bl.std.nb_series)
  const z_recovery    = clampZ((raw.recuperation  - bl.mean.recuperation) / bl.std.recuperation)
  const z_performance = clampZ((raw.nb_pr         - bl.mean.nb_pr)        / bl.std.nb_pr)
  const z_regularite  = clampZ((raw.streak        - bl.mean.streak)       / bl.std.streak)

  const avg = (z_volume + z_intensite + z_structure + z_recovery + z_performance + z_regularite) / 6
  const score = Math.round(((avg + 3) / 6) * 100)

  const payload = `${p.workoutId}|${z_volume.toFixed(3)}|${z_intensite.toFixed(3)}|${z_structure.toFixed(3)}|${z_recovery.toFixed(3)}|${z_performance.toFixed(3)}|${z_regularite.toFixed(3)}|${score}`
  const h1 = djb2(payload).toString(16).padStart(8, '0')
  const h2 = djb2(payload.split('').reverse().join('')).toString(16).padStart(8, '0')
  const hash = `${p.workoutId.replace(/-/g, '').slice(0, 32)}${h1}${h2}`.slice(0, 64)

  const anomalyDims: string[] = []
  if (Math.abs(z_volume) >= 2.9) anomalyDims.push('volume')
  if (Math.abs(z_intensite) >= 2.9) anomalyDims.push('intensité')
  if (Math.abs(z_structure) >= 2.9) anomalyDims.push('structure')
  if (Math.abs(z_recovery) >= 2.9) anomalyDims.push('récupération')
  if (Math.abs(z_performance) >= 2.9) anomalyDims.push('performance')
  if (Math.abs(z_regularite) >= 2.9) anomalyDims.push('régularité')

  console.log('[MYO] inserting, score=', score, 'hash=', hash.slice(0, 16))
  const { error: insertErr } = await supabase.from('myo_signatures').insert({
    workout_id: p.workoutId,
    user_id: p.userId,
    raw_volume_kg: raw.volume_kg,
    raw_densite_kg_par_min: raw.densite,
    raw_nb_series: raw.nb_series,
    raw_score_recuperation: raw.recuperation,
    raw_nb_pr: raw.nb_pr,
    raw_streak_semaines: raw.streak,
    baseline_n: bl.n,
    baseline_mean: bl.mean,
    baseline_std: bl.std,
    z_volume, z_intensite, z_structure, z_recovery, z_performance, z_regularite,
    score,
    hash,
    anomaly_detected: anomalyDims.length > 0,
    anomaly_message: anomalyDims.length > 0 ? `Extrême: ${anomalyDims.join(', ')}` : null,
  })
  if (insertErr) console.error('[MYO] insert error:', insertErr.message, insertErr.code)
}
