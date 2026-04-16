/**
 * Script to fetch chess openings from Lichess dataset
 * Run with: npx ts-node scripts/fetch-openings.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface RawOpening {
  eco: string
  name: string
  pgn: string
  uci: string
  epd: string
  'eco-volume': string
}

interface ProcessedOpening {
  eco: string
  name: string
  pgn: string
  uci: string
  epd: string
  volume: 'A' | 'B' | 'C' | 'D' | 'E'
  moves: string[]
}

function parsePGN(pgn: string): string[] {
  // Parse moves from PGN format like "1. e4 c5 2. Nf3 d6"
  const moves: string[] = []
  const tokens = pgn.split(/\s+/)
  
  for (const token of tokens) {
    // Skip move numbers (1., 2., etc.) and results
    if (/^\d+\.$/.test(token) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
      continue
    }
    // Skip variations in parentheses and comments in braces (simplified)
    if (!token.startsWith('(') && !token.startsWith('{')) {
      moves.push(token)
    }
  }
  
  return moves
}

async function fetchOpenings(): Promise<void> {
  console.log('Fetching chess openings dataset...')
  
  try {
    // Download the parquet file using huggingface datasets
    const response = await fetch(
      'https://datasets-server.huggingface.co/rows?dataset=Lichess%2Fchess-openings&config=default&split=train&offset=0&length=100'
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json() as { rows: Array<{ row: RawOpening }> }
    
    if (!data.rows || data.rows.length === 0) {
      throw new Error('No data received from API')
    }
    
    console.log(`Received ${data.rows.length} sample rows, fetching full dataset...`)
    
    // Fetch all rows in batches
    const allRows: RawOpening[] = []
    let offset = 0
    const batchSize = 100
    
    while (true) {
      const batchResponse = await fetch(
        `https://datasets-server.huggingface.co/rows?dataset=Lichess%2Fchess-openings&config=default&split=train&offset=${offset}&length=${batchSize}`
      )
      
      if (!batchResponse.ok) {
        break
      }
      
      const batchData = await batchResponse.json() as { rows: Array<{ row: RawOpening }> }
      
      if (!batchData.rows || batchData.rows.length === 0) {
        break
      }
      
      allRows.push(...batchData.rows.map(r => r.row))
      
      if (batchData.rows.length < batchSize) {
        break
      }
      
      offset += batchSize
      console.log(`Fetched ${allRows.length} openings...`)
    }
    
    console.log(`Total openings fetched: ${allRows.length}`)
    
    // Process openings
    const processed: ProcessedOpening[] = allRows.map(row => ({
      eco: row.eco,
      name: row.name,
      pgn: row.pgn,
      uci: row.uci,
      epd: row.epd,
      volume: row['eco-volume'] as 'A' | 'B' | 'C' | 'D' | 'E',
      moves: parsePGN(row.pgn)
    }))
    
    // Sort by ECO code
    processed.sort((a, b) => a.eco.localeCompare(b.eco))
    
    // Write to file
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'chess-openings.json')
    fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2))
    
    console.log(`✓ Saved ${processed.length} openings to src/data/chess-openings.json`)
    
    // Stats
    const byVolume: Record<string, number> = {}
    for (const op of processed) {
      byVolume[op.volume] = (byVolume[op.volume] || 0) + 1
    }
    
    console.log('\nBy volume:')
    for (const [vol, count] of Object.entries(byVolume)) {
      console.log(`  ${vol}: ${count} openings`)
    }
    
  } catch (error) {
    console.error('Error fetching openings:', error)
    console.log('\nFalling back to minimal dataset...')
    createMinimalDataset()
  }
}

function createMinimalDataset(): void {
  // Create a minimal dataset with common openings as fallback
  const minimal: ProcessedOpening[] = [
    {
      eco: 'B20',
      name: 'Sicilian Defense',
      pgn: '1. e4 c5',
      uci: 'e2e4 c7c5',
      epd: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
      volume: 'B',
      moves: ['e4', 'c5']
    },
    {
      eco: 'B90',
      name: 'Sicilian Defense: Najdorf Variation',
      pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6',
      uci: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6',
      epd: 'rnbqkb1r/1p3pp1/p2ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -',
      volume: 'B',
      moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']
    },
    {
      eco: 'C50',
      name: 'Italian Game',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4',
      uci: 'e2e4 e7e5 g1f3 b8c6 f1c4',
      epd: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
      volume: 'C',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']
    },
    {
      eco: 'C60',
      name: 'Ruy Lopez',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
      uci: 'e2e4 e7e5 g1f3 b8c6 f1b5',
      epd: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
      volume: 'C',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']
    },
    {
      eco: 'D35',
      name: 'Queen\'s Gambit Declined',
      pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6',
      uci: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6',
      epd: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -',
      volume: 'D',
      moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']
    },
    {
      eco: 'A04',
      name: 'Reti Opening',
      pgn: '1. Nf3',
      uci: 'g1f3',
      epd: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -',
      volume: 'A',
      moves: ['Nf3']
    }
  ]
  
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'chess-openings.json')
  fs.writeFileSync(outputPath, JSON.stringify(minimal, null, 2))
  
  console.log(`✓ Saved ${minimal.length} minimal openings to src/data/chess-openings.json`)
}

fetchOpenings()
