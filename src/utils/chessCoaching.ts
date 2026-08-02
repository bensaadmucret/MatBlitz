import { Chess, type Square } from 'chess.js'

export interface MoveEvaluation {
  bestMove: string | null
  bestMoveSan: string | null
  scoreCp: number | null
  scoreMate: number | null
  depth: number
  pv: string[]
  pvSan: string[]
}

export interface MoveCoaching {
  classification: 'brilliant' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'best'
  symbol: string
  label: string
  color: string
  evalBefore: number | null
  evalAfter: number | null
  evalDelta: number | null
  bestMoveSan: string | null
  advice: string
}

// Convert centipawn score to a normalized winning probability (0-100%)
// Using a logistic function like Lichess does
export function cpToWinProb(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

// Convert UCI move (e2e4) to SAN using chess.js
export function uciToSan(fen: string, uci: string): string | null {
  if (!uci || uci === '(none)') return null
  try {
    const game = new Chess(fen)
    const move = game.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci.length === 5 ? uci[4] : undefined,
    })
    return move ? move.san : null
  } catch {
    return null
  }
}

// Convert PV (array of UCI moves) to SAN
export function pvToSan(fen: string, pv: string[]): string[] {
  try {
    const game = new Chess(fen)
    const sanMoves: string[] = []
    for (const uci of pv) {
      const move = game.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: uci.length === 5 ? uci[4] : undefined,
      })
      if (!move) break
      sanMoves.push(move.san)
    }
    return sanMoves
  } catch {
    return []
  }
}

// Classify a move based on evaluation delta
// evalBefore and evalAfter are from the player's perspective (positive = good for player)
export function classifyMove(
  playerPlayedSan: string,
  bestMoveSan: string | null,
  evalBefore: number | null,
  evalAfter: number | null,
  isCheck: boolean,
): MoveCoaching {
  if (evalBefore === null || evalAfter === null) {
    return {
      classification: 'good',
      symbol: '',
      label: 'Analyse...',
      color: '#6b7280',
      evalBefore,
      evalAfter,
      evalDelta: null,
      bestMoveSan,
      advice: 'Analyse en cours...',
    }
  }

  // Delta from player's perspective (positive = good for player)
  const delta = evalBefore - evalAfter

  // If player played the best move
  if (bestMoveSan && playerPlayedSan === bestMoveSan) {
    // Check if it's a brilliant move (sacrifice that's good)
    if (isCheck && Math.abs(evalAfter) > 200) {
      return {
        classification: 'brilliant',
        symbol: '!!',
        label: 'Brillant',
        color: '#10b981',
        evalBefore,
        evalAfter,
        evalDelta: delta,
        bestMoveSan,
        advice: 'Coup brillant ! Mise la pression sur l\'adversaire.',
      }
    }
    return {
      classification: 'best',
      symbol: '',
      label: 'Meilleur coup',
      color: '#10b981',
      evalBefore,
      evalAfter,
      evalDelta: delta,
      bestMoveSan,
      advice: 'Meilleur coup ! C\'est exactement ce que Stockfish recommande.',
    }
  }

  // Classify based on evaluation loss (in centipawns)
  // delta > 0 = position worsened, delta < 0 = position improved
  // Only penalize when the move worsened the position
  if (delta <= 0) {
    // Player didn't play the best move but still improved the position
    return {
      classification: 'great',
      symbol: '!',
      label: 'Très bon coup',
      color: '#10b981',
      evalBefore,
      evalAfter,
      evalDelta: delta,
      bestMoveSan,
      advice: `Très bon coup, la position s'est améliorée. ${bestMoveSan ? `${bestMoveSan} était encore meilleur.` : ''}`,
    }
  }

  const absDelta = delta

  if (absDelta < 30) {
    return {
      classification: 'great',
      symbol: '!',
      label: 'Très bon coup',
      color: '#10b981',
      evalBefore,
      evalAfter,
      evalDelta: delta,
      bestMoveSan,
      advice: `Très bon coup. ${bestMoveSan ? `Stockfish suggérait ${bestMoveSan}` : ''}.`,
    }
  }

  if (absDelta < 100) {
    return {
      classification: 'good',
      symbol: '',
      label: 'Bon coup',
      color: '#84cc16',
      evalBefore,
      evalAfter,
      evalDelta: delta,
      bestMoveSan,
      advice: `Bon coup. ${bestMoveSan ? `${bestMoveSan} était légèrement meilleur.` : ''}`,
    }
  }

  if (absDelta < 200) {
    return {
      classification: 'inaccuracy',
      symbol: '?!',
      label: 'Imprécision',
      color: '#eab308',
      evalBefore,
      evalAfter,
      evalDelta: delta,
      bestMoveSan,
      advice: `Imprécision. ${bestMoveSan ? `${bestMoveSan} était meilleur (+${(absDelta / 100).toFixed(1)} pion).` : ''}`,
    }
  }

  if (absDelta < 400) {
    return {
      classification: 'mistake',
      symbol: '?',
      label: 'Erreur',
      color: '#f97316',
      evalBefore,
      evalAfter,
      evalDelta: delta,
      bestMoveSan,
      advice: `Erreur. ${bestMoveSan ? `${bestMoveSan} était bien meilleur (+${(absDelta / 100).toFixed(1)} pions).` : ''}`,
    }
  }

  return {
    classification: 'blunder',
    symbol: '??',
    label: 'Gaffe',
    color: '#ef4444',
    evalBefore,
    evalAfter,
    evalDelta: delta,
    bestMoveSan,
    advice: `Gaffe ! ${bestMoveSan ? `${bestMoveSan} était la bonne option (+${(absDelta / 100).toFixed(1)} pions).` : ''} Réfléchis davantage avant de jouer.`,
  }
}

// Format evaluation for display
export function formatEvaluation(scoreCp: number | null, scoreMate: number | null): string {
  if (scoreMate !== null && scoreMate !== undefined) {
    return scoreMate > 0 ? `M${scoreMate}` : `-M${Math.abs(scoreMate)}`
  }
  if (scoreCp !== null && scoreCp !== undefined) {
    const pawns = scoreCp / 100
    return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1)
  }
  return '0.0'
}

// Get evaluation bar percentage (0-100, 50 = equal)
export function evalBarPercentage(scoreCp: number | null, scoreMate: number | null): number {
  if (scoreMate !== null && scoreMate !== undefined) {
    return scoreMate > 0 ? 100 : 0
  }
  if (scoreCp === null || scoreCp === undefined) return 50
  return cpToWinProb(scoreCp)
}
