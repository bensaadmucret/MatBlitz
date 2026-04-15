import { create } from 'zustand'
import type { PuzzleResult, DailyStreak, LevelTier, TimerMode, Badge } from '../types'
import { queries } from '../db'
import { allBadges } from '../data/badges'

interface GameState {
  // Init flag
  isLoaded: boolean
  loadFromDB: () => Promise<void>

  // XP & Levels
  totalXp: number
  getPuzzleXp: (difficulty: number, timeMs: number, hintsUsed: number, firstTry: boolean, combo: number) => number

  // Results
  currentCombo: number
  bestCombo: number

  // Timer
  timerMode: TimerMode
  setTimerMode: (mode: TimerMode) => void

  // Hints
  hintsUsedForCurrentPuzzle: number
  incrementHints: () => void
  resetHints: () => void

  // Actions
  addResult: (result: PuzzleResult) => void

  // Computed (read from DB)
  getTotalSolved: () => number
  getAverageTime: () => number
  getSuccessRate: () => number
  getFastestSolve: () => number
  getStreak: () => DailyStreak
  getLevelInfo: () => {
    tier: LevelTier
    tierIndex: number
    levelInTier: number
    totalLevel: number
    title: string
    emoji: string
    xpInCurrentLevel: number
    xpForNextLevel: number
    progress: number
  }
  getUnlockedBadges: () => Badge[]
  getSolvedPuzzleIds: () => Set<string>
}

const TIER_CONFIG: { tier: LevelTier; emoji: string; title: string; levels: number }[] = [
  { tier: 'pawn', emoji: '♟️', title: 'Pion', levels: 5 },
  { tier: 'knight', emoji: '♞', title: 'Cavalier', levels: 5 },
  { tier: 'bishop', emoji: '♝', title: 'Fou', levels: 5 },
  { tier: 'rook', emoji: '♜', title: 'Tour', levels: 5 },
  { tier: 'queen', emoji: '♛', title: 'Dame', levels: 5 },
  { tier: 'king', emoji: '♚', title: 'Roi', levels: 99 },
]

const XP_PER_LEVEL = 100

export const useGameStore = create<GameState>()((set, get) => ({
  isLoaded: false,
  totalXp: 0,
  currentCombo: 0,
  bestCombo: 0,
  hintsUsedForCurrentPuzzle: 0,
  timerMode: 'free',

  loadFromDB: async () => {
    try {
      const xp = parseInt(queries.getGameState('totalXp') || '0')
      const combo = parseInt(queries.getGameState('currentCombo') || '0')
      const bestCombo = parseInt(queries.getGameState('bestCombo') || '0')
      const timerMode = (queries.getSetting('timerMode', 'free')) as TimerMode

      set({
        totalXp: xp,
        currentCombo: combo,
        bestCombo: bestCombo,
        timerMode,
        isLoaded: true,
      })
    } catch (e) {
      console.error('Failed to load from DB:', e)
      set({ isLoaded: true })
    }
  },

  getPuzzleXp: (difficulty, timeMs, hintsUsed, firstTry, combo) => {
    let base = difficulty * 20
    if (firstTry) base = Math.floor(base * 1.5)
    if (timeMs < 5000) base = Math.floor(base * 1.3)
    if (timeMs < 10000) base = Math.floor(base * 1.1)
    const hintPenalty = hintsUsed * 0.3
    base = Math.floor(base * (1 - hintPenalty))
    const comboMultiplier = Math.min(1 + combo * 0.2, 3)
    return Math.max(Math.floor(base * comboMultiplier), 5)
  },

  addResult: (result) => {
    // Write to SQLite
    queries.insertResult(result)

    const state = get()
    const newCombo = result.solved ? state.currentCombo + 1 : 0
    const newBestCombo = Math.max(state.bestCombo, newCombo)

    let xpGain = 0
    if (result.solved) {
      const diff = result.puzzleId.includes('mat1') ? 1 : result.puzzleId.includes('mat2') ? 2 : result.puzzleId.includes('mat3') ? 3 : 4
      xpGain = state.getPuzzleXp(diff, result.timeMs, result.hintsUsed, result.attempts === 1, state.currentCombo)

      // Record daily streak
      queries.recordDailySolve()
    }

    const newXp = state.totalXp + xpGain

    // Persist state to SQLite
    queries.setGameState('totalXp', String(newXp))
    queries.setGameState('currentCombo', String(newCombo))
    queries.setGameState('bestCombo', String(newBestCombo))

    set({
      totalXp: newXp,
      currentCombo: newCombo,
      bestCombo: newBestCombo,
    })

    // Check badges
    const totalSolved = queries.getTotalSolved()
    const fastest = queries.getFastestSolve()
    const streak = queries.getStreak()
    const hour = new Date().getHours()
    const unlockedIds = new Set(queries.getUnlockedBadges().map(b => b.id))

    for (const badge of allBadges) {
      if (unlockedIds.has(badge.id)) continue

      let shouldUnlock = false
      switch (badge.id) {
        case 'first-blood': shouldUnlock = totalSolved >= 1; break
        case 'on-fire': shouldUnlock = newCombo >= 10; break
        case 'lightning': shouldUnlock = fastest > 0 && fastest < 5000; break
        case 'night-owl': shouldUnlock = hour >= 0 && hour < 6; break
        case 'week-warrior': shouldUnlock = streak.current >= 7; break
        case 'centurion': shouldUnlock = totalSolved >= 100; break
        case 'grandmaster': shouldUnlock = totalSolved >= 2000; break
      }

      if (shouldUnlock) {
        queries.unlockBadge({ ...badge, unlockedAt: Date.now() })
      }
    }
  },

  incrementHints: () => set(s => ({ hintsUsedForCurrentPuzzle: s.hintsUsedForCurrentPuzzle + 1 })),
  resetHints: () => set({ hintsUsedForCurrentPuzzle: 0 }),

  setTimerMode: (mode) => {
    queries.setSetting('timerMode', mode)
    set({ timerMode: mode })
  },

  getTotalSolved: () => queries.getTotalSolved(),
  getAverageTime: () => queries.getAverageTime(),
  getSuccessRate: () => queries.getSuccessRate(),
  getFastestSolve: () => queries.getFastestSolve(),
  getSolvedPuzzleIds: () => queries.getSolvedPuzzleIds(),
  getStreak: () => queries.getStreak(),
  getUnlockedBadges: () => queries.getUnlockedBadges(),

  getLevelInfo: () => {
    const xp = get().totalXp
    const totalLevel = Math.floor(xp / XP_PER_LEVEL) + 1
    let remainingXp = xp
    let tierIndex = 0
    let levelInTier = 1

    for (let i = 0; i < TIER_CONFIG.length; i++) {
      const tierXp = TIER_CONFIG[i].levels * XP_PER_LEVEL
      if (remainingXp < tierXp) {
        tierIndex = i
        levelInTier = Math.floor(remainingXp / XP_PER_LEVEL) + 1
        break
      }
      remainingXp -= tierXp
      if (i === TIER_CONFIG.length - 1) {
        tierIndex = i
        levelInTier = Math.floor(remainingXp / XP_PER_LEVEL) + 1
      }
    }

    const config = TIER_CONFIG[tierIndex]
    const xpInLevel = xp % XP_PER_LEVEL

    return {
      tier: config.tier,
      tierIndex,
      levelInTier,
      totalLevel,
      title: config.title,
      emoji: config.emoji,
      xpInCurrentLevel: xpInLevel,
      xpForNextLevel: XP_PER_LEVEL,
      progress: xpInLevel / XP_PER_LEVEL,
    }
  },
}))
