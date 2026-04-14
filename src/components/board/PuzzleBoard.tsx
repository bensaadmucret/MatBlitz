import { useEffect, useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useTimer } from '../../hooks/useTimer'
import { formatTime } from '../../utils/format'
import { puzzles } from '../../data/puzzles'
import type { Puzzle } from '../../types'

export function PuzzleBoard() {
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [game, setGame] = useState(new Chess())
  const [moveIndex, setMoveIndex] = useState(0)
  const [status, setStatus] = useState<'playing' | 'solved' | 'failed'>('playing')
  const [attempts, setAttempts] = useState(0)
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white')
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [shakeBoard, setShakeBoard] = useState(false)
  const [showComboAnimation, setShowComboAnimation] = useState(false)
  
  const addResult = useGameStore(s => s.addResult)
  const currentCombo = useGameStore(s => s.currentCombo)
  const hintsUsed = useGameStore(s => s.hintsUsedForCurrentPuzzle)
  const incrementHints = useGameStore(s => s.incrementHints)
  const resetHints = useGameStore(s => s.resetHints)
  const timerMode = useGameStore(s => s.timerMode)
  const totalXp = useGameStore(s => s.totalXp)
  
  const puzzle = puzzles[puzzleIndex % puzzles.length]
  const { elapsedMs, timeRemaining, isRunning, start, stop, reset, addTime } = useTimer(timerMode, puzzle.difficulty)
  
  // Initialize puzzle
  const loadPuzzle = useCallback((p: Puzzle) => {
    const newGame = new Chess(p.fen)
    setGame(newGame)
    setMoveIndex(0)
    setStatus('playing')
    setAttempts(0)
    setLastMove(null)
    setBoardOrientation(p.sideToMove === 'white' ? 'white' : 'black')
    resetHints()
    reset()
    // Auto-start timer
    setTimeout(() => start(), 300)
  }, [reset, resetHints, start])
  
  useEffect(() => {
    loadPuzzle(puzzle)
  }, [puzzleIndex]) // eslint-disable-line
  
  // Handle player move
  const onDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (status !== 'playing') return false
    
    const gameCopy = new Chess(game.fen())
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    })
    
    if (!move) return false
    
    const expectedMove = puzzle.solution[moveIndex]
    const isCorrectMove = move.san === expectedMove
    
    if (isCorrectMove) {
      const newMoveIndex = moveIndex + 1
      setGame(gameCopy)
      setLastMove({ from: sourceSquare, to: targetSquare })
      setMoveIndex(newMoveIndex)
      
      // Check if puzzle is complete
      if (newMoveIndex >= puzzle.solution.length) {
        setStatus('solved')
        stop()
        setAttempts(prev => prev + 1)
        
        addResult({
          puzzleId: puzzle.id,
          solved: true,
          timeMs: elapsedMs,
          hintsUsed,
          attempts: attempts + 1,
          timestamp: Date.now(),
          comboBefore: currentCombo,
        })
        
        // Survival: add bonus time
        if (timerMode === 'survival') {
          const bonusByDifficulty: Record<number, number> = { 1: 5000, 2: 8000, 3: 12000, 4: 15000 }
          addTime(bonusByDifficulty[puzzle.difficulty])
        }
        
        // Show combo animation
        if (currentCombo > 0 && (currentCombo + 1) % 5 === 0) {
          setShowComboAnimation(true)
          setTimeout(() => setShowComboAnimation(false), 1500)
        }
        
        return true
      }
      
      // If there are opponent response moves, play them automatically
      if (newMoveIndex < puzzle.solution.length) {
        setTimeout(() => {
          const responseGame = new Chess(gameCopy.fen())
          const responseMove = puzzle.solution[newMoveIndex]
          const responseResult = responseGame.move(responseMove)
          if (responseResult) {
            setGame(responseGame)
            setLastMove({ from: responseResult.from, to: responseResult.to })
            setMoveIndex(newMoveIndex + 1)
          }
        }, 400)
      }
      
      return true
    } else {
      // Wrong move
      setShakeBoard(true)
      setTimeout(() => setShakeBoard(false), 400)
      setAttempts(prev => prev + 1)
      
      // In blitz mode, wrong move = failed
      if (timerMode === 'blitz') {
        setStatus('failed')
        stop()
        addResult({
          puzzleId: puzzle.id,
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
  }, [game, status, moveIndex, puzzle, attempts, hintsUsed, currentCombo, elapsedMs, timerMode, stop, addResult, addTime])
  
  const nextPuzzle = () => {
    setPuzzleIndex(prev => prev + 1)
  }
  
  const resetPuzzle = () => {
    loadPuzzle(puzzle)
  }
  
  const getHint = (level: number) => {
    incrementHints()
    // Hints are placeholder — in real app, they'd be per-puzzle
    const hints = [
      'Cherche un coup d\'échec !',
      `La pièce clé est du côté ${puzzle.sideToMove === 'white' ? 'blanc' : 'noir'}.`,
      `Joue ${puzzle.solution[0]}`,
    ]
    return hints[level - 1] || ''
  }
  
  const timerProgress = timeRemaining !== null
    ? Math.max(0, (timeRemaining / (timerMode === 'blitz' ? [15000, 30000, 60000, 90000][puzzle.difficulty - 1] : 60000)) * 100)
    : 100
  
  const timerColor = timerProgress > 50 ? 'bg-accent-primary' : timerProgress > 25 ? 'bg-warning' : 'bg-danger'
  
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Puzzle info */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glass rounded-lg px-3 py-1.5 text-sm font-medium">
            {puzzle.category === 'mat-en-1' ? 'Mat en 1' : puzzle.category === 'mat-en-2' ? 'Mat en 2' : puzzle.category === 'mat-en-3' ? 'Mat en 3' : 'Mat en 4'}
          </span>
          <span className="text-text-muted text-sm">
            {puzzle.sideToMove === 'white' ? ' Blancs jouent' : ' Noirs jouent'}
          </span>
        </div>
        <span className="text-text-muted text-xs">#{puzzle.exerciseNumber}</span>
      </div>
      
      {/* Timer */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-muted">
            {timerMode === 'free' ? '⏱️ Libre' : timerMode === 'blitz' ? '⚡ Blitz' : '💀 Survie'}
          </span>
          <span className="text-sm font-mono text-text-secondary">
            {timeRemaining !== null ? formatTime(timeRemaining) : formatTime(elapsedMs)}
          </span>
        </div>
        <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${timerColor}`}
            initial={false}
            animate={{ width: `${timerProgress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
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
          <Chessboard
            options={{
              position: game.fen(),
              onPieceDrop: onDrop,
              boardOrientation,
              customBoardStyle: {
                borderRadius: '8px',
                boxShadow: '0 0 30px rgba(124, 58, 237, 0.15)',
              },
              customDarkSquareStyle: { backgroundColor: '#2a2a4a' },
              customLightSquareStyle: { backgroundColor: '#3a3a5a' },
              customSquareStyles: lastMove ? {
                [lastMove.from]: { backgroundColor: 'rgba(124, 58, 237, 0.3)' },
                [lastMove.to]: { backgroundColor: 'rgba(124, 58, 237, 0.3)' },
              } : undefined,
              areArrowsAllowed: true,
            }}
          />
          
          {/* Overlay for solved/failed */}
          <AnimatePresence>
            {status === 'solved' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg"
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
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg"
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
            duration={1.5}
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
              onClick={nextPuzzle}
              className="flex-1 py-3 rounded-xl bg-bg-elevated hover:bg-bg-card text-text-secondary font-semibold transition-colors"
            >
              Passer →
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { incrementHints(); }}
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
