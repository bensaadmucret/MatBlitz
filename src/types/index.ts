export interface Puzzle {
  id: string
  fen: string
  solution: string[]
  category: PuzzleCategory
  subcategory: string
  difficulty: 1 | 2 | 3 | 4
  sideToMove: 'white' | 'black'
  source: string
  exerciseNumber: number
}

export type PuzzleCategory = 'mat-en-1' | 'mat-en-2' | 'mat-en-3' | 'mat-en-4'

export type TimerMode = 'free' | 'blitz' | 'survival'

export type Difficulty = 1 | 2 | 3 | 4

export interface TimerConfig {
  free: { label: string; description: string }
  blitz: { label: string; description: string; timeByDifficulty: Record<Difficulty, number> }
  survival: { label: string; description: string; baseTime: number; bonusByDifficulty: Record<Difficulty, number> }
}

export interface Badge {
  id: string
  name: string
  emoji: string
  description: string
  condition: string
  unlockedAt?: number
}

export interface PuzzleResult {
  puzzleId: string
  solved: boolean
  timeMs: number
  hintsUsed: number
  attempts: number
  timestamp: number
  comboBefore: number
}

export interface DailyStreak {
  current: number
  longest: number
  lastDate: string // YYYY-MM-DD
}

export type LevelTier = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

export interface LevelInfo {
  tier: LevelTier
  tierIndex: number
  levelInTier: number
  totalLevel: number
  title: string
  emoji: string
  xpInCurrentLevel: number
  xpForNextLevel: number
}

export interface CategoryProgress {
  category: PuzzleCategory
  subcategory: string
  total: number
  solved: number
  perfectCount: number // solved on first try, no hints
  averageTimeMs: number
}

export interface TimerState {
  mode: TimerMode
  timeRemaining: number | null // null = free mode (no limit)
  isRunning: boolean
  startedAt: number | null
  elapsedMs: number
}
