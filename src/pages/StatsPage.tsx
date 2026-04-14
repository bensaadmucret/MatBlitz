import { useMemo } from 'react'
import { useGameStore } from '../stores/gameStore'
import { formatTimeShort, formatTime } from '../utils/format'

export function StatsPage() {
  const results = useGameStore(s => s.results)
  const streak = useGameStore(s => s.streak)
  const getLevelInfo = useGameStore(s => s.getLevelInfo)
  const bestCombo = useGameStore(s => s.bestCombo)
  
  const levelInfo = getLevelInfo()
  
  const stats = useMemo(() => {
    const solved = results.filter(r => r.solved)
    const failed = results.filter(r => !r.solved)
    
    // Heatmap data (last 90 days)
    const now = new Date()
    const heatmap: { date: string; count: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const count = solved.filter(r => new Date(r.timestamp).toISOString().split('T')[0] === dateStr).length
      heatmap.push({ date: dateStr, count })
    }
    
    // Time distribution
    const timeBuckets = {
      '<5s': 0,
      '5-15s': 0,
      '15-30s': 0,
      '30-60s': 0,
      '>60s': 0,
    }
    for (const r of solved) {
      const s = r.timeMs / 1000
      if (s < 5) timeBuckets['<5s']++
      else if (s < 15) timeBuckets['5-15s']++
      else if (s < 30) timeBuckets['15-30s']++
      else if (s < 60) timeBuckets['30-60s']++
      else timeBuckets['>60s']++
    }
    
    // Median time
    const sortedTimes = solved.map(r => r.timeMs).sort((a, b) => a - b)
    const medianTime = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0
    
    // Recent trend (last 7 days)
    const weekAgo = Date.now() - 7 * 86400000
    const recentSolved = solved.filter(r => r.timestamp > weekAgo)
    const recentAvg = recentSolved.length > 0
      ? recentSolved.reduce((a, r) => a + r.timeMs, 0) / recentSolved.length
      : 0
    
    // Older period for comparison
    const twoWeeksAgo = Date.now() - 14 * 86400000
    const olderSolved = solved.filter(r => r.timestamp > twoWeeksAgo && r.timestamp <= weekAgo)
    const olderAvg = olderSolved.length > 0
      ? olderSolved.reduce((a, r) => a + r.timeMs, 0) / olderSolved.length
      : 0
    
    return {
      totalSolved: solved.length,
      totalFailed: failed.length,
      totalAttempts: results.length,
      successRate: results.length > 0 ? Math.round((solved.length / results.length) * 100) : 0,
      avgTime: solved.length > 0 ? Math.round(solved.reduce((a, r) => a + r.timeMs, 0) / solved.length) : 0,
      medianTime,
      fastestTime: solved.length > 0 ? Math.min(...solved.map(r => r.timeMs)) : 0,
      heatmap,
      timeBuckets,
      recentAvg,
      olderAvg,
      totalHintsUsed: results.reduce((a, r) => a + r.hintsUsed, 0),
      perfectSolves: solved.filter(r => r.attempts === 1 && r.hintsUsed === 0).length,
    }
  }, [results])
  
  return (
    <div className="space-y-6 md:ml-16">
      <h2 className="text-xl font-bold text-text-primary">Statistiques</h2>
      
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Puzzles résolus" value={stats.totalSolved.toString()} />
        <StatCard label="Taux de réussite" value={`${stats.successRate}%`} />
        <StatCard label="Temps moyen" value={stats.avgTime > 0 ? formatTimeShort(stats.avgTime) : '—'} />
        <StatCard label="Temps médian" value={stats.medianTime > 0 ? formatTimeShort(stats.medianTime) : '—'} />
        <StatCard label="Meilleur temps" value={stats.fastestTime > 0 ? formatTime(stats.fastestTime) : '—'} />
        <StatCard label="Parfait (1er coup)" value={stats.perfectSolves.toString()} />
      </div>
      
      {/* Level & XP */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{levelInfo.emoji} Niveau {levelInfo.title} {levelInfo.levelInTier}</h3>
          <span className="text-sm text-accent-secondary">{useGameStore.getState().totalXp} XP</span>
        </div>
        <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all"
            style={{ width: `${levelInfo.progress * 100}%` }}
          />
        </div>
      </div>
      
      {/* Streak */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">🔥 Streak</h3>
        <div className="flex gap-6">
          <div>
            <div className="text-3xl font-bold text-orange-400">{streak.current}</div>
            <div className="text-xs text-text-muted">Actuelle</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-text-secondary">{streak.longest}</div>
            <div className="text-xs text-text-muted">Record</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-accent-secondary">{bestCombo}</div>
            <div className="text-xs text-text-muted">Meilleur combo</div>
          </div>
        </div>
      </div>
      
      {/* Heatmap */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-4">📅 Activité (90 jours)</h3>
        <div className="flex flex-wrap gap-[3px]">
          {stats.heatmap.map((day, i) => (
            <div
              key={i}
              className="w-[10px] h-[10px] rounded-[2px] transition-colors"
              style={{
                backgroundColor: day.count === 0
                  ? 'var(--color-bg-elevated)'
                  : day.count <= 2
                  ? 'rgba(124, 58, 237, 0.3)'
                  : day.count <= 5
                  ? 'rgba(124, 58, 237, 0.5)'
                  : day.count <= 10
                  ? 'rgba(124, 58, 237, 0.7)'
                  : 'rgba(124, 58, 237, 1)',
              }}
              title={`${day.date}: ${day.count} puzzle${day.count > 1 ? 's' : ''}`}
            />
          ))}
        </div>
      </div>
      
      {/* Time distribution */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-4">⏱️ Répartition des temps</h3>
        <div className="space-y-2">
          {Object.entries(stats.timeBuckets).map(([label, count]) => {
            const max = Math.max(...Object.values(stats.timeBuckets), 1)
            const pct = (count / max) * 100
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-12 text-right">{label}</span>
                <div className="flex-1 h-4 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-primary/60 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-text-secondary w-8">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Trend */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">📈 Tendance</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-text-muted mb-1">7 derniers jours</div>
            <div className="text-lg font-bold text-text-primary">
              {stats.recentAvg > 0 ? formatTimeShort(Math.round(stats.recentAvg)) : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted mb-1">Semaine précédente</div>
            <div className="text-lg font-bold text-text-secondary">
              {stats.olderAvg > 0 ? formatTimeShort(Math.round(stats.olderAvg)) : '—'}
            </div>
          </div>
        </div>
        {stats.recentAvg > 0 && stats.olderAvg > 0 && (
          <div className={`text-xs mt-2 ${stats.recentAvg < stats.olderAvg ? 'text-success' : 'text-warning'}`}>
            {stats.recentAvg < stats.olderAvg
              ? `⬆️ Tu t'améliores ! (${Math.round(((stats.olderAvg - stats.recentAvg) / stats.olderAvg) * 100)}% plus rapide)`
              : `⬇️ Ralentissement (${Math.round(((stats.recentAvg - stats.olderAvg) / stats.olderAvg) * 100)}% plus lent)`
            }
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  )
}
