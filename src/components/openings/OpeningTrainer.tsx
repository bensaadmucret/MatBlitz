import { useState, useEffect, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import type { OpeningMode, ChessOpening } from '../../types'
import { useOpeningsStore } from '../../stores/openingsStore'
import { useStockfish } from '../../hooks/useStockfish'
import type { MoveCoaching } from '../../utils/chessCoaching'

interface OpeningTrainerProps {
  opening: ChessOpening
  mode: OpeningMode
  onComplete: () => void
  onAbandon: () => void
}

export function OpeningTrainer({ opening, mode, onComplete, onAbandon }: OpeningTrainerProps) {
  const { completeTraining, abandonTraining } = useOpeningsStore()
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [moveIndex, setMoveIndex] = useState(0)
  const [status, setStatus] = useState<'playing' | 'success' | 'error'>('playing')
  const [showHint, setShowHint] = useState(false)
  const [hintMove, setHintMove] = useState<string | null>(null)
  const [hintArrow, setHintArrow] = useState<[string, string] | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const startTimeRef = useRef(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [showName, setShowName] = useState(mode === 'recognition')
  const [opponentJustMoved, setOpponentJustMoved] = useState(false)
  const [sfAdvice, setSfAdvice] = useState<string | null>(null)
  const [sfCoaching, setSfCoaching] = useState<MoveCoaching | null>(null)
  const gameRef = useRef(new Chess())

  const { isReady: sfReady, getCoaching: sfGetCoaching, formatEval, evalPercent } = useStockfish()
  
  // Reset game when opening changes
  useEffect(() => {
    gameRef.current = new Chess()
    setFen(gameRef.current.fen())
    setMoveIndex(0)
    setStatus('playing')
    setShowHint(false)
    setHintMove(null)
    setHintArrow(null)
    setErrorCount(0)
    setIsComplete(false)
    setShowName(mode === 'recognition')
    setOpponentJustMoved(false)
    startTimeRef.current = Date.now()
    setTimeElapsed(0)
  }, [opening, mode])
  
  // Make opponent move in repertoire mode
  useEffect(() => {
    if (mode !== 'repertoire' || !opponentJustMoved) return
    if (moveIndex <= 0 || moveIndex >= opening.moves.length) {
      setOpponentJustMoved(false)
      return
    }
    const opponentMove = opening.moves[moveIndex]
    try {
      const result = gameRef.current.move(opponentMove)
      if (result) {
        setFen(gameRef.current.fen())
        const nextIndex = moveIndex + 1
        setMoveIndex(nextIndex)
        if (nextIndex >= opening.moves.length) {
          setIsComplete(true)
          setStatus('success')
          setTimeout(() => {
            completeTraining({
              eco: opening.eco,
              name: opening.name,
              volume: opening.volume,
              mode,
              errors: errorCount,
              timeMs: Date.now() - startTimeRef.current,
              success: errorCount === 0,
            })
            onComplete()
          }, 1500)
        }
      }
    } catch {
      console.error('Invalid opponent move:', opponentMove)
    }
    setOpponentJustMoved(false)
  }, [mode, opponentJustMoved, moveIndex, opening.moves, opening.eco, opening.name, opening.volume, errorCount, completeTraining, onComplete])
  
  const onDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (isComplete || status === 'error') return false
    if (!targetSquare) return false

    const fenBefore = gameRef.current.fen()
    let move
    try {
      move = gameRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      })
    } catch {
      return false
    }
    
    if (!move) return false
    
    // Check if move matches expected
    const expectedMove = opening.moves[moveIndex]
    const actualMove = move.san
    
    if (actualMove === expectedMove) {
      setFen(gameRef.current.fen())
      setStatus('playing')
      
      const newIndex = moveIndex + 1
      
      if (newIndex >= opening.moves.length) {
        // Complete!
        setIsComplete(true)
        setStatus('success')
        setTimeout(() => {
          completeTraining({
            eco: opening.eco,
            name: opening.name,
            volume: opening.volume,
            mode,
            errors: errorCount,
            timeMs: Date.now() - startTimeRef.current,
            success: errorCount === 0,
          })
          onComplete()
        }, 1500)
      } else {
        setMoveIndex(newIndex)
        
        // In repertoire mode, trigger opponent move
        if (mode === 'repertoire') {
          setOpponentJustMoved(true)
        }
      }
      
      return true
    } else {
      // Wrong move — get Stockfish coaching
      const isCheck = gameRef.current.inCheck()

      gameRef.current.undo()
      setStatus('error')
      setErrorCount(prev => prev + 1)

      // Get Stockfish advice for the wrong move
      if (sfReady) {
        sfGetCoaching(fenBefore, { from: sourceSquare, to: targetSquare }, isCheck).then(c => {
          setSfCoaching(c)
          setSfAdvice(c.advice)
        }).catch(() => {})
      }

      setTimeout(() => setStatus('playing'), 1500)
      return false
    }
  }, [isComplete, status, moveIndex, opening.moves, mode, completeTraining, onComplete, sfReady, sfGetCoaching])
  
  const handleHint = () => {
    // Don't show hint while opponent is about to move (repertoire mode race condition)
    if (opponentJustMoved) return

    const hint = opening.moves[moveIndex]
    if (!hint) return

    setHintMove(hint)
    setShowHint(true)
    setSfAdvice(null)
    setSfCoaching(null)

    // Compute from/to squares for the arrow by replaying all moves up to moveIndex
    try {
      const gameCopy = new Chess()
      for (let i = 0; i < moveIndex; i++) {
        gameCopy.move(opening.moves[i])
      }
      const move = gameCopy.move(hint)
      if (move) {
        setHintArrow([move.from, move.to])
      } else {
        setHintArrow(null)
      }
    } catch {
      setHintArrow(null)
    }

    setTimeout(() => {
      setShowHint(false)
      setHintArrow(null)
    }, 2000)
  }
  
  const handleAbandon = () => {
    abandonTraining()
    onAbandon()
  }
  
  const progress = (moveIndex / opening.moves.length) * 100
  
  // Update elapsed time every second
  useEffect(() => {
    if (isComplete) return
    const interval = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isComplete])
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-primary/20 text-accent-primary">
              {opening.eco}
            </span>
            <span className="text-xs text-text-muted">
              {mode === 'repertoire' ? 'Mode Répertoire' : mode === 'recognition' ? 'Mode Reconnaissance' : 'Mode Apprentissage'}
            </span>
          </div>
          <h2 className="text-lg font-semibold mt-1">
            {showName ? opening.name : mode === 'repertoire' ? 'Jouez les coups corrects' : 'Retrouvez les coups'}
          </h2>
        </div>
        
        <button
          onClick={handleAbandon}
          className="text-xs text-text-muted hover:text-red-400 transition-colors"
        >
          Abandonner
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Coup {Math.min(moveIndex + 1, opening.moves.length)} / {opening.moves.length}</span>
          <span>{timeElapsed}s</span>
        </div>
        <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Chess board */}
      <div className={`relative ${status === 'error' ? 'animate-shake' : ''}`}>
        <Chessboard options={{
          position: fen,
          onPieceDrop: onDrop,
          allowDrawingArrows: true,
          arrows: hintArrow ? [{ startSquare: hintArrow[0], endSquare: hintArrow[1], color: 'rgba(255, 170, 0, 0.8)' }] : [],
        }} />
        
        {/* Status overlay */}
        <AnimatePresence>
          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg"
            >
              <div className="text-4xl">✅</div>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-red-500/20 rounded-lg"
            >
              <div className="text-4xl">❌</div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Hint overlay */}
        {showHint && hintMove && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-lg"
          >
            <span className="text-sm font-medium">Coup attendu: {hintMove}</span>
          </motion.div>
        )}

        {/* Stockfish advice on wrong move */}
        <AnimatePresence>
          {sfCoaching && status === 'playing' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-xl p-3 border"
              style={{
                backgroundColor: `${sfCoaching.color}15`,
                borderColor: `${sfCoaching.color}50`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm" style={{ color: sfCoaching.color }}>
                  {sfCoaching.symbol && `${sfCoaching.symbol} `} {sfCoaching.label}
                </span>
                {sfCoaching.bestMoveSan && (
                  <span className="text-xs text-text-muted">
                    Meilleur: {sfCoaching.bestMoveSan}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary">{sfAdvice}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Evaluation bar */}
      {sfReady && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-text-muted w-12">Éval</span>
          <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
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
      )}

      {/* Controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-text-muted">
          {errorCount > 0 && <span className="text-red-400">{errorCount} erreurs</span>}
          {sfReady && <span className="ml-2 text-blue-400">🧠 Stockfish actif</span>}
        </div>

        <button
          onClick={handleHint}
          disabled={showHint || opponentJustMoved}
          className="btn btn-secondary text-sm px-4 py-2 disabled:opacity-50"
        >
          {showHint ? 'Indice actif' : 'Indice 💡'}
        </button>
      </div>
    </div>
  )
}
