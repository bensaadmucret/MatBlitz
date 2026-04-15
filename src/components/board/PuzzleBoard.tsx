import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square, type Move } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useTimer } from '../../hooks/useTimer'
import { formatTime } from '../../utils/format'
import { allPuzzles } from '../../data/index'
import type { Puzzle } from '../../types'

export function PuzzleBoard() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const gameRef = useRef(new Chess())
  const [moveIndex, setMoveIndex] = useState(0)
  const [status, setStatus] = useState<'playing' | 'solved' | 'failed'>('playing')
  const [attempts, setAttempts] = useState(0)
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Set<string>>(new Set())
  const [shakeBoard, setShakeBoard] = useState(false)
  const [showComboAnimation, setShowComboAnimation] = useState(false)
  const [hintArrow, setHintArrow] = useState<{ from: string; to: string } | null>(null)
  const puzzleRef = useRef(allPuzzles[0])
  
  const addResult = useGameStore(s => s.addResult)
  const currentCombo = useGameStore(s => s.currentCombo)
  const hintsUsed = useGameStore(s => s.hintsUsedForCurrentPuzzle)
  const incrementHints = useGameStore(s => s.incrementHints)
  const resetHints = useGameStore(s => s.resetHints)
  const timerMode = useGameStore(s => s.timerMode)
  const totalXp = useGameStore(s => s.totalXp)
  const setIsPlaying = useGameStore(s => s.setIsPlaying)
  
  const puzzle = allPuzzles[puzzleIndex % allPuzzles.length]

  // Sync puzzle ref in effect to avoid render-time ref writes
  useEffect(() => {
    puzzleRef.current = puzzle
  })

  // Log puzzle info on first render
  useEffect(() => {
    console.log('🧩 Puzzles:', allPuzzles.length, '| Current:', puzzle.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync isPlaying status with game state
  useEffect(() => {
    setIsPlaying(status === 'playing')
  }, [status, setIsPlaying])
  const { elapsedMs, timeRemaining: _timeRemaining, start, stop, reset: resetTimer, addTime } = useTimer(timerMode, puzzle.difficulty)
  // timeRemaining is used indirectly via useTimer's internal state for UI display
  void _timeRemaining
  
  // Get legal moves from a square
  const getLegalMoves = useCallback((square: string): Set<string> => {
    const game = gameRef.current
    const moves = game.moves({ square: square as Square, verbose: true }) as Move[]
    return new Set(moves.map(m => m.to))
  }, [])

  // Is this piece owned by the side to move?
  // pieceType format from react-chessboard: 'wP', 'bP', 'wQ', 'bK', etc.
  const isOwnPiece = useCallback((pieceType: string | null): boolean => {
    if (!pieceType || pieceType.length < 2) return false
    const currentTurn = gameRef.current.turn()
    const pieceColor = pieceType[0] // 'w' or 'b'
    return (currentTurn === 'w' && pieceColor === 'w') || (currentTurn === 'b' && pieceColor === 'b')
  }, [])

  // Handle square click — handles both piece selection and moves
  function handleSquareClick({ piece, square }: { piece: { pieceType: string; square?: string } | null; square: string }) {
    if (status !== 'playing') return

    if (selectedSquare) {
      // Same square → deselect
      if (square === selectedSquare) {
        setSelectedSquare(null)
        setLegalMoveSquares(new Set())
        return
      }

      // Legal move target → execute move (capture or empty square)
      if (legalMoveSquares.has(square)) {
        handleMove(selectedSquare as string, square)
        setSelectedSquare(null)
        setLegalMoveSquares(new Set())
        return
      }

      // Clicked on another piece
      if (piece?.pieceType) {
        const isOwn = isOwnPiece(piece.pieceType)
        if (isOwn) {
          // Switch to new own piece
          setSelectedSquare(square)
          setLegalMoveSquares(getLegalMoves(square))
        } else {
          // Clicked opponent piece but not legal → deselect
          setSelectedSquare(null)
          setLegalMoveSquares(new Set())
        }
        return
      }

      // Clicked empty square but not legal → deselect
      setSelectedSquare(null)
      setLegalMoveSquares(new Set())
    } else {
      // No selection yet → try to select own piece
      if (piece?.pieceType) {
        const isOwn = isOwnPiece(piece.pieceType)
        if (isOwn) {
          setSelectedSquare(square)
          setLegalMoveSquares(getLegalMoves(square))
        }
      }
    }
  }

  // Initialize puzzle
  const loadPuzzle = useCallback((p: Puzzle) => {
    try {
      const newGame = new Chess(p.fen)
      gameRef.current = newGame
      setFen(newGame.fen())
      setMoveIndex(0)
      setStatus('playing')
      setAttempts(0)
      setLastMove(null)
      setSelectedSquare(null)
      setLegalMoveSquares(new Set())
      setHintArrow(null)
      setBoardOrientation(p.sideToMove === 'white' ? 'white' : 'black')
      resetHints()
      resetTimer()
      setTimeout(() => start(), 300)

      // Check if player is already checkmated at puzzle start
      if (newGame.isCheckmate()) {
        setStatus('failed')
        stop()
        addResult({
          puzzleId: p.id,
          solved: false,
          timeMs: 0,
          hintsUsed: 0,
          attempts: 1,
          timestamp: Date.now(),
          comboBefore: currentCombo,
        })
      }
    } catch (e) {
      console.error('Invalid FEN:', p.fen, e)
    }
  }, [resetTimer, resetHints, start, stop, addResult, currentCombo])
  
  useEffect(() => {
    loadPuzzle(puzzle)
  }, [puzzleIndex]) // eslint-disable-line
  
  // Handle player move (internal)
  function handleMove(sourceSquare: string, targetSquare: string): boolean {
    if (status !== 'playing') return false
    
    const game = gameRef.current
    const currentPuzzle = puzzleRef.current
    
    const gameCopy = new Chess(game.fen())
    
    let move
    try {
      move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })
    } catch {
      return false
    }
    
    if (!move) return false
    
    const expectedMove = currentPuzzle.solution[moveIndex]
    const isCorrectMove = move.san === expectedMove
    
    if (isCorrectMove) {
      // Update game state
      gameRef.current = gameCopy
      setFen(gameCopy.fen())
      setLastMove({ from: sourceSquare, to: targetSquare })
      setHintArrow(null)
      
      const newMoveIndex = moveIndex + 1
      setMoveIndex(newMoveIndex)
      
      // Check if puzzle is complete
      if (newMoveIndex >= currentPuzzle.solution.length) {
        setStatus('solved')
        stop()
        setAttempts(prev => prev + 1)
        
        addResult({
          puzzleId: currentPuzzle.id,
          solved: true,
          timeMs: elapsedMs,
          hintsUsed,
          attempts: attempts + 1,
          timestamp: Date.now(),
          comboBefore: currentCombo,
        })
        
        if (timerMode === 'survival') {
          const bonusByDifficulty: Record<number, number> = { 1: 5000, 2: 8000, 3: 12000, 4: 15000, 5: 18000 }
          addTime(bonusByDifficulty[currentPuzzle.difficulty])
        }
        
        if (currentCombo > 0 && (currentCombo + 1) % 5 === 0) {
          setShowComboAnimation(true)
          setTimeout(() => setShowComboAnimation(false), 1500)
        }
        
        return true
      }
      
      // Play opponent's response automatically
      if (newMoveIndex < currentPuzzle.solution.length) {
        setTimeout(() => {
          const responseGame = new Chess(gameCopy.fen())
          try {
            const responseMove = currentPuzzle.solution[newMoveIndex]
            const responseResult = responseGame.move(responseMove)
            if (responseResult) {
              gameRef.current = responseGame
              setFen(responseGame.fen())
              setLastMove({ from: responseResult.from, to: responseResult.to })
              setMoveIndex(newMoveIndex + 1)

              // Check if player is checkmated after opponent's response
              if (responseGame.isCheckmate()) {
                setStatus('failed')
                stop()
                addResult({
                  puzzleId: currentPuzzle.id,
                  solved: false,
                  timeMs: elapsedMs,
                  hintsUsed,
                  attempts: attempts + 1,
                  timestamp: Date.now(),
                  comboBefore: currentCombo,
                })
              }
            }
          } catch (e) {
            console.error('Response move error:', e)
          }
        }, 400)
      }
      
      return true
    } else {
      // Wrong move — reject it
      setShakeBoard(true)
      setTimeout(() => setShakeBoard(false), 400)
      setAttempts(prev => prev + 1)

      // Check if player is checkmated after wrong move
      if (gameCopy.isCheckmate()) {
        setStatus('failed')
        stop()
        addResult({
          puzzleId: currentPuzzle.id,
          solved: false,
          timeMs: elapsedMs,
          hintsUsed,
          attempts: attempts + 1,
          timestamp: Date.now(),
          comboBefore: currentCombo,
        })
        return false
      }

      if (timerMode === 'blitz') {
        setStatus('failed')
        stop()
        addResult({
          puzzleId: currentPuzzle.id,
          solved: false,
          timeMs: elapsedMs,
          hintsUsed,
          attempts: attempts + 1,
          timestamp: Date.now(),
          comboBefore: currentCombo,
        })
      }

      return false
    }
  }
  
  const nextPuzzle = () => {
    setPuzzleIndex(prev => prev + 1)
  }
  
  const resetPuzzle = () => {
    loadPuzzle(puzzle)
  }

  // Wrapper for react-chessboard onPieceDrop
  function onPieceDrop({ sourceSquare, targetSquare }: { piece?: unknown; sourceSquare: string; targetSquare: string | null }): boolean {
    if (!targetSquare) return false
    return handleMove(sourceSquare, targetSquare)
  }

  const chessboardOptions = {
    position: fen,
    onPieceDrop,
    onSquareClick: handleSquareClick as ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => void,
    allowDragging: true,
    boardOrientation,
    customBoardStyle: {
      borderRadius: '8px',
      boxShadow: '0 0 30px rgba(124, 58, 237, 0.15)',
    },
    customDarkSquareStyle: { backgroundColor: '#2a2a4a' },
    customLightSquareStyle: { backgroundColor: '#3a3a5a' },
    customSquareStyles: {
      ...(lastMove ? {
        [lastMove.from]: { backgroundColor: 'rgba(168, 85, 247, 0.5)' },
        [lastMove.to]: { backgroundColor: 'rgba(168, 85, 247, 0.5)' },
      } : {}),
      ...(selectedSquare ? {
        [selectedSquare]: { backgroundColor: 'rgba(147, 51, 234, 0.7)', boxShadow: 'inset 0 0 15px rgba(192, 132, 252, 0.9)' } as React.CSSProperties,
      } : {}),
      ...Object.fromEntries(
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
      ),
    },
    areArrowsAllowed: true,
    customArrows: hintArrow ? [[hintArrow.from, hintArrow.to, 'rgba(250, 204, 21, 1)']] : [],
  }
  
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Puzzle info */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glass rounded-lg px-3 py-1.5 text-sm font-medium">
            {puzzle.category === 'mat-en-1' ? 'Mat en 1' : puzzle.category === 'mat-en-2' ? 'Mat en 2' : puzzle.category === 'mat-en-3' ? 'Mat en 3' : 'Mat en 4'}
          </span>
          <span className="text-text-muted text-sm">
            {puzzle.sideToMove === 'white' ? '♔ Blancs jouent' : '♚ Noirs jouent'}
          </span>
        </div>
        <span className="text-text-muted text-xs">#{puzzle.exerciseNumber}</span>
      </div>
      
      {/* Combo indicator */}
      {currentCombo > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-bold combo-gradient">Combo x{currentCombo}</span>
          {currentCombo >= 3 && (
            <span className="text-xs text-warning">
              (x{(1 + currentCombo * 0.2).toFixed(1)} XP)
            </span>
          )}
        </div>
      )}
      
      {/* Chess board */}
      <div className={`w-full ${shakeBoard ? 'animate-shake' : ''}`}>
        <div className="relative">
          <Chessboard options={chessboardOptions} />
          
          {/* Overlay for solved/failed */}
          <AnimatePresence>
            {status === 'solved' && (
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
                  <div className="text-6xl mb-2">✨</div>
                  <div className="text-2xl font-bold text-success mb-1">Résolu !</div>
                  <div className="text-sm text-text-secondary">{formatTime(elapsedMs)}</div>
                  {attempts === 1 && (
                    <div className="text-xs text-accent-secondary mt-1">Premier essai ! +50% XP</div>
                  )}
                </motion.div>
              </motion.div>
            )}
            {status === 'failed' && (
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
                  <div className="text-6xl mb-2">😔</div>
                  <div className="text-2xl font-bold text-danger mb-1">Raté...</div>
                  <div className="text-sm text-text-secondary">Essaie encore !</div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Combo flames animation */}
      <AnimatePresence>
        {showComboAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute text-8xl pointer-events-none"
          >
            🔥
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Action buttons */}
      <div className="w-full flex gap-3">
        {status === 'solved' ? (
          <button
            onClick={nextPuzzle}
            className="flex-1 py-3 rounded-xl bg-accent-primary hover:bg-accent-secondary text-white font-semibold transition-colors glow-accent"
          >
            Puzzle suivant →
          </button>
        ) : status === 'failed' ? (
          <>
            <button
              onClick={resetPuzzle}
              className="flex-1 py-3 rounded-xl glass glass-hover text-text-primary font-semibold transition-colors"
            >
              Réessayer
            </button>
            <button
              onClick={() => {
                // Replay with XP penalty
                useGameStore.getState().addXp(-50)
                resetPuzzle()
              }}
              className="flex-1 py-3 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white font-semibold transition-colors"
              title="Rejouer le puzzle (-50 XP)"
            >
              Rejouer ↺
            </button>
            <button
              onClick={nextPuzzle}
              className="flex-1 py-3 rounded-xl bg-bg-elevated hover:bg-bg-card text-text-secondary font-semibold transition-colors"
            >
              Passer →
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                incrementHints()
                // Show hint: highlight the piece that should move
                const currentPuzzle = puzzleRef.current
                const expectedMove = currentPuzzle.solution[moveIndex]
                console.log('Hint clicked - moveIndex:', moveIndex, 'expectedMove:', expectedMove)
                console.log('Available moves:', gameRef.current.moves({ verbose: true }).map((m: Move) => m.san))
                if (expectedMove) {
                  const game = gameRef.current
                  const moves = game.moves({ verbose: true })
                  const correctMove = moves.find((m: Move) => m.san === expectedMove)
                  console.log('Found correctMove:', correctMove)
                  if (correctMove) {
                    setHintArrow({ from: correctMove.from, to: correctMove.to })
                    console.log('Hint arrow set to:', correctMove.from, '->', correctMove.to)
                    // Clear hint after 2 seconds
                    setTimeout(() => setHintArrow(null), 2000)
                  } else {
                    console.log('No matching move found for:', expectedMove)
                  }
                }
              }}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-secondary text-sm transition-colors"
              title="Indice (réduit l'XP)"
            >
              💡 Indice
            </button>
            <button
              onClick={nextPuzzle}
              className="py-3 px-4 rounded-xl glass glass-hover text-text-muted text-sm transition-colors"
            >
              Passer →
            </button>
          </>
        )}
      </div>
      
      {/* XP counter */}
      <div className="flex items-center gap-2 text-text-muted text-xs">
        <span>⭐</span>
        <span>{totalXp} XP total</span>
      </div>
    </div>
  )
}
