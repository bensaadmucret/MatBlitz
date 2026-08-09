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
  addXp: (amount: number) => Promise<void>

  // Results
  currentCombo: number
  bestCombo: number

  // Timer
  timerMode: TimerMode
  setTimerMode: (mode: TimerMode) => void

  // Game status
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void

  // Badge notifications
  lastUnlockedBadges: Badge[] | null
  clearLastUnlockedBadges: () => void

  // Hints
  hintsUsedForCurrentPuzzle: number
  incrementHints: () => void
  resetHints: () => void

  // Actions
  addResult: (result: PuzzleResult) => void

  // Computed (read from DB — now async)
  getTotalSolved: () => Promise<number>
  getAverageTime: () => Promise<number>
  getSuccessRate: () => Promise<number>
  getFastestSolve: () => Promise<number>
  getStreak: () => Promise<DailyStreak>
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
  getUnlockedBadges: () => Promise<Badge[]>
  getSolvedPuzzleIds: () => Promise<Set<string>>
  getDifficultyStats: () => Promise<{ difficulty: number; solved: number; attempted: number }[]>
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
  isPlaying: false,
  lastUnlockedBadges: null,

  loadFromDB: async () => {
    try {
      const xp = parseInt((await queries.getGameState('totalXp')) || '0')
      const combo = parseInt((await queries.getGameState('currentCombo')) || '0')
      const bestCombo = parseInt((await queries.getGameState('bestCombo')) || '0')
      const timerMode = (await queries.getSetting('timerMode', 'free')) as TimerMode

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
    if (timeMs > 30000) base = Math.floor(base * 0.8)
    if (hintsUsed > 0) base = Math.floor(base * (1 - hintsUsed * 0.25))
    if (combo > 5) base = Math.floor(base * (1 + combo * 0.1))
    return Math.max(5, base)
  },

  addXp: async (amount: number) => {
    const state = get()
    const newXp = Math.max(0, state.totalXp + amount)
    await queries.setGameState('totalXp', String(newXp))
    set({ totalXp: newXp })
  },

  addResult: (result) => {
    // Fire and forget — write to SQLite async
    ;(async () => {
      try {
        await queries.insertResult(result)

        const state = get()
        const newCombo = result.solved ? state.currentCombo + 1 : 0
        const newBestCombo = Math.max(state.bestCombo, newCombo)

        let xpGain = 0
        if (result.solved) {
          xpGain = state.getPuzzleXp(result.difficulty, result.timeMs, result.hintsUsed, result.attempts === 1, state.currentCombo)

          await queries.recordDailySolve()
        }

        const newXp = state.totalXp + xpGain

        await queries.setGameState('totalXp', String(newXp))
        await queries.setGameState('currentCombo', String(newCombo))
        await queries.setGameState('bestCombo', String(newBestCombo))

        set({
          totalXp: newXp,
          currentCombo: newCombo,
          bestCombo: newBestCombo,
        })

        // Check badges
        const totalSolved = await queries.getTotalSolved()
        const fastest = await queries.getFastestSolve()
        const streak = await queries.getStreak()
        const hour = new Date().getHours()
        const unlockedIds = new Set((await queries.getUnlockedBadges()).map(b => b.id))
        const categoryStats = await queries.getCategoryStats()
        const openingStats = await queries.getOpeningStats()
        const openingSessions = await queries.getOpeningSessions()

        const newlyUnlocked: Badge[] = []

        for (const badge of allBadges) {
          if (unlockedIds.has(badge.id)) continue

          let shouldUnlock = false
          switch (badge.id) {
            case 'first-blood':
              shouldUnlock = totalSolved >= 1
              break
            case 'on-fire':
              shouldUnlock = newCombo >= 10
              break
            case 'lightning':
              shouldUnlock = fastest > 0 && fastest < 5000
              break
            case 'strategist':
              shouldUnlock = categoryStats.some(c => c.total > 0 && c.solved / c.total >= 1)
              break
            case 'grandmaster':
              shouldUnlock = totalSolved >= 2000
              break
            case 'night-owl':
              shouldUnlock = hour >= 0 && hour < 6
              break
            case 'resurrected':
              shouldUnlock = result.attempts >= 3 && result.solved
              break
            case 'week-warrior':
              shouldUnlock = streak.current >= 7
              break
            case 'centurion':
              shouldUnlock = totalSolved >= 100
              break
            case 'speed-demon': {
              const fastSolves = await queries.getResultsByDateRange(0, Date.now())
              const under30 = fastSolves.filter(r => r.solved && r.timeMs < 30000)
              shouldUnlock = under30.length >= 10
              break
            }
            case 'opening-novice':
              shouldUnlock = openingStats.totalMastered >= 1
              break
            case 'opening-scholar':
              shouldUnlock = openingStats.totalMastered >= 10
              break
            case 'opening-master-a': {
              const volA = openingStats.byVolume['A']
              shouldUnlock = volA ? volA.mastered >= 1 && volA.mastered === volA.total : false
              break
            }
            case 'opening-repertoire':
              shouldUnlock = openingSessions.filter(s => s.mode === 'repertoire').length >= 100
              break
            case 'opening-recognition':
              shouldUnlock = openingSessions.filter(s => s.mode === 'recognition').length >= 50
              break
            case 'opening-grandmaster':
              shouldUnlock = openingStats.totalMastered >= 50
              break
          }

          if (shouldUnlock) {
            await queries.unlockBadge({ ...badge, unlockedAt: Date.now() })
            newlyUnlocked.push(badge)
          }
        }

        // Store newly unlocked badges for notification
        if (newlyUnlocked.length > 0) {
          set({ lastUnlockedBadges: newlyUnlocked })
        }
      } catch (e) {
        console.error('addResult failed:', e)
      }
    })()
  },

  incrementHints: () => set(s => ({ hintsUsedForCurrentPuzzle: s.hintsUsedForCurrentPuzzle + 1 })),
  resetHints: () => set({ hintsUsedForCurrentPuzzle: 0 }),

  setTimerMode: (mode) => {
    queries.setSetting('timerMode', mode)
    set({ timerMode: mode })
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  clearLastUnlockedBadges: () => set({ lastUnlockedBadges: null }),

  getTotalSolved: () => queries.getTotalSolved(),
  getAverageTime: () => queries.getAverageTime(),
  getSuccessRate: () => queries.getSuccessRate(),
  getFastestSolve: () => queries.getFastestSolve(),
  getSolvedPuzzleIds: () => queries.getSolvedPuzzleIds(),
  getStreak: () => queries.getStreak(),
  getUnlockedBadges: () => queries.getUnlockedBadges(),
  getDifficultyStats: () => queries.getDifficultyStats(),

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
