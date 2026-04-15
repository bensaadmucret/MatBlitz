import { getDB, scheduleSave } from './database'
import type { PuzzleResult, DailyStreak, Badge } from '../types'

// ===== PUZZLE RESULTS =====

export function insertResult(result: PuzzleResult): void {
  const db = getDB()
  db.run(
    `INSERT INTO puzzle_results (puzzle_id, solved, time_ms, hints_used, attempts, combo_before, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [result.puzzleId, result.solved ? 1 : 0, result.timeMs, result.hintsUsed, result.attempts, result.comboBefore, result.timestamp]
  )
  scheduleSave()
}

export function getAllResults(): PuzzleResult[] {
  const db = getDB()
  const rows = db.exec('SELECT puzzle_id, solved, time_ms, hints_used, attempts, combo_before, timestamp FROM puzzle_results ORDER BY timestamp')
  if (rows.length === 0) return []
  return rows[0].values.map(row => ({
    puzzleId: row[0] as string,
    solved: (row[1] as number) === 1,
    timeMs: row[2] as number,
    hintsUsed: row[3] as number,
    attempts: row[4] as number,
    comboBefore: row[5] as number,
    timestamp: row[6] as number,
  }))
}

export function getSolvedPuzzleIds(): Set<string> {
  const db = getDB()
  const rows = db.exec('SELECT DISTINCT puzzle_id FROM puzzle_results WHERE solved = 1')
  if (rows.length === 0) return new Set()
  return new Set(rows[0].values.map(r => r[0] as string))
}

export function getTotalSolved(): number {
  const db = getDB()
  const rows = db.exec('SELECT COUNT(DISTINCT puzzle_id) FROM puzzle_results WHERE solved = 1')
  return rows.length > 0 ? (rows[0].values[0][0] as number) : 0
}

export function getAverageTime(): number {
  const db = getDB()
  const rows = db.exec('SELECT AVG(time_ms) FROM puzzle_results WHERE solved = 1')
  return rows.length > 0 ? Math.round((rows[0].values[0][0] as number) || 0) : 0
}

export function getSuccessRate(): number {
  const db = getDB()
  const rows = db.exec('SELECT CAST(SUM(CASE WHEN solved=1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 FROM puzzle_results')
  return rows.length > 0 ? Math.round((rows[0].values[0][0] as number) || 0) : 0
}

export function getFastestSolve(): number {
  const db = getDB()
  const rows = db.exec('SELECT MIN(time_ms) FROM puzzle_results WHERE solved = 1 AND time_ms > 0')
  return rows.length > 0 ? ((rows[0].values[0][0] as number) || 0) : 0
}

export function getResultsByDateRange(startTs: number, endTs: number): PuzzleResult[] {
  const db = getDB()
  const rows = db.exec(
    'SELECT puzzle_id, solved, time_ms, hints_used, attempts, combo_before, timestamp FROM puzzle_results WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp',
    [startTs, endTs]
  )
  if (rows.length === 0) return []
  return rows[0].values.map(row => ({
    puzzleId: row[0] as string,
    solved: (row[1] as number) === 1,
    timeMs: row[2] as number,
    hintsUsed: row[3] as number,
    attempts: row[4] as number,
    comboBefore: row[5] as number,
    timestamp: row[6] as number,
  }))
}

export function getTimeDistribution(): { label: string; count: number }[] {
  const db = getDB()
  const rows = db.exec(`
    SELECT
      CASE
        WHEN time_ms < 5000 THEN '<5s'
        WHEN time_ms < 15000 THEN '5-15s'
        WHEN time_ms < 30000 THEN '15-30s'
        WHEN time_ms < 60000 THEN '30-60s'
        ELSE '>60s'
      END as bucket,
      COUNT(*) as count
    FROM puzzle_results
    WHERE solved = 1
    GROUP BY bucket
    ORDER BY MIN(time_ms)
  `)
  if (rows.length === 0) return []
  return rows[0].values.map(row => ({
    label: row[0] as string,
    count: row[1] as number,
  }))
}

export function getHeatmapData(days: number = 90): { date: string; count: number }[] {
  const db = getDB()
  const since = Date.now() - days * 86400000
  const rows = db.exec(`
    SELECT date(timestamp/1000, 'unixepoch') as day, COUNT(*) as count
    FROM puzzle_results
    WHERE solved = 1 AND timestamp >= ?
    GROUP BY day
    ORDER BY day
  `, [since])
  if (rows.length === 0) return []
  return rows[0].values.map(row => ({
    date: row[0] as string,
    count: row[1] as number,
  }))
}

export function getCategoryStats(): { category: string; solved: number; total: number; avgTime: number }[] {
  const db = getDB()
  const rows = db.exec(`
    SELECT
      SUBSTR(puzzle_id, 1, INSTR(puzzle_id, '-') - 1) as cat,
      COUNT(DISTINCT CASE WHEN solved=1 THEN puzzle_id END) as solved,
      COUNT(DISTINCT puzzle_id) as total,
      AVG(CASE WHEN solved=1 THEN time_ms END) as avg_time
    FROM puzzle_results
    GROUP BY cat
  `)
  if (rows.length === 0) return []
  return rows[0].values.map(row => ({
    category: row[0] as string,
    solved: row[1] as number,
    total: row[2] as number,
    avgTime: Math.round((row[3] as number) || 0),
  }))
}

// ===== GAME STATE =====

export function getGameState(key: string): string | null {
  const db = getDB()
  const rows = db.exec('SELECT value FROM game_state WHERE key = ?', [key])
  return rows.length > 0 ? (rows[0].values[0][0] as string) : null
}

export function setGameState(key: string, value: string): void {
  const db = getDB()
  db.run('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)', [key, value])
  scheduleSave()
}

// ===== BADGES =====

export function getUnlockedBadges(): Badge[] {
  const db = getDB()
  const rows = db.exec('SELECT id, name, emoji, description, unlocked_at FROM badges WHERE unlocked_at IS NOT NULL')
  if (rows.length === 0) return []
  return rows[0].values.map(row => ({
    id: row[0] as string,
    name: row[1] as string,
    emoji: row[2] as string,
    description: row[3] as string,
    unlockedAt: row[4] as number,
  }))
}

export function unlockBadge(badge: Badge): void {
  const db = getDB()
  db.run(
    'INSERT OR REPLACE INTO badges (id, name, emoji, description, unlocked_at) VALUES (?, ?, ?, ?, ?)',
    [badge.id, badge.name, badge.emoji, badge.description, badge.unlockedAt || Date.now()]
  )
  scheduleSave()
}

// ===== DAILY STREAK =====

export function getStreak(): DailyStreak {
  const db = getDB()
  const rows = db.exec(`
    SELECT date, puzzles_solved FROM daily_streak ORDER BY date DESC LIMIT 100
  `)

  if (rows.length === 0) return { current: 0, longest: 0, lastDate: '' }

  const entries = rows[0].values.map(row => ({
    date: row[0] as string,
    count: row[1] as number,
  }))

  // Calculate current streak from today backwards
  const today = new Date().toISOString().split('T')[0]
  let current = 0
  let checkDate = new Date()

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    const entry = entries.find(e => e.date === dateStr)
    if (entry && entry.count > 0) {
      current++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (dateStr === today) {
      // Today not yet completed, check yesterday
      checkDate.setDate(checkDate.getDate() - 1)
      continue
    } else {
      break
    }
  }

  const longest = entries.length > 0 ? entries.length : 0
  const lastDate = entries.length > 0 ? entries[0].date : ''

  return { current, longest, lastDate }
}

export function recordDailySolve(): void {
  const today = new Date().toISOString().split('T')[0]
  const db = getDB()
  db.run(
    'INSERT INTO daily_streak (date, puzzles_solved) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET puzzles_solved = puzzles_solved + 1',
    [today]
  )
  scheduleSave()
}

// ===== SETTINGS =====

export function getSetting(key: string, defaultValue: string = ''): string {
  const db = getDB()
  const rows = db.exec('SELECT value FROM settings WHERE key = ?', [key])
  return rows.length > 0 ? (rows[0].values[0][0] as string) : defaultValue
}

export function setSetting(key: string, value: string): void {
  const db = getDB()
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  scheduleSave()
}

// ===== RESET =====

export function resetAllData(): void {
  const db = getDB()
  db.run('DELETE FROM puzzle_results')
  db.run('DELETE FROM game_state')
  db.run('DELETE FROM badges')
  db.run('DELETE FROM daily_streak')
  db.run('DELETE FROM settings')
  scheduleSave()
}
