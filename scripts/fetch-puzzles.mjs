#!/usr/bin/env node
/**
 * Fetch tactical puzzles from Lichess puzzle database (CC0 license).
 * Filters: rating >= 1800, tactical themes, high popularity.
 * Converts UCI moves to SAN using chess.js.
 * Outputs JSON in the app's Puzzle format.
 *
 * Usage: node scripts/fetch-puzzles.mjs [--count 500] [--min-rating 1800]
 */

import { Chess } from 'chess.js'
import { createWriteStream, readFileSync, existsSync } from 'fs'
import { pipeline } from 'stream/promises'
import { createInterface } from 'readline'
import { spawn } from 'child_process'

const args = process.argv.slice(2)
let maxCount = 500
let minRating = 1800

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) maxCount = parseInt(args[i + 1])
  if (args[i] === '--min-rating' && args[i + 1]) minRating = parseInt(args[i + 1])
}

const CSV_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
const CSV_FILE = 'scripts/lichess_db_puzzle.csv.zst'
const DECOMPRESSED_FILE = 'scripts/lichess_db_puzzle.csv'

// Tactical themes we want (Lichess theme names)
const TACTICAL_THEMES = new Set([
  'fork', 'pin', 'skewer', 'discoveredAttack', 'discoveredCheck',
  'doubleCheck', 'overloading', 'deflection', 'decoy', 'interference',
  'zwischenzug', 'zugzwang', 'xRayAttack', 'intermezzo',
  'sacrifice', 'queensideAttack', 'kingsideAttack',
  'attraction', 'clearance', 'demolition', 'mateIn1', 'mateIn2',
  'mateIn3', 'mateIn4', 'mateIn5', 'matingNet', 'anastasiaMate',
  'backRankMate', 'battery', 'bodenMate', 'doubleBishopMate',
  'smotheredMate', 'hookMate', 'lawnMowerMate', 'arabianMate',
  'grecoMate', 'philidorMate', 'pillowMate', 'queenRookMate',
  'queenMate', 'rookMate',
])

// Map difficulty from rating
function ratingToDifficulty(rating) {
  if (rating < 1500) return 1
  if (rating < 1800) return 2
  if (rating < 2100) return 3
  if (rating < 2400) return 4
  return 5
}

// Map themes to category
function themesToCategory(themes) {
  const themeSet = new Set(themes)
  if (themeSet.has('mateIn1')) return 'mat-en-1'
  if (themeSet.has('mateIn2')) return 'mat-en-2'
  if (themeSet.has('mateIn3')) return 'mat-en-3'
  if (themeSet.has('mateIn4')) return 'mat-en-4'
  if (themeSet.has('mateIn5') || themeSet.has('matingNet')) return 'mat-en-5'
  // Default: classify by length of solution
  return 'mat-en-2'
}

// Convert UCI moves to SAN using chess.js
function uciToSan(fen, uciMoves) {
  try {
    const game = new Chess(fen)
    const sanMoves = []
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length > 4 ? uci[4] : undefined
      const move = game.move({ from, to, promotion })
      if (!move) {
        console.error(`Invalid move: ${uci} in position ${fen}`)
        return null
      }
      sanMoves.push(move.san)
    }
    return sanMoves
  } catch (e) {
    console.error(`Error converting UCI to SAN: ${e.message}`)
    return null
  }
}

async function downloadFile(url, dest) {
  if (existsSync(dest)) {
    console.log(`File already exists: ${dest}`)
    return
  }
  console.log(`Downloading ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const fileStream = createWriteStream(dest)
  await pipeline(res.body, fileStream)
  console.log('Download complete.')
}

async function decompressZst(src, dest) {
  if (existsSync(dest)) {
    console.log(`Decompressed file already exists: ${dest}`)
    return
  }
  console.log(`Decompressing ${src}...`)
  return new Promise((resolve, reject) => {
    const zstd = spawn('zstd', ['-d', src, '-o', dest, '-f'])
    zstd.stderr.on('data', (data) => process.stderr.write(data))
    zstd.on('close', (code) => {
      if (code === 0) { console.log('Decompression complete.'); resolve() }
      else reject(new Error(`zstd exited with code ${code}`))
    })
  })
}

async function processPuzzles(csvFile, outputPath) {
  console.log(`Processing ${csvFile}... (max ${maxCount} puzzles, rating >= ${minRating})`)

  const { createReadStream } = await import('fs')
  const fileStream = createReadStream(csvFile)
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

  const puzzles = []
  let lineNum = 0
  let skipped = 0

  for await (const line of rl) {
    lineNum++
    if (lineNum === 1 && line.startsWith('PuzzleId')) continue // header

    const parts = line.split(',')
    if (parts.length < 8) { skipped++; continue }

    const [id, fen, movesStr, ratingStr, , popularityStr, , themesStr] = parts

    const rating = parseInt(ratingStr)
    const popularity = parseInt(popularityStr)
    if (isNaN(rating) || rating < minRating) { skipped++; continue }
    if (isNaN(popularity) || popularity < 80) { skipped++; continue } // only well-liked puzzles

    const themes = themesStr.split(' ')
    const hasTactical = themes.some(t => TACTICAL_THEMES.has(t))
    if (!hasTactical) { skipped++; continue }

    const uciMoves = movesStr.split(' ')
    const sanMoves = uciToSan(fen, uciMoves)
    if (!sanMoves) { skipped++; continue }

    // Determine side to move from FEN
    const sideToMove = fen.split(' ')[1] === 'w' ? 'white' : 'black'

    const difficulty = ratingToDifficulty(rating)

    puzzles.push({
      id: `lichess-${id}`,
      fen,
      solution: sanMoves,
      category: themesToCategory(themes),
      subcategory: 'lichess',
      difficulty,
      sideToMove,
      source: 'lichess',
      exerciseNumber: puzzles.length + 1,
      rating,
      themes,
      lichessId: id,
    })

    if (puzzles.length >= maxCount) break

    if (puzzles.length % 50 === 0) {
      console.log(`  Found ${puzzles.length}/${maxCount} puzzles (scanned ${lineNum} lines, skipped ${skipped})`)
    }
  }

  console.log(`Done! Found ${puzzles.length} puzzles (scanned ${lineNum} lines, skipped ${skipped})`)

  // Stats
  const byDiff = {}
  const byCat = {}
  for (const p of puzzles) {
    byDiff[p.difficulty] = (byDiff[p.difficulty] || 0) + 1
    byCat[p.category] = (byCat[p.category] || 0) + 1
  }
  console.log('By difficulty:', JSON.stringify(byDiff))
  console.log('By category:', JSON.stringify(byCat))

  const { writeFileSync } = await import('fs')
  writeFileSync(outputPath, JSON.stringify(puzzles, null, 2))
  console.log(`Written to ${outputPath}`)
}

async function main() {
  const outputPath = 'src/data/lichess-puzzles-hard.json'

  await downloadFile(CSV_URL, CSV_FILE)
  await decompressZst(CSV_FILE, DECOMPRESSED_FILE)
  await processPuzzles(DECOMPRESSED_FILE, outputPath)

  console.log('\n✅ Done! New puzzles written to', outputPath)
  console.log('To merge with existing puzzles, update src/data/index.ts')
}

main().catch(console.error)
