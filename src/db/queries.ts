import { getDB } from './database'
import type { PuzzleResult, DailyStreak, Badge, OpeningProgress, OpeningSession } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */
// DbRow represents dynamic SQL query results where column names vary by query
type DbRow = Record<string, any>

// ===== PUZZLE RESULTS =====

export async function insertResult(result: PuzzleResult): Promise<void> {
  const db = getDB()
  await db.execute(
    `INSERT INTO puzzle_results (puzzle_id, solved, time_ms, hints_used, attempts, combo_before, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [result.puzzleId, result.solved ? 1 : 0, result.timeMs, result.hintsUsed, result.attempts, result.comboBefore, result.timestamp]
  )
}

export async function getAllResults(): Promise<PuzzleResult[]> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT puzzle_id, solved, time_ms, hints_used, attempts, combo_before, timestamp FROM puzzle_results ORDER BY timestamp'
  )
  return rows.map(row => ({
    puzzleId: row.puzzle_id as string,
    solved: row.solved === 1,
    timeMs: row.time_ms as number,
    hintsUsed: row.hints_used as number,
    attempts: row.attempts as number,
    comboBefore: row.combo_before as number,
    timestamp: row.timestamp as number,
  }))
}

export async function getSolvedPuzzleIds(): Promise<Set<string>> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT DISTINCT puzzle_id FROM puzzle_results WHERE solved = 1'
  )
  return new Set(rows.map(r => r.puzzle_id as string))
}

export async function getTotalSolved(): Promise<number> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT COUNT(DISTINCT puzzle_id) as cnt FROM puzzle_results WHERE solved = 1'
  )
  return rows.length > 0 ? (rows[0].cnt as number) : 0
}

export async function getAverageTime(): Promise<number> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT AVG(time_ms) as avg FROM puzzle_results WHERE solved = 1'
  )
  return rows.length > 0 ? Math.round((rows[0].avg as number) || 0) : 0
}

export async function getSuccessRate(): Promise<number> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT CAST(SUM(CASE WHEN solved=1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as rate FROM puzzle_results'
  )
  return rows.length > 0 ? Math.round((rows[0].rate as number) || 0) : 0
}

export async function getFastestSolve(): Promise<number> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT MIN(time_ms) as fastest FROM puzzle_results WHERE solved = 1 AND time_ms > 0'
  )
  return rows.length > 0 ? ((rows[0].fastest as number) || 0) : 0
}

export async function getResultsByDateRange(startTs: number, endTs: number): Promise<PuzzleResult[]> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT puzzle_id, solved, time_ms, hints_used, attempts, combo_before, timestamp FROM puzzle_results WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp',
    [startTs, endTs]
  )
  return rows.map(row => ({
    puzzleId: row.puzzle_id as string,
    solved: row.solved === 1,
    timeMs: row.time_ms as number,
    hintsUsed: row.hints_used as number,
    attempts: row.attempts as number,
    comboBefore: row.combo_before as number,
    timestamp: row.timestamp as number,
  }))
}

export async function getTimeDistribution(): Promise<{ label: string; count: number }[]> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(`
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
  return rows.map(row => ({
    label: row.bucket as string,
    count: row.count as number,
  }))
}

export async function getHeatmapData(days: number = 90): Promise<{ date: string; count: number }[]> {
  const db = getDB()
  const since = Date.now() - days * 86400000
  const rows = await db.select<DbRow[]>(`
    SELECT date(timestamp/1000, 'unixepoch') as day, COUNT(*) as count
    FROM puzzle_results
    WHERE solved = 1 AND timestamp >= $1
    GROUP BY day
    ORDER BY day
  `, [since])
  return rows.map(row => ({
    date: row.day as string,
    count: row.count as number,
  }))
}

export async function getCategoryStats(): Promise<{ category: string; solved: number; total: number; avgTime: number }[]> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(`
    SELECT
      SUBSTR(puzzle_id, 1, INSTR(puzzle_id, '-') - 1) as cat,
      COUNT(DISTINCT CASE WHEN solved=1 THEN puzzle_id END) as solved,
      COUNT(DISTINCT puzzle_id) as total,
      AVG(CASE WHEN solved=1 THEN time_ms END) as avg_time
    FROM puzzle_results
    GROUP BY cat
  `)
  return rows.map(row => ({
    category: row.cat as string,
    solved: row.solved as number,
    total: row.total as number,
    avgTime: Math.round((row.avg_time as number) || 0),
  }))
}

