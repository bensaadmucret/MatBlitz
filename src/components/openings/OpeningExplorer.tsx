import { useState, useMemo, useEffect } from 'react'
import { OpeningCard } from './OpeningCard'
import type { OpeningFilter } from '../../types'
import { useOpeningsStore } from '../../stores/openingsStore'

interface OpeningExplorerProps {
  onSelectOpening: (eco: string, index: number) => void
  onLoadingComplete?: () => void
  selectedEco?: string | null
}

const VOLUME_INFO: Record<string, { name: string; description: string; emoji: string }> = {
  A: { name: 'Aile', description: 'Anglaise, Réti', emoji: '🏃' },
  B: { name: 'Semi-Ouvertes', description: 'Sicilienne, Caro-Kann', emoji: '⚔️' },
  C: { name: 'Ouvertes', description: 'Italienne, Espagnole', emoji: '⚡' },
  D: { name: 'Fermées', description: "Gambit de Dame", emoji: '🏰' },
  E: { name: 'Indiennes', description: "Indienne du Roi, Nimzo", emoji: '🐘' },
}

const FILTERS: { key: OpeningFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'learning', label: 'À apprendre' },
  { key: 'mastered', label: 'Maîtrisées' },
  { key: 'A', label: 'A' },
  { key: 'B', label: 'B' },
  { key: 'C', label: 'C' },
  { key: 'D', label: 'D' },
  { key: 'E', label: 'E' },
]

const ITEMS_PER_PAGE = 24

export function OpeningExplorer({ onSelectOpening, onLoadingComplete }: OpeningExplorerProps) {
  const { progress, isLoaded, loadOpenings, loadProgress, getFilteredOpenings, getStatsByVolume } = useOpeningsStore()
  const [filter, setFilter] = useState<OpeningFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  
  useEffect(() => {
    loadOpenings()
    loadProgress()
  }, [loadOpenings, loadProgress])
  
  // Notify parent when loading is complete
  useEffect(() => {
    if (isLoaded && onLoadingComplete) {
      onLoadingComplete()
    }
  }, [isLoaded, onLoadingComplete])
  
  // Reset page when filter or search changes
  const prevFilter = useRef(filter)
  const prevSearch = useRef(search)
  if (filter !== prevFilter.current || search !== prevSearch.current) {
    prevFilter.current = filter
    prevSearch.current = search
    setPage(1)
  }
  
  const filteredOpenings = useMemo(() => {
    return getFilteredOpenings(filter, search)
  }, [filter, search, getFilteredOpenings])
  
  const totalPages = Math.ceil(filteredOpenings.length / ITEMS_PER_PAGE)
  const paginatedOpenings = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredOpenings.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredOpenings, page])
  
  const stats = useMemo(() => getStatsByVolume(), [getStatsByVolume])
  const totalMastered = useMemo(() => 
    Array.from(progress.values()).filter(p => p.masteryLevel >= 4).length,
  [progress])
  
  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-accent-primary/20 rounded-full"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-center">
          <div className="text-text-primary font-medium">Chargement des ouvertures...</div>
          <div className="text-text-muted text-sm mt-1">3100+ ouvertures à indexer</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['A', 'B', 'C', 'D', 'E'].map(vol => {
          const stat = stats[vol]
          return (
            <div key={vol} className="glass rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">{VOLUME_INFO[vol].emoji}</div>
              <div className="text-xs text-text-muted">{VOLUME_INFO[vol].name}</div>
              <div className="text-sm font-semibold mt-1">
                {stat.mastered}/{stat.total}
              </div>
              <div className="text-[10px] text-text-muted">maîtrisées</div>
            </div>
          )
        })}
      </div>
      
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une ouverture..."
          className="input flex-1"
        />
        
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-elevated text-text-secondary hover:bg-bg-elevated/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          {filteredOpenings.length} ouvertures
          {filteredOpenings.length > ITEMS_PER_PAGE && (
            <span className="text-text-secondary ml-1">
              (page {page}/{totalPages})
            </span>
          )}
        </span>
        <span>{totalMastered} maîtrisées au total</span>
      </div>
      
      {/* Openings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedOpenings.map((opening, index) => (
          <OpeningCard
            key={`${opening.eco}-${(page - 1) * ITEMS_PER_PAGE + index}`}
            opening={opening}
            progress={progress.get(opening.eco)}
            onTrain={(eco) => onSelectOpening(eco, (page - 1) * ITEMS_PER_PAGE + index)}
          />
        ))}
      </div>
      
      {filteredOpenings.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <div className="text-4xl mb-3">🔍</div>
          <p>Aucune ouverture trouvée</p>
          <p className="text-sm mt-1">Essayez une autre recherche</p>
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-bg-elevated text-sm font-medium disabled:opacity-50 hover:bg-accent-primary/20 transition-colors"
          >
            ← Précédent
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
              let pageNum = i + 1
              if (totalPages > 5) {
                if (page > 3) pageNum = page - 2 + i
                if (pageNum > totalPages) pageNum = totalPages - 4 + i
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-accent-primary text-white'
                      : 'bg-bg-elevated hover:bg-accent-primary/20'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg bg-bg-elevated text-sm font-medium disabled:opacity-50 hover:bg-accent-primary/20 transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
