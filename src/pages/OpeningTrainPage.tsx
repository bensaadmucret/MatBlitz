import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { OpeningTrainer, OpeningLearner } from '../components/openings'
import { useOpeningsStore } from '../stores/openingsStore'
import type { OpeningMode, ChessOpening } from '../types'

export function OpeningTrainPage() {
  const { eco } = useParams<{ eco: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { openings, loadOpenings } = useOpeningsStore()
  const [opening, setOpening] = useState<ChessOpening | null>(null)
  const [mode, setMode] = useState<OpeningMode>('repertoire')
  
  useEffect(() => {
    loadOpenings()
  }, [loadOpenings])
  
  useEffect(() => {
    if (eco && openings.length > 0) {
      // eco format is "A00-5" (ECO-index)
      const [ecoCode, indexStr] = eco.split('-')
      const index = indexStr ? parseInt(indexStr) : -1
      
      // Find all openings with this ECO
      const matchingOpenings = openings.filter(o => o.eco === ecoCode)
      
      // Use index if provided, otherwise fallback to first match
      if (index >= 0 && index < matchingOpenings.length) {
        setOpening(matchingOpenings[index])
      } else if (matchingOpenings.length > 0) {
        setOpening(matchingOpenings[0])
      } else {
        navigate('/openings')
      }
    }
  }, [eco, openings, navigate])
  
  useEffect(() => {
    const modeParam = searchParams.get('mode') as OpeningMode
    if (modeParam === 'repertoire' || modeParam === 'recognition' || modeParam === 'learning') {
      setMode(modeParam)
    }
  }, [searchParams])
  
  const handleComplete = () => {
    navigate('/openings')
  }
  
  const handleAbandon = () => {
    navigate('/openings')
  }

  const handleSkipLearning = () => {
    // Switch to repertoire mode after learning
    navigate(`/openings/train/${eco}?mode=repertoire`)
  }
  
  if (!opening) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Chargement...</div>
      </div>
    )
  }

  // Render Learning mode
  if (mode === 'learning') {
    return (
      <div className="py-4">
        <OpeningLearner
          opening={opening}
          onComplete={handleSkipLearning}
          onSkip={handleSkipLearning}
        />
      </div>
    )
  }
  
  // Render Training mode (repertoire or recognition)
  return (
    <div className="py-4">
      <OpeningTrainer
        opening={opening}
        mode={mode}
        onComplete={handleComplete}
        onAbandon={handleAbandon}
      />
    </div>
  )
}
