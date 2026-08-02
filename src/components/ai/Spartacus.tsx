import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square, type Move } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useStockfish } from '../../hooks/useStockfish'
import { spartacusChallenges, type SpartacusChallenge } from '../../data/spartacus'
import { formatTime } from '../../utils/format'

export function Spartacus() {
  const [challengeIndex, setChallengeIndex] = useState(0)
  const [fen, setFen] = useState(spartacusChallenges[0].fen)
  const gameRef = useRef(new Chess(spartacusChallenges[0].fen))
  const [status, setStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [moveCount, setMoveCount] = useState(0)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Set<string>>(new Set())
  const [showHint, setShowHint] = useState(false)
  const [hintArrow, setHintArrow] = useState<[string, string] | null>(null)
  const [hintBestSan, setHintBestSan] = useState<string | null>(null)
  const hintUsedRef = useRef(false)
  const historyRef = useRef<{ fen: string; moveCount: number; lastMove: { from: string; to: string } | null }[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [wrongMove, setWrongMove] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [depth, setDepth] = useState(12)

  const addResult = useGameStore(s => s.addResult)
  const totalXp = useGameStore(s => s.totalXp)
  const currentCombo = useGameStore(s => s.currentCombo)

  const {
    isReady: sfReady,
    isThinking: sfThinking,
    requestMove: sfRequestMove,
    analyzePosition: sfAnalyze,
    stop: sfStop,
    newGame: sfNewGame,
    formatEval,
    evalPercent,
  } = useStockfish()

  const challenge = spartacusChallenges[challengeIndex]
  const playerColor: 'white' | 'black' = useMemo(() => {
    return new Chess(challenge.fen).turn() === 'w' ? 'white' : 'black'
  }, [challenge])

  // Timer
  useEffect(() => {
    if (status !== 'playing') return
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime)
    }, 100)
    return () => clearInterval(interval)
  }, [status, startTime])

  const getLegalMoves = useCallback((square: string): Set<string> => {
    const game = gameRef.current
    const moves = game.moves({ square: square as Square, verbose: true }) as Move[]
    return new Set(moves.map(m => m.to))
  }, [])

  const isOwnPiece = useCallback((pieceType: string | null): boolean => {
    if (!pieceType || pieceType.length < 2) return false
    const pieceColor = pieceType[0] // 'w' or 'b'
    return (pieceColor === 'w') === (playerColor === 'white')
  }, [playerColor])

  const checkGameEnd = useCallback((game: Chess): 'playing' | 'won' | 'lost' | 'draw' => {
    if (game.isCheckmate()) {
      const isPlayerTurn = (game.turn() === 'w') === (playerColor === 'white')
      return isPlayerTurn ? 'lost' : 'won'
    }
    if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
      return 'draw'
    }
    return 'playing'
  }, [playerColor])

  // Apply AI move from Stockfish
  const makeAIMove = useCallback((uci: string) => {
    if (!uci) return
    const game = gameRef.current
    const aiGame = new Chess(game.fen())

    try {
      const aiMove = aiGame.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: uci.length === 5 ? uci[4] : 'q',
      })

      if (aiMove) {
        gameRef.current = aiGame
        setFen(aiGame.fen())
        setLastMove({ from: aiMove.from, to: aiMove.to })

        const result = checkGameEnd(aiGame)
        if (result !== 'playing') {
          setStatus(result)
          addResult({
            puzzleId: `spartacus-${challenge.id}`,
            solved: result === 'won',
            timeMs: Date.now() - startTime,
            hintsUsed: hintUsedRef.current ? 1 : 0,
            attempts: 1,
            timestamp: Date.now(),
            comboBefore: currentCombo,
            difficulty: challenge.difficulty,
          })
        }
      }
    } catch (err) {
      console.error('Spartacus AI move error:', err)
    }
  }, [checkGameEnd, addResult, startTime, currentCombo, challenge])

  // Load challenge
  const loadChallenge = useCallback((c: SpartacusChallenge) => {
    const game = new Chess(c.fen)
    gameRef.current = game
    setFen(game.fen())
    setStatus('playing')
    setMoveCount(0)
    setLastMove(null)
    setSelectedSquare(null)
    setLegalMoveSquares(new Set())
    setShowHint(false)
    setHintArrow(null)
    setHintBestSan(null)
    hintUsedRef.current = false
    historyRef.current = []
    setCanUndo(false)
    setWrongMove(false)
    setStartTime(Date.now())
    setElapsedMs(0)
    sfNewGame()

    // If it's AI's turn first, request move
    const isPlayerTurn = (game.turn() === 'w') === (playerColor === 'white')
    if (!isPlayerTurn) {
      sfRequestMove(game.fen(), depth, makeAIMove)
    }
  }, [depth, sfNewGame, sfRequestMove, playerColor, makeAIMove])

  useEffect(() => {
    if (sfReady) {
      loadChallenge(challenge)
    }
  }, [challengeIndex, sfReady]) // eslint-disable-line

  const handleMove = useCallback((from: string, to: string): boolean => {
    if (status !== 'playing' || sfThinking || aiThinking) return false

    const game = gameRef.current
    const isPlayerTurn = (game.turn() === 'w') === (playerColor === 'white')
    if (!isPlayerTurn) return false

    const gameCopy = new Chess(game.fen())

    let move
    try {
      move = gameCopy.move({ from: from as Square, to: to as Square, promotion: 'q' })
    } catch {
      return false
    }

    if (!move) return false

    // For win challenges, only accept the solution move while scripted line lasts
    if (challenge.goal === 'win' && challenge.solution && moveCount < challenge.solution.length) {
      const playerUci = `${from}${to}`
      const expectedMove = challenge.solution[moveCount]
      if (playerUci !== expectedMove) {
        setWrongMove(true)
        setTimeout(() => setWrongMove(false), 1500)
        return false
      }
    }

    gameRef.current = gameCopy
    setFen(gameCopy.fen())
    setLastMove({ from: move.from, to: move.to })
    setSelectedSquare(null)
    setLegalMoveSquares(new Set())
    if (showHint) hintUsedRef.current = true
    setShowHint(false)
    setHintArrow(null)
    setHintBestSan(null)

    // Save snapshot for undo (before applying the move)
    historyRef.current.push({ fen: game.fen(), moveCount, lastMove })
    setCanUndo(true)

    const newMoveCount = moveCount + 1
    setMoveCount(newMoveCount)

    const result = checkGameEnd(gameCopy)
    if (result !== 'playing') {
      setStatus(result)
      addResult({
        puzzleId: `spartacus-${challenge.id}`,
        solved: result === 'won',
        timeMs: Date.now() - startTime,
        hintsUsed: hintUsedRef.current ? 1 : 0,
        attempts: 1,
        timestamp: Date.now(),
        comboBefore: currentCombo,
        difficulty: challenge.difficulty,
      })
      return true
    }

    if (newMoveCount >= challenge.maxMoves) {
      // Survive goal: reaching the limit alive = victory
      const finalStatus = challenge.goal === 'survive' ? 'won' : 'draw'
      setStatus(finalStatus)
      addResult({
        puzzleId: `spartacus-${challenge.id}`,
        solved: finalStatus === 'won',
        timeMs: Date.now() - startTime,
        hintsUsed: hintUsedRef.current ? 1 : 0,
        attempts: 1,
        timestamp: Date.now(),
        comboBefore: currentCombo,
        difficulty: challenge.difficulty,
      })
      return true
    }

    if (challenge.goal === 'win' && challenge.solution && newMoveCount === challenge.solution.length) {
      // Player completed the winning trap sequence
      setStatus('won')
      addResult({
        puzzleId: `spartacus-${challenge.id}`,
        solved: true,
        timeMs: Date.now() - startTime,
        hintsUsed: hintUsedRef.current ? 1 : 0,
        attempts: 1,
        timestamp: Date.now(),
        comboBefore: currentCombo,
        difficulty: challenge.difficulty,
      })
      return true
    }

    // Determine AI response: scripted trap move or Stockfish
    const aiScriptedMove = challenge.aiMoves?.[moveCount]

    if (aiScriptedMove) {
      // Play scripted trap response after a short delay
      setAiThinking(true)
      setTimeout(() => {
        makeAIMove(aiScriptedMove)
        setAiThinking(false)
      }, 400)
    } else if (challenge.goal === 'win') {
      // After scripted line ends, weak Stockfish for win challenges
      sfRequestMove(gameCopy.fen(), 3, makeAIMove)
    } else {
      // Normal Stockfish for survive challenges
      sfRequestMove(gameCopy.fen(), depth, makeAIMove)
    }

    return true
  }, [status, sfThinking, aiThinking, playerColor, moveCount, challenge, checkGameEnd, addResult, startTime, showHint, currentCombo, depth, sfRequestMove, makeAIMove, lastMove])

  const handleSquareClick = useCallback(({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
    if (status !== 'playing' || sfThinking || aiThinking) return

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null)
        setLegalMoveSquares(new Set())
        return
      }
      if (legalMoveSquares.has(square)) {
        handleMove(selectedSquare, square)
        return
      }
      if (piece?.pieceType && isOwnPiece(piece.pieceType)) {
        setSelectedSquare(square)
        setLegalMoveSquares(getLegalMoves(square))
        return
      }
      setSelectedSquare(null)
      setLegalMoveSquares(new Set())
    } else {
      if (piece?.pieceType && isOwnPiece(piece.pieceType)) {
        setSelectedSquare(square)
        setLegalMoveSquares(getLegalMoves(square))
      }
    }
  }, [status, sfThinking, aiThinking, selectedSquare, legalMoveSquares, handleMove, isOwnPiece, getLegalMoves])

  const handleUndo = useCallback(() => {
    if (status !== 'playing') return
    const snapshot = historyRef.current.pop()
    if (!snapshot) return

    sfStop()
    const game = new Chess(snapshot.fen)
    gameRef.current = game
    setFen(game.fen())
    setMoveCount(snapshot.moveCount)
    setLastMove(snapshot.lastMove)
    setSelectedSquare(null)
    setLegalMoveSquares(new Set())
    setShowHint(false)
    setHintArrow(null)
    setHintBestSan(null)
    setCanUndo(historyRef.current.length > 0)
  }, [status, sfStop])

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!targetSquare) return false
    return handleMove(sourceSquare, targetSquare)
  }, [handleMove])

  // Show hint: use solution move for win challenges, Stockfish for survive
  const toggleHint = useCallback(() => {
    if (showHint) {
      setShowHint(false)
      setHintArrow(null)
      setHintBestSan(null)
      return
    }

    setShowHint(true)
    setHintArrow(null)
    setHintBestSan(null)

    // For win challenges, show the scripted solution move
    if (challenge.goal === 'win' && challenge.solution && moveCount < challenge.solution.length) {
      const solutionUci = challenge.solution[moveCount]
      if (solutionUci.length >= 4) {
        setHintArrow([solutionUci.slice(0, 2), solutionUci.slice(2, 4)])
        // Convert to SAN for display
        try {
          const gameCopy = new Chess(gameRef.current.fen())
          const solMove = gameCopy.move({
            from: solutionUci.slice(0, 2) as Square,
            to: solutionUci.slice(2, 4) as Square,
            promotion: solutionUci.length === 5 ? (solutionUci[4] as 'q' | 'r' | 'b' | 'n') : 'q',
          })
          if (solMove) setHintBestSan(solMove.san)
        } catch { /* ignore invalid move */ }
      }
      return
    }

    // For survive challenges, analyze with Stockfish
    if (!sfReady || sfThinking) return

    const fenAtRequest = gameRef.current.fen()
    sfAnalyze(fenAtRequest, Math.min(depth, 14)).then(result => {
      // Ignore stale result if the position changed while analyzing
      if (gameRef.current.fen() !== fenAtRequest) return
      if (result.bestMove && result.bestMove.length >= 4) {
        setHintArrow([result.bestMove.slice(0, 2), result.bestMove.slice(2, 4)])
        if (result.bestMoveSan) setHintBestSan(result.bestMoveSan)
      }
    }).catch(() => {})
  }, [showHint, sfReady, sfThinking, sfAnalyze, depth, challenge, moveCount])

  const chessboardOptions = useMemo(() => ({
    position: fen,
    onPieceDrop,
    onSquareClick: handleSquareClick as ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => void,
    allowDragging: true,
    boardOrientation: playerColor,
    customBoardStyle: {
      borderRadius: '8px',
      boxShadow: '0 0 30px rgba(220, 38, 38, 0.15)',
    },
    customDarkSquareStyle: { backgroundColor: '#2a2a4a' },
    customLightSquareStyle: { backgroundColor: '#3a3a5a' },
    customSquareStyles: {
      ...(lastMove ? {
        [lastMove.from]: { backgroundColor: 'rgba(220, 38, 38, 0.4)' },
        [lastMove.to]: { backgroundColor: 'rgba(220, 38, 38, 0.4)' },
      } : {}),
      ...(selectedSquare ? {
        [selectedSquare]: { backgroundColor: 'rgba(147, 51, 234, 0.7)', boxShadow: 'inset 0 0 15px rgba(192, 132, 252, 0.9)' } as React.CSSProperties,
      } : {}),
      ...Object.fromEntries(
        /* eslint-disable react-hooks/refs */
        [...legalMoveSquares].map(sq => {
          // gameRef is read here for square highlight styling;
          // this is intentional — the board re-renders when legalMoveSquares changes
          const hasPiece = gameRef.current.get(sq as Square) !== null
          return [sq, {
            background: hasPiece
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.6) 30%, rgba(239, 68, 68, 0.3) 70%)'
              : 'radial-gradient(circle, rgba(168, 85, 247, 0.9) 20%, transparent 25%)',
            ...(hasPiece ? { borderRadius: '50%', boxShadow: 'inset 0 0 12px rgba(239, 68, 68, 0.8)' } : {}),
          }]
        })
        /* eslint-enable react-hooks/refs */
      ),
    },
    allowDrawingArrows: true,
    arrows: showHint && hintArrow
      ? [{ startSquare: hintArrow[0], endSquare: hintArrow[1], color: 'rgba(255, 170, 0, 0.8)' }]
      : [],
  }), [fen, onPieceDrop, handleSquareClick, playerColor, lastMove, selectedSquare, legalMoveSquares, showHint, hintArrow])

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Challenge info */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glass rounded-lg px-3 py-1.5 text-sm font-medium text-red-400">
            ⚔️ Spartacus
          </span>
          <span className="text-text-muted text-sm">
            {challenge.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">Prof.</span>
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            className="glass rounded-lg px-2 py-1 text-xs text-text-primary border-none outline-none"
          >
            <option value={8}>8 (rapide)</option>
            <option value={12}>12 (équilibré)</option>
            <option value={15}>15 (profond)</option>
            <option value={18}>18 (max)</option>
          </select>
        </div>
      </div>

      {/* Stockfish loading */}
      {!sfReady && (
        <div className="w-full text-center py-2 px-4 rounded-lg bg-blue-500/20 border border-blue-500/50 text-blue-400 text-sm">
          ⏳ Chargement de Stockfish... (~7MB)
        </div>
      )}

      {/* Challenge description */}
      <div className="w-full glass rounded-xl p-3">
        <p className="text-sm text-text-secondary">{challenge.description}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
          <span>🎯 Objectif: {challenge.goal === 'win' ? 'Gagner' : challenge.goal === 'draw' ? 'Nulle' : 'Survivre'}</span>
          <span>📊 Difficulté: {challenge.difficulty}/5</span>
          <span>♟️ {moveCount}/{challenge.maxMoves} coups</span>
        </div>
      </div>

      {/* Evaluation bar */}
      <div className="w-full flex items-center gap-2">
        <span className="text-xs text-text-muted w-12">Éval</span>
        <div className="flex-1 h-3 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${evalPercent()}%`,
              background: 'linear-gradient(to right, #3b82f6, #60a5fa)',
            }}
          />
        </div>
        <span className="text-xs text-text-muted w-12 text-right font-mono">
          {formatEval()}
        </span>
      </div>

      {/* Hint */}
      {showHint && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center py-2 px-4 rounded-lg bg-warning/20 border border-warning/50 text-warning font-medium text-sm"
        >
          💡 {challenge.hint}
          {hintBestSan && (
            <div className="mt-1 font-bold">🎯 Coup conseillé : {hintBestSan}</div>
          )}
        </motion.div>
      )}

      {/* Chess board */}
      <div className="w-full relative">
        <Chessboard options={chessboardOptions} />

        {/* Thinking indicator */}
        <AnimatePresence>
          {(sfThinking || aiThinking) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 right-2 glass rounded-lg px-3 py-1.5 text-xs text-accent-secondary flex items-center gap-2 z-20"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⚙️
              </motion.span>
              Stockfish...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wrong move feedback */}
        <AnimatePresence>
          {wrongMove && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-2 left-2 glass rounded-lg px-3 py-1.5 text-xs text-red-400 z-20"
            >
              ✗ Mauvais coup — suis la ligne de la solution !
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay for results */}
        <AnimatePresence>
          {status === 'won' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="text-6xl mb-2">🏆</div>
                <div className="text-2xl font-bold text-success mb-1">Victoire !</div>
                <div className="text-sm text-text-secondary">{formatTime(elapsedMs)}</div>
              </motion.div>
            </motion.div>
          )}
          {status === 'lost' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="text-6xl mb-2">💀</div>
                <div className="text-2xl font-bold text-danger mb-1">Défaite...</div>
                <div className="text-sm text-text-secondary">Réessaie !</div>
              </motion.div>
            </motion.div>
          )}
          {status === 'draw' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="text-6xl mb-2">🤝</div>
                <div className="text-2xl font-bold text-warning mb-1">Nulle</div>
                <div className="text-sm text-text-secondary">Limite de coups atteinte</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="w-full flex gap-3">
        {status === 'playing' ? (
          <>
            <button
              onClick={toggleHint}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-secondary text-sm transition-colors"
            >
              💡 Indice
            </button>
            <button
              onClick={handleUndo}
              disabled={!canUndo || sfThinking || aiThinking}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-muted text-sm transition-colors disabled:opacity-40"
            >
              ↶ Annuler
            </button>
            <button
              onClick={() => loadChallenge(challenge)}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-muted text-sm transition-colors"
            >
              ↺ Recommencer
            </button>
            <button
              onClick={() => setChallengeIndex(prev => (prev + 1) % spartacusChallenges.length)}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-muted text-sm transition-colors"
            >
              Passer →
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => loadChallenge(challenge)}
              className="flex-1 py-3 rounded-xl glass glass-hover text-text-primary font-semibold transition-colors"
            >
              Réessayer
            </button>
            <button
              onClick={() => setChallengeIndex(prev => (prev + 1) % spartacusChallenges.length)}
              className="flex-1 py-3 rounded-xl bg-accent-primary hover:bg-accent-secondary text-white font-semibold transition-colors glow-accent"
            >
              Défi suivant →
            </button>
          </>
        )}
      </div>

      {/* Progress */}
      <div className="w-full flex items-center justify-between text-xs text-text-muted">
        <span>Défi {challengeIndex + 1}/{spartacusChallenges.length}</span>
        <span>⭐ {totalXp} XP</span>
      </div>
    </div>
  )
}
