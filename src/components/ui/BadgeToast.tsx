import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

export function BadgeToast() {
  const lastUnlockedBadges = useGameStore(s => s.lastUnlockedBadges)
  const clearLastUnlockedBadges = useGameStore(s => s.clearLastUnlockedBadges)

  useEffect(() => {
    if (lastUnlockedBadges && lastUnlockedBadges.length > 0) {
      // Auto-clear after 4 seconds
      const timer = setTimeout(() => {
        clearLastUnlockedBadges()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [lastUnlockedBadges, clearLastUnlockedBadges])

  if (!lastUnlockedBadges || lastUnlockedBadges.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {lastUnlockedBadges.map((badge, index) => (
          <motion.div
            key={badge.id}
            initial={{ x: 100, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 100, opacity: 0, scale: 0.8 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            className="glass glow rounded-xl p-4 flex items-center gap-3 min-w-[280px]"
          >
            <div className="text-4xl">{badge.emoji}</div>
            <div>
              <div className="text-xs text-accent-secondary font-semibold uppercase tracking-wider">
                🏆 Badge débloqué
              </div>
              <div className="font-bold text-text-primary">{badge.name}</div>
              <div className="text-xs text-text-muted">{badge.description}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
