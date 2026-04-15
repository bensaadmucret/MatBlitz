import { useGameStore } from '../stores/gameStore'
import { categories, subcategories, allPuzzles } from '../data/index'

export function PuzzlesPage() {
  const solvedPuzzleIds = useGameStore(s => s.solvedPuzzleIds)
  
  return (
    <div className="space-y-6 md:ml-16">
      <h2 className="text-xl font-bold text-text-primary">Catalogue de puzzles</h2>
      
      {categories.map(cat => {
        const catPuzzles = allPuzzles.filter(p => p.category === cat.key)
        const solvedCount = catPuzzles.filter(p => solvedPuzzleIds.has(p.id)).length
        
        return (
          <div key={cat.key} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text-primary">{cat.label}</h3>
              <span className="text-xs text-text-muted">{solvedCount}/{catPuzzles.length} résolus</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-accent-primary rounded-full transition-all duration-500"
                style={{ width: catPuzzles.length > 0 ? `${(solvedCount / catPuzzles.length) * 100}%` : '0%' }}
              />
            </div>
            
            {/* Subcategories */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(subcategories[cat.key] || []).map(sub => {
                const subPuzzles = catPuzzles.filter(p => p.subcategory === sub.key)
                if (subPuzzles.length === 0) return null
                const subSolved = subPuzzles.filter(p => solvedPuzzleIds.has(p.id)).length
                
                return (
                  <button
                    key={sub.key}
                    className="glass glass-hover rounded-lg p-3 text-left transition-colors"
                    onClick={() => { window.location.href = `/play?category=${cat.key}&sub=${sub.key}` }}
                  >
                    <div className="text-sm text-text-primary font-medium">{sub.label}</div>
                    <div className="text-xs text-text-muted mt-1">{subSolved}/{subPuzzles.length}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
