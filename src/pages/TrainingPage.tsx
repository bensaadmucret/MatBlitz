import { useState } from 'react'
import { motion } from 'framer-motion'
import { Spartacus } from '../components/ai/Spartacus'
import { AdaptiveAI } from '../components/ai/AdaptiveAI'

type TrainingMode = 'select' | 'spartacus' | 'adaptive'

export function TrainingPage() {
  const [mode, setMode] = useState<TrainingMode>('select')

  if (mode === 'spartacus') {
    return (
      <div className="space-y-6 md:ml-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode('select')}
            className="glass rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Retour
          </button>
          <h2 className="text-xl font-bold text-text-primary">⚔️ Spartacus</h2>
        </div>
        <Spartacus />
      </div>
    )
  }

  if (mode === 'adaptive') {
    return (
      <div className="space-y-6 md:ml-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode('select')}
            className="glass rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Retour
          </button>
          <h2 className="text-xl font-bold text-text-primary">🧠 IA Adaptative</h2>
        </div>
        <AdaptiveAI />
      </div>
    )
  }

  return (
    <div className="space-y-6 md:ml-16">
      <div>
        <h1 className="text-2xl font-bold combo-gradient">Entraînement IA</h1>
        <p className="text-text-muted text-sm mt-1">Joue contre l'IA et améliore-toi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spartacus */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMode('spartacus')}
          className="glass rounded-2xl p-6 text-left transition-colors group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-4xl">⚔️</div>
            <span className="text-xs text-text-muted glass rounded-full px-2 py-1">12 défis</span>
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">Spartacus</h3>
          <p className="text-sm text-text-secondary">
            Bat l'IA dans des positions désavantageuses. Style Dr Wolf — chaque défi est un puzzle à résoudre contre l'IA.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-red-400">🔴 Difficulté variable</span>
            <span className="text-xs text-text-muted">•</span>
            <span className="text-xs text-text-muted">Mat en N coups</span>
          </div>
        </motion.button>

        {/* Adaptive AI */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setMode('adaptive')}
          className="glass rounded-2xl p-6 text-left transition-colors group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="text-4xl">🧠</div>
            <span className="text-xs text-text-muted glass rounded-full px-2 py-1">5 niveaux</span>
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">IA Adaptative</h3>
          <p className="text-sm text-text-secondary">
            Joue une partie complète contre l'IA. Analyse tes erreurs et reçois des conseils sur tes coups.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-blue-400">🔵 Partie libre</span>
            <span className="text-xs text-text-muted">•</span>
            <span className="text-xs text-text-muted">Analyse d'erreurs</span>
          </div>
        </motion.button>
      </div>

      {/* Info card */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold text-text-primary mb-2">💡 Comment ça marche ?</h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <p><span className="text-red-400 font-medium">Spartacus</span> : des positions où tu dois gagner malgré un désavantage. L'IA joue au mieux de son côté.</p>
          <p><span className="text-blue-400 font-medium">IA Adaptative</span> : partie complète avec choix de couleur et de niveau. L'IA évalue chaque position.</p>
        </div>
      </div>
    </div>
  )
}
