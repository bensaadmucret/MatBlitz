import { useCallback, useRef, useState } from 'react'
import type { TimerMode } from '../types'

const BLITZ_TIME: Record<number, number> = { 1: 15, 2: 30, 3: 60, 4: 90, 5: 120 }
const SURVIVAL_BASE = 60

export function useTimer(mode: TimerMode, difficulty: number = 1) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  
  const start = useCallback(() => {
    startRef.current = performance.now()
    setIsRunning(true)
    
    if (mode === 'blitz') {
      setTimeRemaining(BLITZ_TIME[difficulty] * 1000)
    } else if (mode === 'survival') {
      setTimeRemaining(prev => prev ?? SURVIVAL_BASE * 1000)
    } else {
      setTimeRemaining(null)
    }
    
    const tick = () => {
      if (!startRef.current) return
      const now = performance.now()
      const elapsed = now - startRef.current
      setElapsedMs(elapsed)
      
      if (mode === 'blitz' || mode === 'survival') {
        setTimeRemaining(prev => {
          if (prev === null) return null
          const newRemaining = prev - 16.67
          if (newRemaining <= 0) {
            setIsRunning(false)
            return 0
          }
          return newRemaining
        })
      }
      
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [mode, difficulty])
  
  const stop = useCallback(() => {
    setIsRunning(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (startRef.current) {
      setElapsedMs(performance.now() - startRef.current)
    }
  }, [])
  
  const addTime = useCallback((ms: number) => {
    if (mode === 'survival') {
      setTimeRemaining(prev => (prev !== null ? prev + ms : null))
    }
  }, [mode])
  
  const reset = useCallback(() => {
    setIsRunning(false)
    setElapsedMs(0)
    startRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    
    if (mode === 'blitz') {
      setTimeRemaining(BLITZ_TIME[difficulty] * 1000)
    } else if (mode === 'survival') {
      setTimeRemaining(SURVIVAL_BASE * 1000)
    } else {
      setTimeRemaining(null)
    }
  }, [mode, difficulty])
  
  return { elapsedMs, timeRemaining, isRunning, start, stop, addTime, reset }
}
