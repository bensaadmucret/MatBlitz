import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { OpeningTrainer, OpeningLearner } from '../components/openings'
import { useOpeningsStore } from '../stores/openingsStore'
import type { OpeningMode } from '../types'

export function OpeningTrainPage() {
  const { eco } = useParams<{ eco: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { openings, loadOpenings } = useOpeningsStore()
  const mode: OpeningMode = (() => {
    const modeParam = searchParams.get('mode') as OpeningMode
    if (modeParam === 'repertoire' || modeParam === 'recognition' || modeParam === 'learning') return modeParam
    return 'repertoire'
  })()

  useEffect(() => {
    loadOpenings()
  }, [loadOpenings])
  
  const opening = useMemo(() => {
    if (!eco || openings.length === 0) return null
    const [ecoCode, indexStr] = eco.split('-')
    const index = indexStr ? parseInt(indexStr) : -1
    const matchingOpenings = openings.filter(o => o.eco === ecoCode)
    if (index >= 0 && index < matchingOpenings.length) return matchingOpenings[index]
    if (matchingOpenings.length > 0) return matchingOpenings[0]
    return null
  }, [eco, openings])
  
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
