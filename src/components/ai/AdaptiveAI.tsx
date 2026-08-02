import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square, type Move } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useStockfish } from '../../hooks/useStockfish'
import { formatTime } from '../../utils/format'
import type { MoveCoaching } from '../../utils/chessCoaching'

interface GameMove {
  san: string
  fen: string
  fenBefore: string
  from: string
  to: string
  isCapture: boolean
  isCheck: boolean
  coaching: MoveCoaching | null
}

export function AdaptiveAI() {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const gameRef = useRef(new Chess())
  const [status, setStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([])
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [coaching, setCoaching] = useState<MoveCoaching | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [depth, setDepth] = useState(12)
  const [hintArrow, setHintArrow] = useState<[string, string] | null>(null)
  const [hintText, setHintText] = useState<string | null>(null)
  const [isHinting, setIsHinting] = useState(false)

  const addResult = useGameStore(s => s.addResult)
  const totalXp = useGameStore(s => s.totalXp)
  const currentCombo = useGameStore(s => s.currentCombo)

  const {
    isReady: sfReady,
    isThinking: sfThinking,
    requestMove: sfRequestMove,
    analyzePosition: sfAnalyzePosition,
    getCoaching: sfGetCoaching,
    stop: sfStop,
    newGame: sfNewGame,
    formatEval,
    evalPercent,
  } = useStockfish()

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

        // Record AI move in history
        setMoveHistory(prev => [...prev, {
          san: aiMove.san,
          fen: aiGame.fen(),
          fenBefore: game.fen(),
          from: aiMove.from,
          to: aiMove.to,
          isCapture: !!aiMove.captured,
          isCheck: aiGame.inCheck(),
          coaching: null,
        }])

        const result = checkGameEnd(aiGame)
        if (result !== 'playing') {
          setStatus(result)
          addResult({
            puzzleId: `adaptive-${Date.now()}`,
            solved: result === 'won',
            timeMs: Date.now() - startTime,
            hintsUsed: 0,
            attempts: 1,
            timestamp: Date.now(),
            comboBefore: currentCombo,
            difficulty: depth,
          })
        }
      }
    } catch (err) {
      console.error('AI move error:', err)
    }
  }, [checkGameEnd, addResult, startTime, currentCombo, depth])

  // Start new game
  const startNewGame = useCallback((color: 'white' | 'black') => {
    const game = new Chess()
    gameRef.current = game
    setFen(game.fen())
    setStatus('playing')
    setLastMove(null)
    setSelectedSquare(null)
    setLegalMoveSquares(new Set())
    setHintArrow(null)
    setHintText(null)
    setCoaching(null)
    setShowAnalysis(false)
    setPlayerColor(color)
    setStartTime(Date.now())
    setElapsedMs(0)
    setMoveHistory([])
    sfNewGame()

    if (color === 'black') {
      sfRequestMove(game.fen(), depth, makeAIMove)
    }
  }, [depth, sfNewGame, sfRequestMove, makeAIMove])

  // Auto-start when Stockfish is ready
  useEffect(() => {
    if (sfReady && moveHistory.length === 0 && status === 'playing') {
      startNewGame('white')
    }
  }, [sfReady]) // eslint-disable-line

  // Handle player move
  const handleMove = useCallback((from: string, to: string): boolean => {
    if (status !== 'playing' || sfThinking) return false

    const game = gameRef.current
    const isPlayerTurn = (game.turn() === 'w') === (playerColor === 'white')
    if (!isPlayerTurn) return false

    const fenBefore = game.fen()
    const gameCopy = new Chess(fenBefore)

    let move
    try {
      move = gameCopy.move({ from: from as Square, to: to as Square, promotion: 'q' })
    } catch {
      return false
    }

    if (!move) return false

    gameRef.current = gameCopy
    setFen(gameCopy.fen())
    setLastMove({ from: move.from, to: move.to })
    setSelectedSquare(null)
    setLegalMoveSquares(new Set())

    // Store move in history (coaching deferred to end-of-game analysis)
    setMoveHistory(prev => [...prev, {
      san: move.san,
      fen: gameCopy.fen(),
      fenBefore,
      from,
      to,
      isCapture: !!move.captured,
      isCheck: gameCopy.inCheck(),
      coaching: null,
    }])

    const result = checkGameEnd(gameCopy)
    if (result !== 'playing') {
      setStatus(result)
      addResult({
        puzzleId: `adaptive-${Date.now()}`,
        solved: result === 'won',
        timeMs: Date.now() - startTime,
        hintsUsed: 0,
        attempts: 1,
        timestamp: Date.now(),
        comboBefore: currentCombo,
        difficulty: depth,
      })
      return true
    }

    // Request AI move — Stockfish calls onResult with the best move
    sfRequestMove(gameCopy.fen(), depth, makeAIMove)

    return true
  }, [status, sfThinking, playerColor, checkGameEnd, addResult, startTime, currentCombo, depth, sfRequestMove, makeAIMove])

  const handleSquareClick = useCallback(({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
    if (status !== 'playing' || sfThinking) return

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
  }, [status, sfThinking, selectedSquare, legalMoveSquares, handleMove, isOwnPiece, getLegalMoves])

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!targetSquare) return false
    return handleMove(sourceSquare, targetSquare)
  }, [handleMove])

  const chessboardOptions = useMemo(() => ({
    position: fen,
    onPieceDrop,
    onSquareClick: handleSquareClick as ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => void,
    allowDragging: true,
    boardOrientation: playerColor,
    customBoardStyle: {
      borderRadius: '8px',
      boxShadow: '0 0 30px rgba(59, 130, 246, 0.15)',
    },
    customDarkSquareStyle: { backgroundColor: '#2a2a4a' },
    customLightSquareStyle: { backgroundColor: '#3a3a5a' },
    customSquareStyles: {
      ...(lastMove ? {
        [lastMove.from]: { backgroundColor: 'rgba(59, 130, 246, 0.4)' },
        [lastMove.to]: { backgroundColor: 'rgba(59, 130, 246, 0.4)' },
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
    arrows: hintArrow ? [{ startSquare: hintArrow[0], endSquare: hintArrow[1], color: 'rgba(255, 170, 0, 0.8)' }] : [],
  }), [fen, onPieceDrop, handleSquareClick, playerColor, lastMove, selectedSquare, legalMoveSquares, hintArrow])

  // Undo last full turn (player move + AI move)
  const undoMove = useCallback(() => {
    if (sfThinking || moveHistory.length === 0) return

    // Stop any pending Stockfish search to prevent stale callbacks
    sfStop()

    // Remove last 2 moves (AI response + player move), or 1 if only one exists
    const removeCount = Math.min(2, moveHistory.length)
    const keptHistory = moveHistory.slice(0, -removeCount)

    // Rebuild game from the remaining history
    const newGame = new Chess()
    for (const m of keptHistory) {
      newGame.move({ from: m.from as Square, to: m.to as Square, promotion: 'q' })
    }

    gameRef.current = newGame
    setFen(newGame.fen())
    setMoveHistory(keptHistory)
    setStatus('playing')
    setSelectedSquare(null)
    setLegalMoveSquares(new Set())
    setHintArrow(null)
    setHintText(null)
    setCoaching(null)

    // Set lastMove to the previous move if any
    if (keptHistory.length > 0) {
      const last = keptHistory[keptHistory.length - 1]
      setLastMove({ from: last.from, to: last.to })
    } else {
      setLastMove(null)
    }

    // If it's now AI's turn (e.g., black player undid to initial position), request AI move
    const isPlayerTurn = (newGame.turn() === 'w') === (playerColor === 'white')
    if (!isPlayerTurn) {
      sfRequestMove(newGame.fen(), depth, makeAIMove)
    }
  }, [sfThinking, moveHistory, playerColor, depth, sfRequestMove, sfStop, makeAIMove])

  // Show hint: analyze current position and display best move with explanation
  const showHint = useCallback(async () => {
    if (sfThinking || isHinting) return
    const game = gameRef.current
    const isPlayerTurn = (game.turn() === 'w') === (playerColor === 'white')
    if (!isPlayerTurn) return

    setIsHinting(true)
    setHintArrow(null)
    setHintText(null)

    try {
      const result = await sfAnalyzePosition(game.fen(), Math.min(depth, 14))
      if (result.bestMove && result.bestMove !== '(none)') {
        const from = result.bestMove.slice(0, 2)
        const to = result.bestMove.slice(2, 4)
        setHintArrow([from, to])

        // Analyze the move with chess.js to detect tactical motifs
        const analysisGame = new Chess(game.fen())
        const move = analysisGame.move({
          from: from as Square,
          to: to as Square,
          promotion: result.bestMove.length === 5 ? result.bestMove[4] : 'q',
        })

        const reasons: string[] = []

        if (move) {
          // Check / mate
          if (analysisGame.isCheckmate()) {
            reasons.push('Échec et mat !')
          } else if (analysisGame.inCheck()) {
            reasons.push('Mets le roi adverse en échec')
          }

          // Capture
          if (move.captured) {
            const pieceNames: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' }
            reasons.push(`Capture un ${pieceNames[move.captured] || 'pièce'}`)
          }

          // Promotion
          if (move.promotion) {
            reasons.push('Promotion en dame')
          }

          // Castle
          if (move.san.includes('O-O-O')) {
            reasons.push('Grand roque : met le roi en sécurité et active la tour')
          } else if (move.san.includes('O-O')) {
            reasons.push('Petit roque : met le roi en sécurité et active la tour')
          }

          // Center control
          const centerSquares = ['d4', 'd5', 'e4', 'e5']
          if (centerSquares.includes(to)) {
            reasons.push('Contrôle une case centrale stratégique')
          }

          // Development (minor piece to active square in opening)
          const pieceType = move.piece
          const isOpening = analysisGame.history().length <= 12
          if (isOpening && (pieceType === 'n' || pieceType === 'b')) {
            reasons.push(`Développe le ${pieceType === 'n' ? 'cavalier' : 'fou'} vers une case active`)
          }

          // Attack on a piece (the moved piece attacks an enemy piece)
          const attacks = analysisGame.moves({ square: to as Square, verbose: true }) as Move[]
          const attackedPieces = new Set<string>()
          for (const a of attacks) {
            if (a.captured) {
              const pieceNames: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' }
              attackedPieces.add(pieceNames[a.captured] || 'pièce')
            }
          }
          if (attackedPieces.size > 0 && !move.captured) {
            reasons.push(`Attaque ${[...attackedPieces].join(' et ')}`)
          }

          // Discovered attack / pin detection (simplified)
          if (move.san.includes('+') && !analysisGame.isCheckmate()) {
            // Already covered by check
          }
        }

        // Evaluation context
        const evalStr = result.scoreMate !== null
          ? `Évaluation : mat en ${Math.abs(result.scoreMate)}`
          : result.scoreCp !== null
            ? `Évaluation : ${(result.scoreCp / 100).toFixed(1)} pions`
            : ''

        // Principal variation (first 3-4 moves)
        const pvStr = result.pvSan.length > 0
          ? result.pvSan.slice(0, 4).join(' ')
          : ''

        // Build full explanation
        let explanation = `Meilleur coup : ${result.bestMoveSan}`
        if (reasons.length > 0) {
          explanation += ` — ${reasons.join(', ')}`
        }
        if (evalStr) {
          explanation += ` | ${evalStr}`
        }
        if (pvStr) {
          explanation += ` | Ligne principale : ${pvStr}`
        }

        setHintText(explanation)
      }
    } catch {
      // Ignore
    }
    setIsHinting(false)
  }, [sfThinking, isHinting, playerColor, sfAnalyzePosition, depth])

  // Run post-game analysis: sequentially analyze each player move
  const runAnalysis = useCallback(async () => {
    setShowAnalysis(true)
    setIsAnalyzing(true)

    // Identify player move indices (0-based in moveHistory)
    const playerIndices: number[] = []
    for (let i = 0; i < moveHistory.length; i++) {
      const isPlayerMove = playerColor === 'white' ? i % 2 === 0 : i % 2 === 1
      if (isPlayerMove) playerIndices.push(i)
    }

    // Analyze each player move sequentially (worker handles one at a time)
    for (const idx of playerIndices) {
      const m = moveHistory[idx]
      if (!m) continue
      try {
        const c = await sfGetCoaching(m.fenBefore, { from: m.from, to: m.to }, m.isCheck)
        setMoveHistory(prev => prev.map((mv, i) => i === idx ? { ...mv, coaching: c } : mv))
      } catch {
        // Skip on error
      }
    }

    setIsAnalyzing(false)
  }, [moveHistory, playerColor, sfGetCoaching])

  // Compute accuracy
  const accuracy = useMemo(() => {
    const playerMoves = moveHistory.filter((_, i) => {
      return playerColor === 'white' ? i % 2 === 0 : i % 2 === 1
    })
    if (playerMoves.length === 0) return null
    const goodMoves = playerMoves.filter(m => m.coaching && ['best', 'great', 'good', 'brilliant'].includes(m.coaching.classification))
    return Math.round((goodMoves.length / playerMoves.length) * 100)
  }, [moveHistory, playerColor])

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glass rounded-lg px-3 py-1.5 text-sm font-medium text-blue-400">
            🧠 IA Stockfish
          </span>
          <span className="text-text-muted text-sm">
            {playerColor === 'white' ? '♔ Blancs' : '♚ Noirs'}
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

      {/* Hint display */}
      <AnimatePresence>
        {hintText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full text-center py-2 px-4 rounded-lg bg-warning/20 border border-warning/50 text-warning font-medium text-sm"
          >
            💡 {hintText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coaching panel */}
      <AnimatePresence>
        {coaching && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full rounded-xl p-3 border"
            style={{
              backgroundColor: `${coaching.color}15`,
              borderColor: `${coaching.color}50`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm" style={{ color: coaching.color }}>
                {coaching.symbol && `${coaching.symbol} `}
                {coaching.label}
              </span>
              {coaching.evalDelta !== null && (
                <span className="text-xs text-text-muted">
                  Δ {(Math.abs(coaching.evalDelta) / 100).toFixed(1)} pions
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary">{coaching.advice}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move history */}
      {moveHistory.length > 0 && (
        <div className="w-full glass rounded-xl p-2 max-h-20 overflow-y-auto">
          <div className="flex flex-wrap gap-1 text-xs">
            {moveHistory.map((m, i) => (
              <span
                key={i}
                className="cursor-pointer"
                style={m.coaching ? { color: m.coaching.color } : undefined}
                title={m.coaching?.label}
              >
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''} {m.san}
                {m.coaching?.symbol && ` ${m.coaching.symbol}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chess board */}
      <div className="w-full relative">
        <Chessboard options={chessboardOptions} />

        {/* Thinking indicator */}
        <AnimatePresence>
          {sfThinking && (
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
                {accuracy !== null && (
                  <div className="text-sm text-accent-secondary mt-1">Précision : {accuracy}%</div>
                )}
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
                <div className="text-sm text-text-secondary">Analyse tes erreurs !</div>
                {accuracy !== null && (
                  <div className="text-sm text-accent-secondary mt-1">Précision : {accuracy}%</div>
                )}
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
              onClick={showHint}
              disabled={isHinting || sfThinking}
              className="py-3 px-4 rounded-xl glass glass-hover text-warning text-sm transition-colors disabled:opacity-50"
            >
              {isHinting ? '⏳...' : '💡 Conseil'}
            </button>
            <button
              onClick={undoMove}
              disabled={sfThinking || moveHistory.length === 0}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-secondary text-sm transition-colors disabled:opacity-50"
            >
              ↶ Annuler
            </button>
            <button
              onClick={() => startNewGame(playerColor === 'white' ? 'black' : 'white')}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-secondary text-sm transition-colors"
            >
              ⇄ Côté
            </button>
            <button
              onClick={() => startNewGame(playerColor)}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-muted text-sm transition-colors"
            >
              ↺ Nouv.
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => runAnalysis()}
              disabled={isAnalyzing}
              className="flex-1 py-3 rounded-xl glass glass-hover text-text-primary font-semibold transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? '⏳ Analyse...' : '📊 Analyser'}
            </button>
            <button
              onClick={() => startNewGame(playerColor)}
              className="flex-1 py-3 rounded-xl bg-accent-primary hover:bg-accent-secondary text-white font-semibold transition-colors glow-accent"
            >
              Revanche →
            </button>
          </>
        )}
      </div>

      {/* Analysis panel */}
      <AnimatePresence>
        {showAnalysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full glass rounded-xl p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text-primary text-sm">📊 Analyse de la partie</h4>
              {accuracy !== null && (
                <span className="text-sm font-bold text-accent-secondary">Précision : {accuracy}%</span>
              )}
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {moveHistory.filter(m => m.coaching && !['best', 'good'].includes(m.coaching.classification)).map((m, i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <span style={{ color: m.coaching!.color }} className="font-medium">
                    {m.coaching!.symbol} {m.san}
                  </span>
                  <span className="text-text-muted">{m.coaching!.label}</span>
                  {m.coaching!.bestMoveSan && (
                    <span className="text-text-secondary">→ {m.coaching!.bestMoveSan} était meilleur</span>
                  )}
                </div>
              ))}
              {moveHistory.filter(m => m.coaching && !['best', 'good'].includes(m.coaching.classification)).length === 0 && (
                <p className="text-xs text-success">Aucune erreur détectée. Excellent ! 🎉</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP */}
      <div className="flex items-center gap-2 text-text-muted text-xs">
        <span>⭐</span>
        <span>{totalXp} XP total</span>
      </div>
    </div>
  )
}
