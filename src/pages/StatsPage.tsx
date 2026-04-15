import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '../stores/gameStore'
import { queries } from '../db'
import { formatTimeShort, formatTime } from '../utils/format'

export function StatsPage() {
  const getLevelInfo = useGameStore(s => s.getLevelInfo)
  const totalXp = useGameStore(s => s.totalXp)
  const bestCombo = useGameStore(s => s.bestCombo)

  const [stats, setStats] = useState({
    totalSolved: 0,
    successRate: 0,
    avgTime: 0,
    fastestTime: 0,
    medianTime: 0,
    heatmap: [] as { date: string; count: number }[],
    timeDistribution: [] as { label: string; count: number }[],
    recentAvg: 0,
    olderAvg: 0,
    perfectSolves: 0,
    totalAttempts: 0,
    totalHints: 0,
    streak: { current: 0, longest: 0, lastDate: '' },
  })

  useEffect(() => {
    ;(async () => {
      try {
        const [totalSolved, successRate, avgTime, fastestTime, streak, heatmap, timeDistribution] = await Promise.all([
          queries.getTotalSolved(),
          queries.getSuccessRate(),
          queries.getAverageTime(),
          queries.getFastestSolve(),
          queries.getStreak(),
          queries.getHeatmapData(90),
          queries.getTimeDistribution(),
        ])

        const now = Date.now()
        const weekAgo = now - 7 * 86400000
        const twoWeeksAgo = now - 14 * 86400000

        const [recentResults, olderResults, allResults] = await Promise.all([
          queries.getResultsByDateRange(weekAgo, now),
          queries.getResultsByDateRange(twoWeeksAgo, weekAgo),
          queries.getResultsByDateRange(0, now),
        ])

        const recentSolved = recentResults.filter(r => r.solved)
        const olderSolved = olderResults.filter(r => r.solved)
        const allSolved = allResults.filter(r => r.solved)

        const sortedTimes = allSolved.map(r => r.timeMs).sort((a, b) => a - b)
        const medianTime = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0

        const recentAvg = recentSolved.length > 0 ? Math.round(recentSolved.reduce((a, r) => a + r.timeMs, 0) / recentSolved.length) : 0
        const olderAvg = olderSolved.length > 0 ? Math.round(olderSolved.reduce((a, r) => a + r.timeMs, 0) / olderSolved.length) : 0

        const perfectSolves = allSolved.filter(r => r.attempts === 1 && r.hintsUsed === 0).length
        const totalAttempts = allResults.length
        const totalHints = allResults.reduce((a, r) => a + r.hintsUsed, 0)

        setStats({
          totalSolved, successRate, avgTime, fastestTime, medianTime,
          heatmap, timeDistribution, recentAvg, olderAvg,
          perfectSolves, totalAttempts, totalHints, streak,
        })
      } catch (e) {
        console.error('Failed to load stats:', e)
      }
    })()
  }, [])

  const levelInfo = getLevelInfo()

  const fullHeatmap = useMemo(() => {
    const now = new Date()
    const result: { date: string; count: number }[] = []
    const heatmapMap = new Map(stats.heatmap.map(h => [h.date, h.count]))
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      result.push({ date: dateStr, count: heatmapMap.get(dateStr) || 0 })
    }
    return result
  }, [stats.heatmap])

  return (
    <div className="space-y-6 md:ml-16">
      <h2 className="text-xl font-bold text-text-primary">Statistiques</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Puzzles résolus" value={stats.totalSolved.toString()} />
        <StatCard label="Taux de réussite" value={`${stats.successRate}%`} />
        <StatCard label="Temps moyen" value={stats.avgTime > 0 ? formatTimeShort(stats.avgTime) : '—'} />
        <StatCard label="Temps médian" value={stats.medianTime > 0 ? formatTimeShort(stats.medianTime) : '—'} />
        <StatCard label="Meilleur temps" value={stats.fastestTime > 0 ? formatTime(stats.fastestTime) : '—'} />
        <StatCard label="Parfait (1er coup)" value={stats.perfectSolves.toString()} />
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{levelInfo.emoji} Niveau {levelInfo.title} {levelInfo.levelInTier}</h3>
          <span className="text-sm text-accent-secondary">{totalXp} XP</span>
        </div>
        <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full transition-all"
            style={{ width: `${levelInfo.progress * 100}%` }}
          />
        </div>
        <div className="text-xs text-text-muted mt-2">
          {levelInfo.xpInCurrentLevel}/{levelInfo.xpForNextLevel} XP pour le prochain niveau
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">🔥 Streak</h3>
        <div className="flex gap-6">
          <div>
            <div className="text-3xl font-bold text-orange-400">{stats.streak.current}</div>
            <div className="text-xs text-text-muted">Actuelle</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-text-secondary">{stats.streak.longest}</div>
            <div className="text-xs text-text-muted">Record</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-accent-secondary">{bestCombo}</div>
            <div className="text-xs text-text-muted">Meilleur combo</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-4">📅 Activité (90 jours)</h3>
        <div className="flex flex-wrap gap-[3px]">
          {fullHeatmap.map((day, i) => (
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

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-4">⏱️ Répartition des temps</h3>
        <div className="space-y-2">
          {stats.timeDistribution.length > 0 ? stats.timeDistribution.map(({ label, count }) => {
            const max = Math.max(...stats.timeDistribution.map(d => d.count), 1)
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
          }) : (
            <p className="text-sm text-text-muted">Aucune donnée encore</p>
          )}
        </div>
      </div>

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

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">📋 Détails</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-text-muted">Tentatives totales</div>
            <div className="text-lg font-bold">{stats.totalAttempts}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Indices utilisés</div>
            <div className="text-lg font-bold">{stats.totalHints}</div>
          </div>
        </div>
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