// ===== GAME STATE =====

export async function getGameState(key: string): Promise<string | null> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT value FROM game_state WHERE key = $1',
    [key]
  )
  return rows.length > 0 ? (rows[0].value as string) : null
}

export async function setGameState(key: string, value: string): Promise<void> {
  const db = getDB()
  await db.execute(
    'INSERT OR REPLACE INTO game_state (key, value) VALUES ($1, $2)',
    [key, value]
  )
}

// ===== BADGES =====

export async function getUnlockedBadges(): Promise<Badge[]> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT id, name, emoji, description, condition, unlocked_at FROM badges WHERE unlocked_at IS NOT NULL'
  )
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    description: row.description as string,
    condition: row.condition as string,
    unlockedAt: row.unlocked_at as number,
  }))
}

export async function unlockBadge(badge: Badge): Promise<void> {
  const db = getDB()
  await db.execute(
    'INSERT OR REPLACE INTO badges (id, name, emoji, description, unlocked_at) VALUES ($1, $2, $3, $4, $5)',
    [badge.id, badge.name, badge.emoji, badge.description, badge.unlockedAt || Date.now()]
  )
}

// ===== DAILY STREAK =====

export async function getStreak(): Promise<DailyStreak> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(`
    SELECT date, puzzles_solved FROM daily_streak ORDER BY date DESC LIMIT 100
  `)

  if (rows.length === 0) return { current: 0, longest: 0, lastDate: '' }

  const entries = rows.map(row => ({
    date: row.date as string,
    count: row.puzzles_solved as number,
  }))

  const today = new Date().toISOString().split('T')[0]
  let current = 0
  const checkDate = new Date()

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    const entry = entries.find(e => e.date === dateStr)
    if (entry && entry.count > 0) {
      current++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (dateStr === today) {
      checkDate.setDate(checkDate.getDate() - 1)
      continue
    } else {
      break
    }
  }

  const longest = entries.length
  const lastDate = entries.length > 0 ? entries[0].date : ''

  return { current, longest, lastDate }
}

export async function recordDailySolve(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const db = getDB()
  await db.execute(
    'INSERT INTO daily_streak (date, puzzles_solved) VALUES ($1, 1) ON CONFLICT(date) DO UPDATE SET puzzles_solved = puzzles_solved + 1',
    [today]
  )
}

// ===== SETTINGS =====

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  )
  return rows.length > 0 ? (rows[0].value as string) : defaultValue
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDB()
  await db.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)',
    [key, value]
  )
}

// ===== RESET =====

export async function resetAllData(): Promise<void> {
  const db = getDB()
  await db.execute('DELETE FROM puzzle_results')
  await db.execute('DELETE FROM game_state')
  await db.execute('DELETE FROM badges')
  await db.execute('DELETE FROM daily_streak')
  await db.execute('DELETE FROM settings')
  await db.execute('DELETE FROM openings_progress')
  await db.execute('DELETE FROM opening_sessions')
}

// ===== OPENINGS =====

export async function getOpeningProgress(): Promise<OpeningProgress[]> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT eco, name, volume, attempts, successes, best_time_ms, last_trained_at, mastery_level FROM openings_progress'
  )
  return rows.map(row => ({
    eco: row.eco as string,
    name: row.name as string,
    volume: row.volume as 'A' | 'B' | 'C' | 'D' | 'E',
    attempts: row.attempts as number,
    successes: row.successes as number,
    successRate: row.attempts > 0 ? Math.round((row.successes / row.attempts) * 100) : 0,
    bestTimeMs: row.best_time_ms as number | undefined,
    lastTrainedAt: row.last_trained_at as number | undefined,
    masteryLevel: row.mastery_level as 0 | 1 | 2 | 3 | 4 | 5,
  }))
}

export async function getOpeningProgressByEco(eco: string): Promise<OpeningProgress | null> {
  const db = getDB()
  const rows = await db.select<DbRow[]>(
    'SELECT eco, name, volume, attempts, successes, best_time_ms, last_trained_at, mastery_level FROM openings_progress WHERE eco = $1',
    [eco]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    eco: row.eco as string,
    name: row.name as string,
    volume: row.volume as 'A' | 'B' | 'C' | 'D' | 'E',
    attempts: row.attempts as number,
    successes: row.successes as number,
    successRate: row.attempts > 0 ? Math.round((row.successes / row.attempts) * 100) : 0,
    bestTimeMs: row.best_time_ms as number | undefined,
    lastTrainedAt: row.last_trained_at as number | undefined,
    masteryLevel: row.mastery_level as 0 | 1 | 2 | 3 | 4 | 5,
  }
}

