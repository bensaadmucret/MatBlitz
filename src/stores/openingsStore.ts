import { create } from 'zustand'
import type { ChessOpening, OpeningMode, OpeningProgress, OpeningTrainingState } from '../types'
import { queries } from '../db'
import openingsData from '../data/chess-openings.json'

interface OpeningsState {
  // Data
  openings: ChessOpening[]
  progress: Map<string, OpeningProgress>
  
  // Training state
  training: OpeningTrainingState
  
  // Loading
  isLoaded: boolean
  
  // Actions
  loadOpenings: () => Promise<void>
  loadProgress: () => Promise<void>
  startTraining: (eco: string, mode: OpeningMode) => void
  makeMove: (move: string) => { correct: boolean; nextMove?: string; complete?: boolean }
  useHint: () => string | null
  abandonTraining: () => void
  completeTraining: (completionData?: { eco: string; name: string; volume: 'A' | 'B' | 'C' | 'D' | 'E'; mode: OpeningMode; errors: number; timeMs: number; success: boolean }) => Promise<void>
  
  // Queries
  getProgressForEco: (eco: string) => OpeningProgress | undefined
  getOpeningsByVolume: (volume: 'A' | 'B' | 'C' | 'D' | 'E') => ChessOpening[]
  getRecommendedOpenings: (count?: number) => ChessOpening[]
  getFilteredOpenings: (filter: 'all' | 'A' | 'B' | 'C' | 'D' | 'E' | 'mastered' | 'learning', search?: string) => ChessOpening[]
  
  // Stats
  getTotalMastered: () => number
  getStatsByVolume: () => Record<string, { total: number; mastered: number; learning: number }>
}

