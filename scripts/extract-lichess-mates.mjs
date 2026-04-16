/**
 * Extract mate puzzles from the Lichess puzzle CSV database.
 * 
 * Filters for puzzles with mate themes (mateIn1, mateIn2, mateIn3, mateIn4, mateIn5)
 * Converts to MatBlitz format with player-first solutions.
 * 
 * Usage: node scripts/extract-lichess-mates.mjs
 * 
 * Input: data/lichess_db_puzzle.csv (download from https://database.lichess.org/#puzzles)
 * Output: src/data/lichess-puzzles.json
 */

import { Chess } from 'chess.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

const CSV_PATH = 'data/lichess_db_puzzle.csv'

if (!existsSync(CSV_PATH)) {
  console.error('CSV not found at ' + CSV_PATH)
  console.error('Download from https://database.lichess.org/#puzzles')
  process.exit(1)
}

// Target counts per category (total ~5000 puzzles)
const TARGETS = {
  'mateIn1': 1500,
  'mateIn2': 1500,
  'mateIn3': 1000,
  'mateIn4': 800,
  'mateIn5': 200,
}

const RATING_RANGE = { min: 600, max: 2200 }  // accessible puzzles
const MIN_POPULARITY = 80  // only well-liked puzzles

const collected = {}
for (const key of Object.keys(TARGETS)) {
  collected[key] = []
}

console.log('Reading Lichess puzzle CSV...')
console.log('Targets:', JSON.stringify(TARGETS))
console.log('Rating range:', RATING_RANGE.min, '-', RATING_RANGE.max)
console.log('Min popularity:', MIN_POPULARITY)
console.log()

let totalLines = 0
let matePuzzles = 0
let validPuzzles = 0
let failedPuzzles = 0

async function processCSV() {
  const fileStream = createReadStream(CSV_PATH)
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let header = true
  for await (const line of rl) {
    if (header) { header = false; continue }
    totalLines++

    if (totalLines % 500000 === 0) {
      console.log('  Processed ' + totalLines + ' lines, found ' + matePuzzles + ' mate puzzles, validated ' + validPuzzles + '...')
    }

    // Parse CSV line (simple split - themes may contain commas but they're quoted)
    // Format: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
    const parts = line.split(',')
    if (parts.length < 8) continue

    const puzzleId = parts[0]
    const fen = parts[1]
    const moves = parts[2]
    const rating = parseInt(parts[3])
    const popularity = parseInt(parts[5])
    const themesStr = parts.slice(7, parts.length - 2).join(',')  // themes may have commas
    const themes = themesStr.replace(/"/g, '').split(' ')

    // Filter: must have a mateInN theme
    const mateTheme = themes.find(t => t.match(/^mateIn[1-5]$/))
    if (!mateTheme) continue

    // Filter: check target not full
    if (collected[mateTheme] && collected[mateTheme].length >= TARGETS[mateTheme]) continue

    // Filter: rating and popularity
    if (rating < RATING_RANGE.min || rating > RATING_RANGE.max) continue
    if (popularity < MIN_POPULARITY) continue

    matePuzzles++

    // Parse moves: "e2e4 e7e5 ..." format
    const moveStrs = moves.split(' ')
    if (moveStrs.length < 2) continue  // need at least opponent setup + player move

    // Lichess format: moves[0] is the opponent's setup move
    // Convert to player-first: play opponent's first move, get new FEN, strip from solution
    try {
      const game = new Chess(fen)

      // Play opponent's setup move
      const oppMove = game.move({
        from: moveStrs[0].substring(0, 2),
        to: moveStrs[0].substring(2, 4),
        promotion: moveStrs[0].length > 4 ? moveStrs[0][4] : undefined,
      })
      if (!oppMove) continue

      const playerFen = game.fen()
      const playerMoves = moveStrs.slice(1)  // remaining moves in coordinate format

      // Convert to SAN for the solution
      const sanMoves = []
      const verifyGame = new Chess(playerFen)
      let playerMoveCount = 0
      let isPlayerTurn = true
      let valid = true

      for (const coordMove of playerMoves) {
        try {
          const m = verifyGame.move({
            from: coordMove.substring(0, 2),
            to: coordMove.substring(2, 4),
            promotion: coordMove.length > 4 ? coordMove[4] : undefined,
          })
          if (!m) { valid = false; break }

          sanMoves.push(m.san)
          if (isPlayerTurn) playerMoveCount++
          isPlayerTurn = !isPlayerTurn

          // Check for checkmate
          if (verifyGame.isCheckmate()) {
            // Verify: the mating move was by the player
            if (!isPlayerTurn) {  // just flipped, so the last move was by the player
              valid = true
            } else {
              valid = false
            }
            break
          }
        } catch (e) {
          valid = false
          break
        }
      }

      if (!valid || !verifyGame.isCheckmate()) {
        failedPuzzles++
        continue
      }

      // Determine category from player move count
      const category = 'mat-en-' + playerMoveCount
      const difficulty = playerMoveCount
      const sideToMove = fen.includes(' w ') ? 'white' : 'black'

      // After opponent's first move, it's the player's turn
      // The player is the side that WASN'T to move in the original FEN
      const playerSide = fen.includes(' w ') ? 'black' : 'white'

      const puzzle = {
        id: 'lichess-' + puzzleId,
        fen: playerFen,
        solution: sanMoves,
        category: category,
        subcategory: 'lichess',
        difficulty: Math.min(difficulty, 5),
        sideToMove: playerSide,
        source: 'lichess',
        exerciseNumber: collected[mateTheme] ? collected[mateTheme].length + 1 : 1,
        rating: rating,
        themes: themes.filter(t => !t.startsWith('mateIn') && t !== 'mate' && t !== 'oneMove' && t !== 'short' && t !== 'long'),
        lichessId: puzzleId,
      }

      collected[mateTheme].push(puzzle)
      validPuzzles++
    } catch (e) {
      failedPuzzles++
      continue
    }

    // Check if all targets are met
    const allFull = Object.entries(TARGETS).every(([theme, target]) => collected[theme].length >= target)
    if (allFull) {
      console.log('All targets met!')
      break
    }
  }

  return totalLines
}

await processCSV()

// Combine all collected puzzles
const allPuzzles = []
for (const [theme, puzzles] of Object.entries(collected)) {
  console.log(theme + ': ' + puzzles.length + ' puzzles')
  allPuzzles.push(...puzzles)
}

// Add existing manual puzzles
const manualPuzzles = JSON.parse(readFileSync('src/data/puzzles.json', 'utf8'))
console.log('Manual puzzles: ' + manualPuzzles.length)

// Final combined set
const finalPuzzles = [...manualPuzzles, ...allPuzzles]
console.log('\nTotal puzzles: ' + finalPuzzles.length)

// Stats by category
const byCategory = {}
for (const p of finalPuzzles) {
  byCategory[p.category] = (byCategory[p.category] || 0) + 1
}
console.log('\nBy category:')
for (const [cat, count] of Object.entries(byCategory).sort()) {
  console.log('  ' + cat + ': ' + count)
}

// Write output (Lichess puzzles only, manual kept separate)
writeFileSync('src/data/lichess-puzzles.json', JSON.stringify(allPuzzles, null, 2) + '\n')
console.log('\n✅ Wrote ' + allPuzzles.length + ' Lichess puzzles to src/data/lichess-puzzles.json')

// Stats
console.log('\n📊 Summary:')
console.log('  CSV lines processed: ' + totalLines)
console.log('  Mate puzzles found: ' + matePuzzles)
console.log('  Validated: ' + validPuzzles)
console.log('  Failed: ' + failedPuzzles)
