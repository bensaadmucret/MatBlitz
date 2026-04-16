import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { OpeningExplorer } from '../components/openings'
import type { OpeningMode } from '../types'

export function OpeningsPage() {
  const navigate = useNavigate()
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [selectedEco, setSelectedEco] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const handleSelectOpening = (eco: string, index: number) => {
    if (isLoading) return // Prevent click while loading
    setSelectedEco(`${eco}-${index}`)
    setShowModeSelector(true)
  }
  
  const handleLoadingComplete = () => {
    setIsLoading(false)
  }
  
  const handleStartTraining = (mode: OpeningMode) => {
    if (selectedEco) {
      navigate(`/openings/train/${selectedEco}?mode=${mode}`)
    }
  }
  
  const getEcoFromSelected = () => {
    if (!selectedEco) return null
    return selectedEco.split('-')[0]
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold combo-gradient">Ouvertures</h1>
          <p className="text-text-muted text-sm mt-1">
            Maîtrisez les ouvertures classiques
          </p>
        </div>
      </div>
      
      <OpeningExplorer onSelectOpening={handleSelectOpening} onLoadingComplete={handleLoadingComplete} selectedEco={getEcoFromSelected()} />
      
      {/* Mode selector modal */}
      {showModeSelector && selectedEco && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-xl p-6 max-w-sm w-full"
          >
            <h3 className="text-lg font-semibold mb-4">Choisir le mode</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => handleStartTraining('learning')}
                className="w-full p-4 rounded-lg bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors text-left border border-accent-primary/30"
              >
                <div className="font-medium text-accent-primary">📚 Mode Apprentissage</div>
                <div className="text-sm text-text-muted">
                  Apprenez l'ouverture coup par coup avec animation
                </div>
              </button>

              <div className="border-t border-border my-2" />
              
              <button
                onClick={() => handleStartTraining('repertoire')}
                className="w-full p-4 rounded-lg bg-bg-elevated hover:bg-accent-primary/20 transition-colors text-left"
              >
                <div className="font-medium">🎯 Répertoire</div>
                <div className="text-sm text-text-muted">
                  L'app joue les coups adverses, vous jouez votre côté
                </div>
              </button>
              
              <button
                onClick={() => handleStartTraining('recognition')}
                className="w-full p-4 rounded-lg bg-bg-elevated hover:bg-accent-primary/20 transition-colors text-left"
              >
                <div className="font-medium">🧠 Reconnaissance</div>
                <div className="text-sm text-text-muted">
                  Vous devez retrouver tous les coups depuis le début
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowModeSelector(false)}
              className="w-full mt-4 text-sm text-text-muted hover:text-text-secondary"
            >
              Annuler
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
