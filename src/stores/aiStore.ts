import { create } from 'zustand'
import { Chess, type Square } from 'chess.js'

export type AILevel = 1 | 2 | 3 | 4 | 5
export type AIMode = 'spartacus' | 'adaptive' | 'free-play'

export interface MoveAnalysis {
  san: string
  from: string
  to: string
  evaluationBefore: number
  evaluationAfter: number
  isBestMove: boolean
  evalDelta: number
}

interface AIState {
  mode: AIMode
  aiLevel: AILevel
  fen: string
  isThinking: boolean
  gameHistory: string[]
  moveAnalyses: MoveAnalysis[]
  playerColor: 'white' | 'black'
  gameResult: 'playing' | 'win' | 'loss' | 'draw' | 'challenge-complete'
  lastMove: { from: string; to: string } | null
  lastAIError: string | null

  setMode: (mode: AIMode) => void
  setAILevel: (level: AILevel) => void
  setPlayerColor: (color: 'white' | 'black') => void
  startGame: (fen: string, playerColor: 'white' | 'black') => void
  makeMove: (from: string, to: string, promotion?: string) => boolean
  makeAIMove: (bestMove: { san: string; from: string; to: string; promotion?: string }) => void
  setThinking: (thinking: boolean) => void
  resetGame: () => void
  addAnalysis: (analysis: MoveAnalysis) => void
  setGameResult: (result: 'playing' | 'win' | 'loss' | 'draw' | 'challenge-complete') => void
  setLastError: (error: string | null) => void
}

export const useAIStore = create<AIState>()((set, get) => ({
  mode: 'spartacus',
  aiLevel: 3,
  fen: '',
  isThinking: false,
  gameHistory: [],
  moveAnalyses: [],
  playerColor: 'white',
  gameResult: 'playing',
  lastMove: null,
  lastAIError: null,

  setMode: (mode) => set({ mode }),
  setAILevel: (level) => set({ aiLevel: level }),
  setPlayerColor: (color) => set({ playerColor: color }),

  startGame: (fen, playerColor) => {
    const game = new Chess(fen)
    set({
      fen: game.fen(),
      playerColor,
      gameHistory: [game.fen()],
      moveAnalyses: [],
      gameResult: 'playing',
      lastMove: null,
      isThinking: false,
      lastAIError: null,
    })
  },

  makeMove: (from, to, promotion) => {
    const state = get()
    const game = new Chess(state.fen)

    try {
      const move = game.move({ from: from as Square, to: to as Square, promotion: promotion || 'q' })
      if (!move) return false

      const newFen = game.fen()
      const newHistory = [...state.gameHistory, newFen]

      let result: 'playing' | 'win' | 'loss' | 'draw' | 'challenge-complete' = 'playing'

      if (game.isCheckmate()) {
        result = 'win'
      } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
        result = 'draw'
      }

      set({
        fen: newFen,
        gameHistory: newHistory,
        lastMove: { from: move.from, to: move.to },
        gameResult: result,
      })

      return true
    } catch {
      return false
    }
  },

  makeAIMove: (bestMove) => {
    const state = get()
    const game = new Chess(state.fen)

    try {
      const move = game.move({
        from: bestMove.from as Square,
        to: bestMove.to as Square,
        promotion: bestMove.promotion || 'q',
      })
      if (!move) {
        set({ lastAIError: `Invalid AI move: ${bestMove.san}`, isThinking: false })
        return
      }

      const newFen = game.fen()
      const newHistory = [...state.gameHistory, newFen]

      let result: 'playing' | 'win' | 'loss' | 'draw' | 'challenge-complete' = 'playing'

      if (game.isCheckmate()) {
        result = 'loss'
      } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
        result = 'draw'
      }

      set({
        fen: newFen,
        gameHistory: newHistory,
        lastMove: { from: move.from, to: move.to },
        isThinking: false,
        gameResult: result,
      })
    } catch (e) {
      set({ lastAIError: `AI move error: ${e}`, isThinking: false })
    }
  },

  setThinking: (thinking) => set({ isThinking: thinking }),
  resetGame: () => set({
    fen: '',
    gameHistory: [],
    moveAnalyses: [],
    gameResult: 'playing',
    lastMove: null,
    isThinking: false,
    lastAIError: null,
  }),
  addAnalysis: (analysis) => set(s => ({ moveAnalyses: [...s.moveAnalyses, analysis] })),
  setGameResult: (result) => set({ gameResult: result }),
  setLastError: (error) => set({ lastAIError: error }),
}))

// Helper to get depth from level
export function getDepthFromLevel(level: AILevel): number {
  return level // Level 1 = depth 1, Level 5 = depth 5
}
