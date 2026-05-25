import * as SQLite from 'expo-sqlite'

let _db: SQLite.SQLiteDatabase | null = null

export function getDB(): SQLite.SQLiteDatabase {
  if (!_db) throw new Error('DB not initialized — appeler initDB() au démarrage')
  return _db
}

export async function initDB(): Promise<void> {
  _db = await SQLite.openDatabaseAsync('orava.db')
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS local_sets (
      id TEXT PRIMARY KEY,
      exercise_id TEXT NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      volume REAL,
      session_id TEXT NOT NULL,
      logged_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_sessions (
      id TEXT NOT NULL,
      total_volume_kg REAL,
      logged_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON local_sets(exercise_id, logged_at DESC);
  `)
}

export async function insertLocalSet(params: {
  id: string
  exercise_id: string
  weight_kg: number
  reps: number
  session_id: string
  logged_at: number
}): Promise<void> {
  const db = getDB()
  await db.runAsync(
    `INSERT OR REPLACE INTO local_sets (id, exercise_id, weight_kg, reps, volume, session_id, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params.id,
    params.exercise_id,
    params.weight_kg,
    params.reps,
    params.weight_kg * params.reps,
    params.session_id,
    params.logged_at
  )
}

export async function insertLocalSession(params: {
  id: string
  total_volume_kg: number
  logged_at: number
}): Promise<void> {
  const db = getDB()
  await db.runAsync(
    `INSERT OR REPLACE INTO local_sessions (id, total_volume_kg, logged_at) VALUES (?, ?, ?)`,
    params.id,
    params.total_volume_kg,
    params.logged_at
  )
}

export async function getLastLocalSet(
  exerciseId: string,
): Promise<{ weight_kg: number; reps: number } | null> {
  try {
    const db = getDB()
    const row = await db.getFirstAsync<{ weight_kg: number; reps: number }>(
      `SELECT weight_kg, reps FROM local_sets
       WHERE exercise_id = ?
       ORDER BY logged_at DESC
       LIMIT 1`,
      exerciseId,
    )
    return row ?? null
  } catch {
    return null
  }
}
