import { motion } from 'framer-motion'
import type { ChessOpening, OpeningProgress } from '../../types'
import { translateOpening, translatePGN } from '../../data/openings-fr'

interface OpeningCardProps {
  opening: ChessOpening
  progress?: OpeningProgress
  onTrain: (eco: string) => void
}

const MASTERY_LABELS = ['Novice', 'Apprenti', 'Intermédiaire', 'Avancé', 'Expert', 'Maître']
const MASTERY_COLORS = [
  'bg-gray-400',
  'bg-green-400',
  'bg-blue-400', 
  'bg-indigo-400',
  'bg-purple-400',
  'bg-yellow-400'
]

export function OpeningCard({ opening, progress, onTrain }: OpeningCardProps) {
  const masteryLevel = progress?.masteryLevel ?? 0
  const attempts = progress?.attempts ?? 0
  const successRate = progress?.successRate ?? 0
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 hover:bg-bg-elevated/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-primary/20 text-accent-primary">
              {opening.eco}
            </span>
            <span className="text-xs text-text-muted">{opening.volume}-Ouvertures</span>
          </div>
          
          <h3 className="font-semibold text-text-primary truncate" title={translateOpening(opening.name)}>
            {translateOpening(opening.name)}
          </h3>
          
          <p className="text-xs text-text-muted mt-1" title={translatePGN(opening.pgn)}>
            {translatePGN(opening.pgn.substring(0, 30))}{opening.pgn.length > 30 ? '...' : ''}
          </p>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTrain(opening.eco)
          }}
          className="btn btn-primary text-xs px-3 py-1.5 shrink-0"
        >
          S'entraîner
        </button>
      </div>
      
      {/* Progress section */}
      <div className="mt-3 pt-3 border-t border-border">
        {attempts > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-sm ${
                      i < masteryLevel ? MASTERY_COLORS[masteryLevel] : 'bg-bg-elevated'
                    }`}
                  >
                    <span className="text-[8px] flex items-center justify-center h-full">
                      {i < masteryLevel ? '★' : ''}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-xs text-text-secondary">
                {MASTERY_LABELS[masteryLevel]}
              </span>
            </div>
            
            <div className="text-xs text-text-muted">
              {successRate}% réussite · {attempts} essais
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTrain(opening.eco)
            }}
            className="w-full flex items-center justify-between text-xs text-text-muted hover:text-accent-primary transition-colors group"
          >
            <span>Pas encore entraîné</span>
            <span className="text-accent-primary group-hover:translate-x-1 transition-transform">Commencer maintenant →</span>
          </button>
        )}
      </div>
      
      {/* Last trained */}
      {progress?.lastTrainedAt && (
        <div className="text-[10px] text-text-muted mt-2">
          Dernier entraînement: {new Date(progress.lastTrainedAt).toLocaleDateString('fr-FR')}
        </div>
      )}
    </motion.div>
  )
}
