import type { Badge } from '../types'

export const allBadges: Badge[] = [
  {
    id: 'first-blood',
    name: 'Premier Sang',
    emoji: '🎯',
    description: 'Résous ton premier puzzle',
    condition: 'solve_1',
  },
  {
    id: 'on-fire',
    name: 'En Feu',
    emoji: '🔥',
    description: '10 puzzles de suite sans erreur',
    condition: 'combo_10',
  },
  {
    id: 'lightning',
    name: 'Éclair',
    emoji: '⚡',
    description: 'Résous un puzzle en moins de 5 secondes',
    condition: 'speed_5s',
  },
  {
    id: 'strategist',
    name: 'Stratège',
    emoji: '🧠',
    description: 'Complète 100% d\'une catégorie',
    condition: 'category_100',
  },
  {
    id: 'grandmaster',
    name: 'Grand Maître',
    emoji: '👑',
    description: 'Résous les 2000 puzzles',
    condition: 'solve_2000',
  },
  {
    id: 'night-owl',
    name: 'Oiseau de Nuit',
    emoji: '🌙',
    description: 'Résous un puzzle après minuit',
    condition: 'after_midnight',
  },
  {
    id: 'resurrected',
    name: 'Resurrected',
    emoji: '💀',
    description: 'Rate 3 fois puis réussis',
    condition: 'fail3_then_solve',
  },
  {
    id: 'week-warrior',
    name: 'Guerrier de la Semaine',
    emoji: '⚔️',
    description: '7 jours de streak consécutifs',
    condition: 'streak_7',
  },
  {
    id: 'centurion',
    name: 'Centurion',
    emoji: '💯',
    description: 'Résous 100 puzzles',
    condition: 'solve_100',
  },
  {
    id: 'speed-demon',
    name: 'Démon de Vitesse',
    emoji: '🏎️',
    description: 'Résous 10 puzzles en moins de 30s chacun',
    condition: 'speed_10_under_30',
  },
]

export function checkBadgeUnlocks(
  badgeId: string,
  stats: {
    totalSolved: number
    currentCombo: number
    fastestSolve: number
    categoryCompletion: Record<string, number>
    currentStreak: number
    lastSolveHour: number
  }
): boolean {
  switch (badgeId) {
    case 'first-blood':
      return stats.totalSolved >= 1
    case 'on-fire':
      return stats.currentCombo >= 10
    case 'lightning':
      return stats.fastestSolve < 5000
    case 'strategist':
      return Object.values(stats.categoryCompletion).some(v => v >= 100)
    case 'grandmaster':
      return stats.totalSolved >= 2000
    case 'night-owl':
      return stats.lastSolveHour >= 0 && stats.lastSolveHour < 6
    case 'week-warrior':
      return stats.currentStreak >= 7
    case 'centurion':
      return stats.totalSolved >= 100
    default:
      return false
  }
}
