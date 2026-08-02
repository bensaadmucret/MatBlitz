import { useRef, useCallback, useEffect } from 'react'
import { useAIStore, getDepthFromLevel } from '../stores/aiStore'

export function useChessEngine() {
  const workerRef = useRef<Worker | null>(null)
  const aiLevel = useAIStore(s => s.aiLevel)
  const makeAIMove = useAIStore(s => s.makeAIMove)
  const setThinking = useAIStore(s => s.setThinking)
  const setLastError = useAIStore(s => s.setLastError)

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/chessEngine.worker.ts', import.meta.url), { type: 'module' })

    workerRef.current.onmessage = (e: MessageEvent) => {
      const { type, move, evaluation } = e.data

      if (type === 'bestMove') {
        if (move) {
          makeAIMove(move)
        } else {
          setThinking(false)
          setLastError('No move found')
        }
      } else if (type === 'analysis') {
        // Handle analysis results (for adaptive mode)
        // Analysis is handled in the component via callbacks
        if (e.data.bestMove) {
          // Store analysis data
          const analysisEvent = new CustomEvent('chess-analysis', { detail: e.data })
          window.dispatchEvent(analysisEvent)
        }
      } else if (type === 'evaluation') {
        const evalEvent = new CustomEvent('chess-evaluation', { detail: { evaluation } })
        window.dispatchEvent(evalEvent)
      }
    }

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [makeAIMove, setThinking, setLastError])

  const requestAIMove = useCallback((fen: string, level?: number) => {
    if (!workerRef.current) return
    const depth = getDepthFromLevel((level || aiLevel) as 1 | 2 | 3 | 4 | 5)
    setThinking(true)
    workerRef.current.postMessage({ type: 'findBestMove', fen, depth })
  }, [aiLevel, setThinking])

  const requestAnalysis = useCallback((fen: string, level?: number) => {
    if (!workerRef.current) return
    const depth = getDepthFromLevel((level || aiLevel) as 1 | 2 | 3 | 4 | 5)
    workerRef.current.postMessage({ type: 'analyze', fen, depth })
  }, [aiLevel])

  const requestEvaluation = useCallback((fen: string) => {
    if (!workerRef.current) return
    workerRef.current.postMessage({ type: 'evaluateAfterMove', fen })
  }, [])

  return { requestAIMove, requestAnalysis, requestEvaluation }
}
