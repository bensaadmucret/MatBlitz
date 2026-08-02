/// <reference lib="webworker" />
import { Chess } from 'chess.js'

// Piece values for evaluation
const PIECE_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
}

// Piece-square tables (from white's perspective, mirrored for black)
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
]

const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]

const BISHOP_TABLE = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
]

const ROOK_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
]

const QUEEN_TABLE = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
]

const KING_TABLE = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
]

const TABLES: Record<string, number[]> = {
  p: PAWN_TABLE, n: KNIGHT_TABLE, b: BISHOP_TABLE, r: ROOK_TABLE, q: QUEEN_TABLE, k: KING_TABLE,
}

function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -100000 : 100000
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0
  }

  let score = 0
  const board = game.board()

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file]
      if (!piece) continue

      const pieceType = piece.type
      const isWhite = piece.color === 'w'
      const value = PIECE_VALUES[pieceType]
      const tableIdx = isWhite ? rank * 8 + file : (7 - rank) * 8 + file
      const positionalValue = TABLES[pieceType][tableIdx]

      if (isWhite) {
        score += value + positionalValue
      } else {
        score -= value + positionalValue
      }
    }
  }

  return score
}

// Move ordering: captures first (MVV-LVA)
function orderMoves(game: Chess): string[] {
  const moves = game.moves({ verbose: true })
  return moves
    .map(m => {
      let score = 0
      if (m.captured) {
        score += 10 * PIECE_VALUES[m.captured] - PIECE_VALUES[m.piece]
      }
      if (m.promotion) {
        score += PIECE_VALUES[m.promotion]
      }
      if (m.san.includes('+')) {
        score += 50
      }
      return { san: m.san, score }
    })
    .sort((a, b) => b.score - a.score)
    .map(m => m.san)
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluate(game)
  }

  const orderedMoves = orderMoves(game)

  if (maximizing) {
    let maxEval = -Infinity
    for (const san of orderedMoves) {
      game.move(san)
      const evalScore = minimax(game, depth - 1, alpha, beta, false)
      game.undo()
      maxEval = Math.max(maxEval, evalScore)
      alpha = Math.max(alpha, evalScore)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const san of orderedMoves) {
      game.move(san)
      const evalScore = minimax(game, depth - 1, alpha, beta, true)
      game.undo()
      minEval = Math.min(minEval, evalScore)
      beta = Math.min(beta, evalScore)
      if (beta <= alpha) break
    }
    return minEval
  }
}

function findBestMove(fen: string, depth: number): { san: string; from: string; to: string; promotion?: string } | null {
  const game = new Chess(fen)
  const isWhite = game.turn() === 'w'
  const orderedMoves = orderMoves(game)

  if (orderedMoves.length === 0) return null

  let bestMove = orderedMoves[0]
  let bestEval = isWhite ? -Infinity : Infinity

  for (const san of orderedMoves) {
    game.move(san)
    const evalScore = minimax(game, depth - 1, -Infinity, Infinity, !isWhite)
    game.undo()

    if (isWhite) {
      if (evalScore > bestEval) {
        bestEval = evalScore
        bestMove = san
      }
    } else {
      if (evalScore < bestEval) {
        bestEval = evalScore
        bestMove = san
      }
    }
  }

  // Get move details
  const game2 = new Chess(fen)
  const move = game2.move(bestMove)
  return move ? { san: move.san, from: move.from, to: move.to, promotion: move.promotion } : null
}

// Analyze a position: find the best move and evaluate
function analyzePosition(fen: string, depth: number): { bestMove: { san: string; from: string; to: string } | null; evaluation: number } {
  const game = new Chess(fen)
  const isWhite = game.turn() === 'w'

  if (game.isGameOver()) {
    return { bestMove: null, evaluation: evaluate(game) }
  }

  const best = findBestMove(fen, depth)
  const evaluation = isWhite ? -Infinity : Infinity

  // Re-evaluate with the best move
  if (best) {
    const game2 = new Chess(fen)
    game2.move(best.san)
    return { bestMove: best, evaluation: minimax(game2, depth - 1, -Infinity, Infinity, !isWhite) }
  }

  return { bestMove: null, evaluation }
}

self.onmessage = (e: MessageEvent) => {
  const { type, fen, depth, moveCount } = e.data

  if (type === 'findBestMove') {
    const result = findBestMove(fen, depth || 3)
    self.postMessage({ type: 'bestMove', move: result })
  } else if (type === 'analyze') {
    const result = analyzePosition(fen, depth || 3)
    self.postMessage({ type: 'analysis', ...result })
  } else if (type === 'evaluateAfterMove') {
    // Evaluate position after a specific move (for adaptive analysis)
    const game = new Chess(fen)
    const moveCountNum = moveCount || 0
    void moveCountNum
    const evalScore = evaluate(game)
    self.postMessage({ type: 'evaluation', evaluation: evalScore })
  }
}
