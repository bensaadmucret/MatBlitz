import { PuzzleBoard } from '../components/board/PuzzleBoard'
import { useGameStore } from '../stores/gameStore'

export function PlayPage() {
  const timerMode = useGameStore(s => s.timerMode)
  const setTimerMode = useGameStore(s => s.setTimerMode)
  const isPlaying = useGameStore(s => s.isPlaying)

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

      <PuzzleBoard />
    </div>
  )
}
