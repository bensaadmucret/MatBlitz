export interface ChessOpening {
  eco: string
  name: string
  pgn: string
  uci: string
  epd: string
  volume: 'A' | 'B' | 'C' | 'D' | 'E'
  moves: string[]
}

export type OpeningMode = 'repertoire' | 'recognition' | 'learning'

export interface OpeningProgress {
  eco: string
  name: string
  volume: 'A' | 'B' | 'C' | 'D' | 'E'
  attempts: number
  successes: number
  successRate: number
  bestTimeMs?: number
  lastTrainedAt?: number
  masteryLevel: 0 | 1 | 2 | 3 | 4 | 5
}

export interface OpeningSession {
  id?: number
  eco: string
  mode: OpeningMode
  success: boolean
  timeMs: number
  errors: number
  completedAt: number
}

export type OpeningFilter = 'all' | 'A' | 'B' | 'C' | 'D' | 'E' | 'mastered' | 'learning'

export interface OpeningTrainingState {
  currentOpening: ChessOpening | null
  mode: OpeningMode
  currentMoveIndex: number
  isTraining: boolean
  startTime: number
  errors: number
  lastResult: 'correct' | 'incorrect' | null
  isComplete: boolean
}
