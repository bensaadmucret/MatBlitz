import { useRef, useCallback, useEffect, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { uciToSan, pvToSan, type MoveCoaching, classifyMove, formatEvaluation, evalBarPercentage } from '../utils/chessCoaching'

export interface StockfishResult {
  bestMove: string | null
  bestMoveSan: string | null
  scoreCp: number | null
  scoreMate: number | null
  depth: number
  pv: string[]
  pvSan: string[]
}

export interface StockfishHook {
  isReady: boolean
  isThinking: boolean
  lastResult: StockfishResult | null
  currentEval: { scoreCp: number | null; scoreMate: number | null; depth: number } | null
  requestMove: (fen: string, depth?: number, onResult?: (uci: string) => void) => void
  analyzePosition: (fen: string, depth?: number) => Promise<StockfishResult>
  getCoaching: (fenBefore: string, playerMove: { from: string; to: string; promotion?: string }, isCheck: boolean) => Promise<MoveCoaching>
  stop: () => void
  newGame: () => void
  formatEval: () => string
  evalPercent: () => number
}

export function useStockfish(): StockfishHook {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [lastResult, setLastResult] = useState<StockfishResult | null>(null)
  const [currentEval, setCurrentEval] = useState<{ scoreCp: number | null; scoreMate: number | null; depth: number } | null>(null)

  // Refs for callbacks (avoid stale closures)
  const bestMoveCallbackRef = useRef<((uci: string) => void) | null>(null)
  const analyzeResolveRef = useRef<((result: StockfishResult) => void) | null>(null)
  const lastInfoRef = useRef<{ scoreCp: number | null; scoreMate: number | null; depth: number; pv: string[] }>({
    scoreCp: null, scoreMate: null, depth: 0, pv: [],
  })
  const currentFenRef = useRef<string>('')

  useEffect(() => {
    // Load Stockfish directly as a worker — no wrapper
    // The lite single-threaded build works without CORS headers
    workerRef.current = new Worker('/stockfish-18-lite-single.js')

    workerRef.current.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : ''

      if (line === 'uciok') {
        workerRef.current?.postMessage('isready')
        return
      }

      if (line === 'readyok') {
        setIsReady(true)
        return
      }

      // Parse info lines: info depth N score cp X pv e2e4 e7e5...
      if (line.startsWith('info depth')) {
        const depthMatch = line.match(/depth (\d+)/)
        const scoreCpMatch = line.match(/score cp (-?\d+)/)
        const scoreMateMatch = line.match(/score mate (-?\d+)/)
        const pvMatch = line.match(/ pv (.+)/)

        if (depthMatch) {
          const info = {
            depth: parseInt(depthMatch[1]),
            scoreCp: scoreCpMatch ? parseInt(scoreCpMatch[1]) : null,
            scoreMate: scoreMateMatch ? parseInt(scoreMateMatch[1]) : null,
            pv: pvMatch ? pvMatch[1].split(' ') : [],
          }
          lastInfoRef.current = info
          setCurrentEval(info)
        }
        return
      }

      // Parse bestmove: bestmove e2e4 ponder e7e5
      if (line.startsWith('bestmove')) {
        setIsThinking(false)
        const parts = line.split(' ')
        const bestMove = parts[1] || '(none)'
        const uci = bestMove === '(none)' ? '' : bestMove

        // Build result
        const info = lastInfoRef.current
        const fen = currentFenRef.current
        const result: StockfishResult = {
          bestMove: uci || null,
          bestMoveSan: uci ? uciToSan(fen, uci) : null,
          scoreCp: info.scoreCp,
          scoreMate: info.scoreMate,
          depth: info.depth,
          pv: info.pv,
          pvSan: info.pv.length > 0 ? pvToSan(fen, info.pv) : [],
        }

        setLastResult(result)

        // Call the move callback (for AI moves in games)
        if (bestMoveCallbackRef.current) {
          bestMoveCallbackRef.current(uci)
          bestMoveCallbackRef.current = null
        }

        // Resolve analysis promise
        if (analyzeResolveRef.current) {
          analyzeResolveRef.current(result)
          analyzeResolveRef.current = null
        }
      }
    }

    workerRef.current.onerror = (e: ErrorEvent) => {
      console.error('Stockfish worker error:', e.message, e.filename, e.lineno)
    }

    // Init UCI
    workerRef.current.postMessage('uci')

    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const requestMove = useCallback((fen: string, depth?: number, onResult?: (uci: string) => void) => {
    if (!workerRef.current || !isReady) {
      console.warn('Stockfish not ready yet')
      return
    }
    setIsThinking(true)
    setCurrentEval(null)
    lastInfoRef.current = { scoreCp: null, scoreMate: null, depth: 0, pv: [] }
    currentFenRef.current = fen
    bestMoveCallbackRef.current = onResult || null

    workerRef.current.postMessage('stop')
    workerRef.current.postMessage(`position fen ${fen}`)
    workerRef.current.postMessage(`go depth ${depth || 12}`)
  }, [isReady])

  const analyzePosition = useCallback((fen: string, depth?: number): Promise<StockfishResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !isReady) {
        resolve({
          bestMove: null, bestMoveSan: null, scoreCp: null, scoreMate: null, depth: 0, pv: [], pvSan: [],
        })
        return
      }

      setIsThinking(true)
      setCurrentEval(null)
      lastInfoRef.current = { scoreCp: null, scoreMate: null, depth: 0, pv: [] }
      currentFenRef.current = fen
      analyzeResolveRef.current = resolve

      workerRef.current.postMessage('stop')
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${depth || 12}`)
    })
  }, [isReady])

  const getCoaching = useCallback(async (
    fenBefore: string,
    playerMove: { from: string; to: string; promotion?: string },
    isCheck: boolean,
  ): Promise<MoveCoaching> => {
    // 1. Analyze position before the move
    const beforeAnalysis = await analyzePosition(fenBefore, 12)

    // 2. Make the player's move and analyze the resulting position
    const gameAfter = new Chess(fenBefore)
    let playerSan = ''
    try {
      const move = gameAfter.move({
        from: playerMove.from as Square,
        to: playerMove.to as Square,
        promotion: playerMove.promotion || 'q',
      })
      if (!move) {
        return classifyMove('', null, null, null, false)
      }
      playerSan = move.san
    } catch {
      return classifyMove('', null, null, null, false)
    }

    const fenAfter = gameAfter.fen()
    const afterAnalysis = await analyzePosition(fenAfter, 12)

    // 3. Calculate eval from player's perspective
    const isWhiteToMoveBefore = fenBefore.includes(' w ')
    const isWhiteToMoveAfter = fenAfter.includes(' w ')

    const evalBefore = beforeAnalysis.scoreCp !== null
      ? (isWhiteToMoveBefore ? beforeAnalysis.scoreCp : -beforeAnalysis.scoreCp)
      : null
    const evalAfter = afterAnalysis.scoreCp !== null
      ? (isWhiteToMoveAfter ? afterAnalysis.scoreCp : -afterAnalysis.scoreCp)
      : null

    const evalBeforeMate = beforeAnalysis.scoreMate !== null && beforeAnalysis.scoreMate !== undefined
      ? (isWhiteToMoveBefore ? beforeAnalysis.scoreMate : -beforeAnalysis.scoreMate) * 1000
      : evalBefore
    const evalAfterMate = afterAnalysis.scoreMate !== null && afterAnalysis.scoreMate !== undefined
      ? (isWhiteToMoveAfter ? afterAnalysis.scoreMate : -afterAnalysis.scoreMate) * 1000
      : evalAfter

    return classifyMove(
      playerSan,
      beforeAnalysis.bestMoveSan,
      evalBeforeMate ?? null,
      evalAfterMate ?? null,
      isCheck,
    )
  }, [analyzePosition])

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop')
    setIsThinking(false)
  }, [])

  const newGame = useCallback(() => {
    workerRef.current?.postMessage('ucinewgame')
    workerRef.current?.postMessage('isready')
    setLastResult(null)
    setCurrentEval(null)
  }, [])

  const formatEval = useCallback(() => {
    if (currentEval) {
      return formatEvaluation(currentEval.scoreCp, currentEval.scoreMate)
    }
    if (lastResult) {
      return formatEvaluation(lastResult.scoreCp, lastResult.scoreMate)
    }
    return '0.0'
  }, [currentEval, lastResult])

  const evalPercent = useCallback(() => {
    if (currentEval) {
      return evalBarPercentage(currentEval.scoreCp, currentEval.scoreMate)
    }
    if (lastResult) {
      return evalBarPercentage(lastResult.scoreCp, lastResult.scoreMate)
    }
    return 50
  }, [currentEval, lastResult])

  return {
    isReady,
    isThinking,
    lastResult,
    currentEval,
    requestMove,
    analyzePosition,
    getCoaching,
    stop,
    newGame,
    formatEval,
    evalPercent,
  }
}
