import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

export async function initDB(): Promise<Database> {
  if (db) return db

  db = await Database.load('sqlite:matblitz.db')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS puzzle_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      puzzle_id TEXT NOT NULL,
      solved INTEGER NOT NULL DEFAULT 0,
      time_ms INTEGER NOT NULL DEFAULT 0,
      hints_used INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      combo_before INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_puzzle_results_puzzle_id ON puzzle_results(puzzle_id);
    CREATE INDEX IF NOT EXISTS idx_puzzle_results_timestamp ON puzzle_results(timestamp);
    CREATE INDEX IF NOT EXISTS idx_puzzle_results_solved ON puzzle_results(solved);

    CREATE TABLE IF NOT EXISTS game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT NOT NULL,
      unlocked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_streak (
      date TEXT PRIMARY KEY,
      puzzles_solved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return db
}

export function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

export async function closeDB(): Promise<void> {
  if (db) {
    await db.close()
    db = null
  }
}
