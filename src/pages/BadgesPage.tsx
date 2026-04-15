import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { allBadges } from '../data/badges'
import { queries } from '../db'
import type { Badge } from '../types'

export function BadgesPage() {
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const badges = await queries.getUnlockedBadges()
        setUnlockedBadges(badges)
      } catch (e) {
        console.error('Failed to load badges:', e)
      }
    })()
  }, [])

  const unlockedIds = new Set(unlockedBadges.map(b => b.id))

  return (
    <div className="space-y-6 md:ml-16">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">Badges</h2>
        <span className="text-sm text-text-muted">{unlockedBadges.length}/{allBadges.length}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {allBadges.map(badge => {
          const isUnlocked = unlockedIds.has(badge.id)
          return (
            <motion.div
              key={badge.id}
              whileHover={{ scale: 1.02 }}
              className={`glass rounded-2xl p-5 text-center transition-colors ${
                isUnlocked ? 'glow' : 'opacity-50'
              }`}
            >
              <div className={`text-5xl mb-3 ${!isUnlocked ? 'grayscale' : ''}`}>
                {isUnlocked ? badge.emoji : '🔒'}
              </div>
              <div className={`font-semibold text-sm ${isUnlocked ? 'text-text-primary' : 'text-text-muted'}`}>
                {badge.name}
              </div>
              <div className="text-xs text-text-muted mt-1">{badge.description}</div>
              {isUnlocked && (
                <div className="text-[10px] text-accent-secondary mt-2">
                  ✅ Débloqué
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
