import { useGameStore } from '../stores/gameStore'
import { queries } from '../db'

export function SettingsPage() {
  const timerMode = useGameStore(s => s.timerMode)
  const setTimerMode = useGameStore(s => s.setTimerMode)
  
  return (
    <div className="space-y-6 md:ml-16 max-w-md">
      <h2 className="text-xl font-bold text-text-primary">Paramètres</h2>
      
      {/* Timer mode */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold">⏱️ Mode timer</h3>
        {([
          { mode: 'free' as const, label: 'Libre', desc: 'Pas de limite, le timer tourne pour les stats' },
          { mode: 'blitz' as const, label: 'Blitz', desc: 'Temps limité selon la difficulté' },
          { mode: 'survival' as const, label: 'Survie', desc: 'Un seul timer, +temps à chaque puzzle résolu' },
        ]).map(opt => (
          <button
            key={opt.mode}
            onClick={() => setTimerMode(opt.mode)}
            className={`w-full text-left p-4 rounded-xl transition-colors ${
              timerMode === opt.mode
                ? 'bg-accent-primary/20 border border-accent-primary/40'
                : 'glass glass-hover'
            }`}
          >
            <div className="font-medium text-sm text-text-primary">{opt.label}</div>
            <div className="text-xs text-text-muted mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>
      
      {/* Database info */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-2">💾 Stockage</h3>
        <p className="text-sm text-text-muted">
          Données persistées via SQLite (sql.js) dans IndexedDB.
          Toute ta progression est sauvegardée automatiquement.
        </p>
        <div className="mt-3 text-xs text-text-muted">
          {queries.getTotalSolved()} puzzles résolus • {queries.getAllResults().length} résultats enregistrés
        </div>
      </div>
      
      {/* About */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-2">À propos</h3>
        <p className="text-sm text-text-muted">
          MatBlitz ⚡ — Entraînement aux puzzles d'échecs avec gamification.
          Source : 1000 Exercices et Puzzles d'Échecs + 1000 Exercices Mat en 2 (Vol. 2) + Lichess Puzzle Database
        </p>
      </div>
      
      {/* Reset */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-2 text-danger">Zone danger</h3>
        <button
          onClick={() => {
            if (confirm('Tu es sûr ? Toute ta progression sera perdue.')) {
              queries.resetAllData()
              window.location.reload()
            }
          }}
          className="px-4 py-2 rounded-lg bg-danger/20 text-danger text-sm hover:bg-danger/30 transition-colors"
        >
          Réinitialiser toute la progression
        </button>
      </div>
    </div>
  )
}
