import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout'
import { HomePage, PlayPage, PuzzlesPage, StatsPage, BadgesPage, SettingsPage, OpeningsPage, OpeningTrainPage } from './pages'
import { initDB } from './db'
import { useGameStore } from './stores/gameStore'
import './index.css'

export function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadFromDB = useGameStore(s => s.loadFromDB)

  useEffect(() => {
    async function init() {
      try {
        await initDB()
        await loadFromDB()
        setReady(true)
      } catch (e) {
        console.error('DB init failed:', e)
        setError(String(e))
        setReady(true) // Still show app, just without DB
      }
    }
    init()
  }, [loadFromDB])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-lg font-semibold combo-gradient">MatBlitz</div>
          <div className="text-sm text-text-muted mt-2">Chargement...</div>
        </div>
      </div>
    )
  }

  if (error) {
    console.warn('Running without SQLite, using fallback')
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="play" element={<PlayPage />} />
          <Route path="openings" element={<OpeningsPage />} />
          <Route path="openings/train/:eco" element={<OpeningTrainPage />} />
          <Route path="puzzles" element={<PuzzlesPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="badges" element={<BadgesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
