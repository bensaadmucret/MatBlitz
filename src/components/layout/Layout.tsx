import { NavLink, Outlet } from 'react-router-dom'
import { useGameStore } from '../../stores/gameStore'
import { motion } from 'framer-motion'
import { BadgeToast } from '../ui/BadgeToast'

const navItems = [
  { to: '/', label: 'Accueil', icon: '🏠' },
  { to: '/play', label: 'Jouer', icon: '♟️' },
  { to: '/openings', label: 'Ouvertures', icon: '📚' },
  { to: '/puzzles', label: 'Puzzles', icon: '🧩' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/badges', label: 'Badges', icon: '🏆' },
]

export function Layout() {
  const getLevelInfo = useGameStore(s => s.getLevelInfo)
  const isLoaded = useGameStore(s => s.isLoaded)
  
  const levelInfo = isLoaded ? getLevelInfo() : { emoji: '♟️', title: 'Pion', levelInTier: 1, progress: 0, xpInCurrentLevel: 0, xpForNextLevel: 100 }
  // Streak removed from header — now only shown on HomePage
  
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      {/* Top bar */}
      <header className="glass border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold combo-gradient">MatBlitz</span>
            <span className="text-xs text-text-muted">⚡</span>
          </NavLink>
          
          <div className="flex items-center gap-4">
            {/* Level badge */}
            <div className="flex items-center gap-2 glass rounded-full px-3 py-1">
              <span className="text-sm">{levelInfo.emoji}</span>
              <span className="text-xs font-medium text-text-secondary">{levelInfo.title} {levelInfo.levelInTier}</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      
      {/* Bottom nav (mobile) */}
      <nav className="glass border-t border-border sticky bottom-0 z-50 md:hidden">
        <div className="flex justify-around py-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  isActive ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[10px]">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="w-1 h-1 rounded-full bg-accent-primary"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      
      {/* Desktop sidebar nav */}
      <nav className="hidden md:block fixed left-0 top-14 bottom-0 w-16 glass border-r border-border z-40">
        <div className="flex flex-col items-center gap-2 py-4">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'text-accent-primary bg-bg-elevated/50' : 'text-text-muted hover:text-text-secondary'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[9px]">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Badge unlock notifications */}
      <BadgeToast />
    </div>
  )
}
