import { getDB } from '@/lib/db'

export interface GhostSet {
  weight_kg: number
  reps: number
  volume: number
  session_date: number
}

// Free = 30 jours, Pro = 99999
export async function getGhostReference(
  exerciseId: string,
  limitDays: number,
): Promise<GhostSet | null> {
  try {
    const db = getDB()
    const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000
    const row = await db.getFirstAsync<{
      weight_kg: number
      reps: number
      volume: number
      logged_at: number
    }>(
      `SELECT weight_kg, reps, volume, logged_at
       FROM local_sets
       WHERE exercise_id = ? AND logged_at >= ?
       ORDER BY volume DESC, weight_kg DESC
       LIMIT 1`,
      exerciseId,
      cutoff,
    )
    if (!row) return null
    return {
      weight_kg: row.weight_kg,
      reps: row.reps,
      volume: row.volume,
      session_date: row.logged_at,
    }
  } catch {
    return null
  }
}
