import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PuzzleBoard } from '../components/board/PuzzleBoard'
import { useGameStore } from '../stores/gameStore'
import { allPuzzles } from '../data/index'
import type { Difficulty, PuzzleCategory } from '../types'

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Facile',
  2: 'Modéré',
  3: 'Difficile',
  4: 'Très Difficile',
  5: 'Expert',
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-green-500/20 text-green-400 border-green-500/30',
  2: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  4: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  5: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function PlayPage() {
  const timerMode = useGameStore(s => s.timerMode)
  const setTimerMode = useGameStore(s => s.setTimerMode)
  const isPlaying = useGameStore(s => s.isPlaying)
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [searchParams] = useSearchParams()
  const category = (searchParams.get('category') as PuzzleCategory | null) ?? undefined
  const sub = searchParams.get('sub') ?? undefined

  const countsByDifficulty: Record<number, number> = {}
  const basePuzzles = category
    ? allPuzzles.filter(p => p.category === category && (!sub || p.subcategory === sub))
    : allPuzzles
  for (let d = 1; d <= 5; d++) {
    countsByDifficulty[d] = basePuzzles.filter(p => p.difficulty === d).length
  }

  return (
    <div className="md:ml-16">
      {/* Timer mode selector - disabled during game */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {(['free', 'blitz', 'survival'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => !isPlaying && setTimerMode(mode)}
            disabled={isPlaying}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timerMode === mode
                ? 'bg-accent-primary text-white'
                : isPlaying
                  ? 'opacity-50 cursor-not-allowed text-text-muted'
                  : 'glass text-text-muted hover:text-text-secondary'
            }`}
            title={isPlaying ? 'Impossible de changer de mode pendant une partie' : undefined}
          >
            {mode === 'free' ? '⏱️ Libre' : mode === 'blitz' ? '⚡ Blitz' : '💀 Survie'}
          </button>
        ))}
      </div>

      {/* Difficulty selector - disabled during game */}
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => !isPlaying && setDifficulty('all')}
          disabled={isPlaying}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            difficulty === 'all'
              ? 'bg-accent-primary text-white border-accent-primary'
              : isPlaying
                ? 'opacity-50 cursor-not-allowed text-text-muted border-border'
                : 'glass text-text-muted hover:text-text-secondary border-border'
          }`}
        >
          Tous niveaux
        </button>
        {([1, 2, 3, 4, 5] as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => !isPlaying && setDifficulty(d)}
            disabled={isPlaying}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              difficulty === d
                ? `${DIFFICULTY_COLORS[d]} border-current`
                : isPlaying
                  ? 'opacity-50 cursor-not-allowed text-text-muted border-border'
                  : `${DIFFICULTY_COLORS[d]} hover:opacity-80 border-transparent`
            }`}
          >
            {'★'.repeat(d)} {DIFFICULTY_LABELS[d]}
            <span className="ml-1 text-xs opacity-60">({countsByDifficulty[d]})</span>
          </button>
        ))}
      </div>

      <PuzzleBoard difficulty={difficulty} category={category} sub={sub} />
    </div>
  )
}
