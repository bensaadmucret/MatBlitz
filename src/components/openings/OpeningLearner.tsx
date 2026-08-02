import { useState, useEffect, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChessOpening } from '../../types'
import { translateOpening, translatePGN } from '../../data/openings-fr'

interface OpeningLearnerProps {
  opening: ChessOpening
  onComplete: () => void
  onSkip: () => void
}

export function OpeningLearner({ opening, onComplete, onSkip }: OpeningLearnerProps) {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const gameRef = useRef(new Chess())
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    gameRef.current = new Chess()
    setFen(gameRef.current.fen())
    setCurrentMoveIndex(0)
    setMoveHistory([])
    setShowMove(false)
    setIsPlaying(false)
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current)
    }
  }, [])

  const playNextMove = useCallback(() => {
    if (currentMoveIndex >= opening.moves.length) {
      setIsPlaying(false)
      return
    }

    const move = opening.moves[currentMoveIndex]
    setShowMove(true)
    
    autoPlayRef.current = setTimeout(() => {
      try {
        const result = gameRef.current.move(move)
        if (result) {
          setFen(gameRef.current.fen())
          setMoveHistory(prev => [...prev, result.san])
          setCurrentMoveIndex(prev => prev + 1)
          setShowMove(false)
        }
      } catch {
        console.error('Invalid move:', move)
        setIsPlaying(false)
      }
    }, 1500)
  }, [currentMoveIndex, opening.moves])

  const startAutoPlay = useCallback(() => {
    reset()
    setIsPlaying(true)
  }, [reset])

  const stopAutoPlay = useCallback(() => {
    setIsPlaying(false)
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current)
    }
  }, [])

  const goToMove = useCallback((index: number) => {
    stopAutoPlay()
    gameRef.current = new Chess()
    const history: string[] = []
    
    for (let i = 0; i < index && i < opening.moves.length; i++) {
      try {
        const result = gameRef.current.move(opening.moves[i])
        if (result) {
          history.push(result.san)
        }
      } catch {
        break
      }
    }
    
    setFen(gameRef.current.fen())
    setCurrentMoveIndex(index)
    setMoveHistory(history)
    setShowMove(false)
  }, [opening.moves, stopAutoPlay])

  useEffect(() => {
    if (isPlaying && !showMove && currentMoveIndex < opening.moves.length) {
      const timer = setTimeout(() => playNextMove(), 0)
      return () => clearTimeout(timer)
    }
  }, [isPlaying, showMove, currentMoveIndex, opening.moves.length, playNextMove])

  useEffect(() => {
    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current)
      }
    }
  }, [])

  const progress = (currentMoveIndex / opening.moves.length) * 100
  const isComplete = currentMoveIndex >= opening.moves.length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold combo-gradient">Mode Apprentissage</h2>
          <p className="text-text-muted text-sm">
            {translateOpening(opening.name)} — {opening.moves.length} coups
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              onClick={startAutoPlay}
              disabled={isComplete}
              className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <span>▶</span> {currentMoveIndex === 0 ? 'Apprendre' : 'Recommencer'}
            </button>
          ) : (
            <button
              onClick={stopAutoPlay}
              className="btn btn-secondary flex items-center gap-2"
            >
              <span>⏸</span> Pause
            </button>
          )}
          
          <button onClick={onSkip} className="btn btn-ghost">
            Passer →
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Chess board */}
        <div className="relative">
          <Chessboard options={{ position: fen }} />
          
          {/* Move indicator overlay */}
          <AnimatePresence>
            {showMove && currentMoveIndex < opening.moves.length && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="bg-accent-primary text-white text-2xl font-bold px-6 py-3 rounded-xl shadow-lg">
                  {opening.moves[currentMoveIndex]}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Completion overlay */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">🎉</div>
                  <div className="font-bold text-green-400">Ouverture maîtrisée !</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Move list & controls */}
        <div className="space-y-4">
          {/* Current move info */}
          <div className="glass rounded-xl p-4">
            <div className="text-sm text-text-muted mb-2">Coup actuel</div>
            <div className="text-2xl font-bold">
              {showMove && currentMoveIndex < opening.moves.length ? (
                <span className="text-accent-primary animate-pulse">
                  {opening.moves[currentMoveIndex]}
                </span>
              ) : currentMoveIndex > 0 && currentMoveIndex <= opening.moves.length ? (
                <span className="text-text-primary">
                  {moveHistory[moveHistory.length - 1]}
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
            <div className="text-sm text-text-muted mt-2">
              Coup {currentMoveIndex + (showMove ? 0 : 1)} / {opening.moves.length}
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToMove(Math.max(0, currentMoveIndex - 1))}
              disabled={currentMoveIndex === 0}
              className="btn btn-secondary flex-1 disabled:opacity-50"
            >
              ← Précédent
            </button>
            <button
              onClick={() => goToMove(Math.min(opening.moves.length, currentMoveIndex + 1))}
              disabled={currentMoveIndex >= opening.moves.length}
              className="btn btn-secondary flex-1 disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>

          {/* Move history */}
          <div className="glass rounded-xl p-4">
            <div className="text-sm text-text-muted mb-3">Historique</div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              {moveHistory.map((move, i) => (
                <button
                  key={i}
                  onClick={() => goToMove(i + 1)}
                  className={`text-left px-2 py-1 rounded ${
                    i === currentMoveIndex - 1 
                      ? 'bg-accent-primary/20 text-accent-primary' 
                      : 'hover:bg-bg-elevated'
                  }`}
                >
                  {Math.floor(i / 2) + 1}. {i % 2 === 0 ? '' : '...'} {move}
                </button>
              ))}
            </div>
            {moveHistory.length === 0 && (
              <div className="text-text-muted text-sm italic">
                Cliquez sur "Apprendre" pour voir la séquence
              </div>
            )}
          </div>

          {/* PGN display */}
          <div className="glass rounded-xl p-4">
            <div className="text-sm text-text-muted mb-2">Notation PGN</div>
            <div className="text-xs text-text-secondary font-mono break-all">
              {translatePGN(opening.pgn)}
            </div>
          </div>

          {/* Start training button */}
          {isComplete && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={onComplete}
              className="w-full btn btn-primary py-3 text-lg"
            >
              🎯 Passer à l'entraînement
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