export const useOpeningsStore = create<OpeningsState>()((set, get) => ({
  openings: [],
  progress: new Map(),
  isLoaded: false,
  
  training: {
    currentOpening: null,
    mode: 'repertoire',
    currentMoveIndex: 0,
    isTraining: false,
    startTime: 0,
    errors: 0,
    lastResult: null,
    isComplete: false,
  },
  
  loadOpenings: async () => {
    // Load from JSON file
    set({ openings: openingsData as ChessOpening[] })
  },
  
  loadProgress: async () => {
    try {
      const progress = await queries.getOpeningProgress()
      const progressMap = new Map<string, OpeningProgress>()
      for (const p of progress) {
        progressMap.set(p.eco, p)
      }
      set({ progress: progressMap, isLoaded: true })
    } catch (e) {
      console.error('Failed to load opening progress:', e)
      set({ isLoaded: true })
    }
  },
  
  startTraining: (eco: string, mode: OpeningMode) => {
    const { openings } = get()
    const opening = openings.find(o => o.eco === eco)
    if (!opening) return
    
    set({
      training: {
        currentOpening: opening,
        mode,
        currentMoveIndex: 0,
        isTraining: true,
        startTime: Date.now(),
        errors: 0,
        lastResult: null,
        isComplete: false,
      }
    })
  },
  
  makeMove: (move: string) => {
    const { training } = get()
    if (!training.isTraining || !training.currentOpening) {
      return { correct: false }
    }
    
    const { currentOpening, currentMoveIndex, mode } = training
    const expectedMove = currentOpening.moves[currentMoveIndex]
    
    // Normalize move for comparison (handle both SAN and UCI-like formats)
    const normalizedMove = move.trim()
    const normalizedExpected = expectedMove.trim()
    
    // Check if move matches (exact match or common variations)
    const isCorrect = normalizedMove === normalizedExpected ||
                     normalizedMove.toLowerCase() === normalizedExpected.toLowerCase()
    
    if (isCorrect) {
      const newIndex = currentMoveIndex + 1
      const isComplete = newIndex >= currentOpening.moves.length
      
      if (isComplete) {
        set(state => ({
          training: {
            ...state.training,
            currentMoveIndex: newIndex,
            isComplete: true,
            lastResult: 'correct',
          }
        }))
        return { correct: true, complete: true }
      }
      
      // In repertoire mode, we need to play the opponent's response
      let nextMove: string | undefined
      if (mode === 'repertoire' && newIndex < currentOpening.moves.length) {
        // If we just played white's move, black responds (and vice versa)
        nextMove = currentOpening.moves[newIndex]
        set(state => ({
          training: {
            ...state.training,
            currentMoveIndex: newIndex + 1,
            lastResult: 'correct',
          }
        }))
        return { correct: true, nextMove, complete: false }
      }
      
      set(state => ({
        training: {
          ...state.training,
          currentMoveIndex: newIndex,
          lastResult: 'correct',
        }
      }))
      return { correct: true, complete: false }
    } else {
      set(state => ({
        training: {
          ...state.training,
          errors: state.training.errors + 1,
          lastResult: 'incorrect',
        }
      }))
      return { correct: false }
    }
  },
  
  useHint: () => {
    const { training } = get()
    if (!training.isTraining || !training.currentOpening) return null
    
    const { currentOpening, currentMoveIndex } = training
    return currentOpening.moves[currentMoveIndex] || null
  },
  
  abandonTraining: () => {
    set({
      training: {
        currentOpening: null,
        mode: 'repertoire',
        currentMoveIndex: 0,
        isTraining: false,
        startTime: 0,
        errors: 0,
        lastResult: null,
        isComplete: false,
      }
    })
  },
  
  completeTraining: async (completionData) => {
    const { progress } = get()
    
    let eco: string, name: string, volume: 'A' | 'B' | 'C' | 'D' | 'E', mode: OpeningMode, errors: number, timeMs: number, success: boolean
    
    if (completionData) {
      eco = completionData.eco
      name = completionData.name
      volume = completionData.volume
      mode = completionData.mode
      errors = completionData.errors
      timeMs = completionData.timeMs
      success = completionData.success
    } else {
      const { training } = get()
      if (!training.isTraining || !training.currentOpening) return
      eco = training.currentOpening.eco
      name = training.currentOpening.name
      volume = training.currentOpening.volume
      mode = training.mode
      errors = training.errors
      timeMs = Date.now() - training.startTime
      success = training.isComplete && errors === 0
    }
    
    // Update database
    await queries.updateOpeningProgress(eco, name, volume, success, timeMs)
    
    await queries.insertOpeningSession({
      eco,
      mode,
      success,
      timeMs,
      errors,
      completedAt: Date.now(),
    })
    
    // Update local progress map
    const updatedProgress = await queries.getOpeningProgressByEco(eco)
    if (updatedProgress) {
      const newProgress = new Map(progress)
      newProgress.set(eco, updatedProgress)
      set({ progress: newProgress })
    }
    
    // Reset training state
    set({
      training: {
        currentOpening: null,
        mode: 'repertoire',
        currentMoveIndex: 0,
        isTraining: false,
        startTime: 0,
        errors: 0,
        lastResult: null,
        isComplete: false,
      }
    })
  },
  
  getProgressForEco: (eco: string) => {
    return get().progress.get(eco)
  },
  
  getOpeningsByVolume: (volume: 'A' | 'B' | 'C' | 'D' | 'E') => {
    return get().openings.filter(o => o.volume === volume)
  },
  
  getRecommendedOpenings: (count = 10) => {
    const { openings, progress } = get()
    
    // Score openings based on attempts and success rate
    const scored = openings.map(o => {
      const p = progress.get(o.eco)
      const score = p
        ? (p.attempts < 3 ? 100 : 0) + (100 - p.successRate)
        : 1000 // Never attempted = highest priority
      return { opening: o, score }
    })
    
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, count).map(s => s.opening)
  },
  
  getFilteredOpenings: (filter: 'all' | 'A' | 'B' | 'C' | 'D' | 'E' | 'mastered' | 'learning', search?: string) => {
    const { openings, progress } = get()
    
    let filtered = openings
    
    // Apply category filter
    if (filter === 'mastered') {
      filtered = openings.filter(o => {
        const p = progress.get(o.eco)
        return p && p.masteryLevel >= 4
      })
    } else if (filter === 'learning') {
      filtered = openings.filter(o => {
        const p = progress.get(o.eco)
        return !p || p.masteryLevel < 4
      })
    } else if (filter !== 'all') {
      filtered = openings.filter(o => o.volume === filter)
    }
    
    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(o => 
        o.name.toLowerCase().includes(searchLower) ||
        o.eco.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered
  },
  
  getTotalMastered: () => {
    const { progress } = get()
    return Array.from(progress.values()).filter(p => p.masteryLevel >= 4).length
  },
  
  getStatsByVolume: () => {
    const { openings, progress } = get()
    const stats: Record<string, { total: number; mastered: number; learning: number }> = {
      A: { total: 0, mastered: 0, learning: 0 },
      B: { total: 0, mastered: 0, learning: 0 },
      C: { total: 0, mastered: 0, learning: 0 },
      D: { total: 0, mastered: 0, learning: 0 },
      E: { total: 0, mastered: 0, learning: 0 },
    }
    
    for (const o of openings) {
      stats[o.volume].total++
      const p = progress.get(o.eco)
      if (p && p.masteryLevel >= 4) {
        stats[o.volume].mastered++
      } else {
        stats[o.volume].learning++
      }
    }
    
    return stats
  },
}))
