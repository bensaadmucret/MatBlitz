import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PuzzleResult, DailyStreak, LevelTier, TimerMode, Badge } from '../types'
import { allBadges } from '../data/badges'

interface GameState {
  // XP & Levels
  totalXp: number
  getPuzzleXp: (difficulty: number, timeMs: number, hintsUsed: number, firstTry: boolean, combo: number) => number
  
  // Results
  results: PuzzleResult[]
  addResult: (result: PuzzleResult) => void
  
  // Solved puzzle IDs
  solvedPuzzleIds: Set<string>
  
  // Combo
  currentCombo: number
  bestCombo: number
  
  // Streak
  streak: DailyStreak
  updateStreak: () => void
  
  // Hints
  hintsUsedForCurrentPuzzle: number
  incrementHints: () => void
  resetHints: () => void
  
  // Timer
  timerMode: TimerMode
  setTimerMode: (mode: TimerMode) => void
  
  // Badges
  unlockedBadges: Badge[]
  checkBadges: () => void
  
  // Level helpers
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
  
  // Stats helpers
  getTotalSolved: () => number
  getAverageTime: () => number
  getSuccessRate: () => number
  getFastestSolve: () => number
  getCategoryProgress: (category: string) => { solved: number; total: number }
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

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      totalXp: 0,
      results: [],
      solvedPuzzleIds: new Set<string>(),
      currentCombo: 0,
      bestCombo: 0,
      streak: { current: 0, longest: 0, lastDate: '' },
      hintsUsedForCurrentPuzzle: 0,
      timerMode: 'free',
      unlockedBadges: [],
      
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
        const state = get()
        const newCombo = result.solved ? state.currentCombo + 1 : 0
        const newBestCombo = Math.max(state.bestCombo, newCombo)
        const xp = result.solved
          ? state.getPuzzleXp(
              result.puzzleId.includes('mat1') ? 1 : result.puzzleId.includes('mat2') ? 2 : result.puzzleId.includes('mat3') ? 3 : 4,
              result.timeMs,
              result.hintsUsed,
              result.attempts === 1,
              state.currentCombo
            )
          : 0
        const newSolved = new Set(state.solvedPuzzleIds)
        if (result.solved) newSolved.add(result.puzzleId)
        
        set({
          results: [...state.results, result],
          solvedPuzzleIds: newSolved,
          currentCombo: newCombo,
          bestCombo: newBestCombo,
          totalXp: state.totalXp + xp,
        })
        
        get().updateStreak()
        get().checkBadges()
      },
      
      updateStreak: () => {
        const today = new Date().toISOString().split('T')[0]
        const { streak } = get()
        if (streak.lastDate === today) return
        
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const newCurrent = streak.lastDate === yesterday ? streak.current + 1 : 1
        
        set({
          streak: {
            current: newCurrent,
            longest: Math.max(streak.longest, newCurrent),
            lastDate: today,
          },
        })
      },
      
      incrementHints: () => set(s => ({ hintsUsedForCurrentPuzzle: s.hintsUsedForCurrentPuzzle + 1 })),
      resetHints: () => set({ hintsUsedForCurrentPuzzle: 0 }),
      
      setTimerMode: (mode) => set({ timerMode: mode }),
      
      checkBadges: () => {
        const state = get()
        const unlockedIds = new Set(state.unlockedBadges.map(b => b.id))
        const newBadges: Badge[] = []
        
        for (const badge of allBadges) {
          if (unlockedIds.has(badge.id)) continue
          
          const totalSolved = state.getTotalSolved()
          const fastest = state.getFastestSolve()
          
          let shouldUnlock = false
          switch (badge.id) {
            case 'first-blood': shouldUnlock = totalSolved >= 1; break
            case 'on-fire': shouldUnlock = state.currentCombo >= 10; break
            case 'lightning': shouldUnlock = fastest > 0 && fastest < 5000; break
            case 'night-owl': {
              const hour = new Date().getHours()
              shouldUnlock = hour >= 0 && hour < 6
              break
            }
            case 'week-warrior': shouldUnlock = state.streak.current >= 7; break
            case 'centurion': shouldUnlock = totalSolved >= 100; break
            case 'grandmaster': shouldUnlock = totalSolved >= 2000; break
          }
          
          if (shouldUnlock) {
            newBadges.push({ ...badge, unlockedAt: Date.now() })
          }
        }
        
        if (newBadges.length > 0) {
          set({ unlockedBadges: [...state.unlockedBadges, ...newBadges] })
        }
      },
      
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
      
      getTotalSolved: () => {
        return get().results.filter(r => r.solved).length
      },
      
      getAverageTime: () => {
        const solved = get().results.filter(r => r.solved)
        if (solved.length === 0) return 0
        return Math.round(solved.reduce((acc, r) => acc + r.timeMs, 0) / solved.length)
      },
      
      getSuccessRate: () => {
        const results = get().results
        if (results.length === 0) return 0
        return Math.round((results.filter(r => r.solved).length / results.length) * 100)
      },
      
      getFastestSolve: () => {
        const solved = get().results.filter(r => r.solved)
        if (solved.length === 0) return 0
        return Math.min(...solved.map(r => r.timeMs))
      },
      
      getCategoryProgress: (category: string) => {
        const solved = get().results.filter(
          r => r.solved && r.puzzleId.startsWith(category)
        ).length
        return { solved, total: 0 } // total will be computed from puzzle data
      },
    }),
    {
      name: 'matblitz-game',
      partialize: (state) => ({
        totalXp: state.totalXp,
        results: state.results,
        solvedPuzzleIds: Array.from(state.solvedPuzzleIds),
        currentCombo: state.currentCombo,
        bestCombo: state.bestCombo,
        streak: state.streak,
        timerMode: state.timerMode,
        unlockedBadges: state.unlockedBadges,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        solvedPuzzleIds: new Set(persisted.solvedPuzzleIds || []),
      }),
    }
  )
)