export async function updateOpeningProgress(
  eco: string,
  name: string,
  volume: string,
  success: boolean,
  timeMs: number
): Promise<void> {
  const db = getDB()
  
  // Get current progress
  const current = await getOpeningProgressByEco(eco)
  
  const newAttempts = (current?.attempts || 0) + 1
  const newSuccesses = (current?.successes || 0) + (success ? 1 : 0)
  const newBestTime = current?.bestTimeMs ? Math.min(current.bestTimeMs, timeMs) : timeMs
  
  // Calculate mastery level
  let masteryLevel: 0 | 1 | 2 | 3 | 4 | 5 = 0
  const rate = newSuccesses / newAttempts
  if (newAttempts < 3) masteryLevel = 0
  else if (rate > 0.9 && newBestTime < 30000) masteryLevel = 5
  else if (rate > 0.8) masteryLevel = 4
  else if (rate > 0.7) masteryLevel = 3
  else if (rate > 0.5) masteryLevel = 2
  else masteryLevel = 1
  
  await db.execute(
    `INSERT OR REPLACE INTO openings_progress 
     (eco, name, volume, attempts, successes, best_time_ms, last_trained_at, mastery_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [eco, name, volume, newAttempts, newSuccesses, newBestTime, Date.now(), masteryLevel]
  )
}

export async function insertOpeningSession(session: OpeningSession): Promise<void> {
  const db = getDB()
  await db.execute(
    `INSERT INTO opening_sessions (eco, mode, success, time_ms, errors, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [session.eco, session.mode, session.success ? 1 : 0, session.timeMs, session.errors, session.completedAt]
  )
}

export async function getOpeningSessions(days: number = 90): Promise<OpeningSession[]> {
  const db = getDB()
  const since = Date.now() - days * 86400000
  const rows = await db.select<DbRow[]>(
    'SELECT id, eco, mode, success, time_ms, errors, completed_at FROM opening_sessions WHERE completed_at >= $1 ORDER BY completed_at DESC',
    [since]
  )
  return rows.map(row => ({
    id: row.id as number,
    eco: row.eco as string,
    mode: row.mode as 'repertoire' | 'recognition',
    success: row.success === 1,
    timeMs: row.time_ms as number,
    errors: row.errors as number,
    completedAt: row.completed_at as number,
  }))
}

export async function getOpeningStats(): Promise<{
  totalMastered: number
  totalAttempted: number
  averageSuccessRate: number
  bestStreak: number
  byVolume: Record<string, { total: number; mastered: number }>
}> {
  const db = getDB()
  
  const progressRows = await db.select<DbRow[]>(
    'SELECT volume, mastery_level, COUNT(*) as cnt FROM openings_progress GROUP BY volume, mastery_level'
  )
  
  const sessionsRows = await db.select<DbRow[]>(
    'SELECT success FROM opening_sessions ORDER BY completed_at'
  )
  
  const byVolume: Record<string, { total: number; mastered: number }> = {}
  let totalMastered = 0
  let totalAttempted = 0
  
  for (const row of progressRows) {
    const vol = row.volume as string
    if (!byVolume[vol]) byVolume[vol] = { total: 0, mastered: 0 }
    byVolume[vol].total += row.cnt as number
    if ((row.mastery_level as number) >= 4) {
      byVolume[vol].mastered += row.cnt as number
      totalMastered += row.cnt as number
    }
    totalAttempted += row.cnt as number
  }
  
  // Calculate streak
  let currentStreak = 0
  let bestStreak = 0
  let lastDate = ''
  for (const row of sessionsRows) {
    const date = new Date(row.completed_at as number).toISOString().split('T')[0]
    if (row.success === 1) {
      if (lastDate === '' || date === lastDate) {
        currentStreak++
      } else {
        currentStreak = 1
      }
      bestStreak = Math.max(bestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
    lastDate = date
  }
  
  // Calculate average success rate
  const progress = await getOpeningProgress()
  const avgRate = progress.length > 0
    ? progress.reduce((sum, p) => sum + p.successRate, 0) / progress.length
    : 0
  
  return {
    totalMastered,
    totalAttempted,
    averageSuccessRate: Math.round(avgRate),
    bestStreak,
    byVolume,
  }
}
