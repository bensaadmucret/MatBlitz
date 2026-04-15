import { useGameStore } from '../stores/gameStore'
import { categories } from '../data/index'
import { formatTimeShort } from '../utils/format'

export function HomePage() {
  const getTotalSolved = useGameStore(s => s.getTotalSolved)
  const getAverageTime = useGameStore(s => s.getAverageTime)
  const getSuccessRate = useGameStore(s => s.getSuccessRate)
  const getStreak = useGameStore(s => s.getStreak)
  const getLevelInfo = useGameStore(s => s.getLevelInfo)
  const totalXp = useGameStore(s => s.totalXp)
  const bestCombo = useGameStore(s => s.bestCombo)
  const isLoaded = useGameStore(s => s.isLoaded)
  
  const totalSolved = isLoaded ? getTotalSolved() : 0
  const avgTime = isLoaded ? getAverageTime() : 0
  const successRate = isLoaded ? getSuccessRate() : 0
  const streak = isLoaded ? getStreak() : { current: 0, longest: 0, lastDate: '' }
  const levelInfo = isLoaded ? getLevelInfo() : { emoji: '♟️', title: 'Pion', levelInTier: 1, progress: 0, xpInCurrentLevel: 0, xpForNextLevel: 100 }
  
  return (
    <div className="space-y-6 md:ml-16">
      {/* Welcome + Level */}
      <div className="glass rounded-2xl p-6 glow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold combo-gradient">MatBlitz</h1>
            <p className="text-text-muted text-sm mt-1">Entraîne-toi, progresse, domine.</p>
          </div>
          <div className="text-4xl">{levelInfo.emoji}</div>
        </div>
        
        {/* Level progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{levelInfo.emoji} {levelInfo.title} — Niveau {levelInfo.levelInTier}</span>
            <span className="text-accent-secondary">{levelInfo.xpInCurrentLevel}/{levelInfo.xpForNextLevel} XP</span>
          </div>
          <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all duration-500"
              style={{ width: `${levelInfo.progress * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🎯" label="Résolus" value={totalSolved.toString()} />
        <StatCard icon="⏱️" label="Temps moy." value={avgTime > 0 ? formatTimeShort(avgTime) : '—'} />
        <StatCard icon="✅" label="Réussite" value={successRate > 0 ? `${successRate}%` : '—'} />
        <StatCard icon="🔥" label="Meilleur combo" value={bestCombo.toString()} />
      </div>
      
      {/* Streak card */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-text-primary">Streak quotidienne</h3>
          <div className="flex items-center gap-1">
            <span className="text-xl">🔥</span>
            <span className="text-2xl font-bold text-orange-400">{streak.current}</span>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {streak.current > 0
            ? `${streak.current} jour${streak.current > 1 ? 's' : ''} consécutif${streak.current > 1 ? 's' : ''} — Record : ${streak.longest} jours`
            : 'Résous un puzzle aujourd\'hui pour démarrer ta streak !'
          }
        </p>
      </div>
      
      {/* Categories overview */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold text-text-primary mb-4">Catégories</h3>
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat.key} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{cat.label}</span>
              <span className="text-xs text-text-muted">{cat.count} puzzles</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Quick play button */}
      <button
        onClick={() => window.location.href = '/play'}
        className="w-full py-4 rounded-2xl bg-accent-primary hover:bg-accent-secondary text-white font-bold text-lg transition-colors glow-accent animate-pulse-glow"
      >
        ⚡ Jouer maintenant
      </button>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center glass-hover transition-colors">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-lg font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  )
}
