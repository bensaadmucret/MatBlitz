import { useState, useEffect, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { motion, AnimatePresence } from 'framer-motion'
import type { OpeningMode, ChessOpening } from '../../types'
import { useOpeningsStore } from '../../stores/openingsStore'

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
  const [errorCount, setErrorCount] = useState(0)
  const [startTime] = useState(() => Date.now())
  const [isComplete, setIsComplete] = useState(false)
  const [showName, setShowName] = useState(mode === 'recognition')
  const [opponentJustMoved, setOpponentJustMoved] = useState(false)
  const gameRef = useRef(new Chess())
  
  // Reset game when opening changes
  useEffect(() => {
    gameRef.current = new Chess()
    setFen(gameRef.current.fen())
    setMoveIndex(0)
    setStatus('playing')
    setShowHint(false)
    setHintMove(null)
    setErrorCount(0)
    setIsComplete(false)
    setShowName(mode === 'recognition')
    setOpponentJustMoved(false)
  }, [opening, mode])
  
  // Make opponent move in repertoire mode
  useEffect(() => {
    if (mode === 'repertoire' && opponentJustMoved && moveIndex > 0 && moveIndex < opening.moves.length) {
      const opponentMove = opening.moves[moveIndex]
      try {
        const result = gameRef.current.move(opponentMove)
        if (result) {
          setFen(gameRef.current.fen())
          setMoveIndex(prev => prev + 1)
        }
      } catch {
        console.error('Invalid opponent move:', opponentMove)
      }
      setOpponentJustMoved(false)
    }
  }, [mode, opponentJustMoved, moveIndex, opening.moves])
  
  const onDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (isComplete || status === 'error') return false
    if (!targetSquare) return false
    
    const move = gameRef.current.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q'
    })
    
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
          completeTraining()
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
      // Wrong move
      gameRef.current.undo()
      setStatus('error')
      setErrorCount(prev => prev + 1)
      
      setTimeout(() => setStatus('playing'), 500)
      return false
    }
  }, [isComplete, status, moveIndex, opening.moves, mode, completeTraining, onComplete])
  
  const handleHint = () => {
    const hint = opening.moves[moveIndex]
    setHintMove(hint)
    setShowHint(true)
    setTimeout(() => setShowHint(false), 2000)
  }
  
  const handleAbandon = () => {
    abandonTraining()
    onAbandon()
  }
  
  const progress = ((moveIndex + (opponentJustMoved ? 0 : 0)) / opening.moves.length) * 100
  const timeElapsed = Math.floor((Date.now() - startTime) / 1000)
  void timeElapsed // used in JSX below
  
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
              {mode === 'repertoire' ? 'Mode Répertoire' : 'Mode Reconnaissance'}
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
        <Chessboard options={{ position: fen, onPieceDrop: onDrop }} />
        
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
      </div>
      
      {/* Controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-text-muted">
          {errorCount > 0 && <span className="text-red-400">{errorCount} erreurs</span>}
        </div>
        
        <button
          onClick={handleHint}
          disabled={showHint}
          className="btn btn-secondary text-sm px-4 py-2 disabled:opacity-50"
        >
          {showHint ? 'Indice actif' : 'Indice 💡'}
        </button>
      </div>
    </div>
  )
}
