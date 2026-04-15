/**
 * Verify and fix all Lichess puzzles.
 * 
 * Key insight: Lichess puzzle format has solution[0] = opponent's setup move.
 * The FEN shows the position BEFORE the opponent plays.
 * After opponent plays solution[0], it's the player's turn to find the correct response.
 * 
 * This script:
 *  1. Plays each solution with opponent-first logic
 *  2. Verifies the solution ends in checkmate by the player
 *  3. Fixes category to match actual player move count
 *  4. Drops puzzles that don't end in player checkmate
 *  5. Rewrites solution in player-first format (compatible with PuzzleBoard)
 *     by stripping the opponent's first move and adjusting the FEN
 * 
 * Usage: node scripts/verify-and-fix-puzzles.mjs
 */

import { Chess } from 'chess.js'
import { readFileSync, writeFileSync } from 'fs'

const raw = JSON.parse(readFileSync('src/data/lichess-puzzles.json', 'utf8'))
console.log('\n🔍 Verifying ' + raw.length + ' Lichess puzzles (opponent-first format)...\n')

let valid = 0
let categoryFixed = 0
let invalid = 0
const validPuzzles = []
const errors = []
const errorReasons = {}

for (const puzzle of raw) {
  const game = new Chess(puzzle.fen)

  // Check sideToMove matches FEN
  const fenTurn = game.turn() === 'w' ? 'white' : 'black'
  if (puzzle.sideToMove !== fenTurn) {
    invalid++
    errorReasons['wrongSide'] = (errorReasons['wrongSide'] || 0) + 1
    errors.push({ id: puzzle.id, reason: 'wrongSide', details: 'sideToMove=' + puzzle.sideToMove + ' but FEN says ' + fenTurn })
    continue
  }

  // Play through solution (opponent first)
  const gameCopy = new Chess(puzzle.fen)
  let playerMoves = 0
  let isPlayerTurn = false // solution[0] = opponent
  let puzzleOk = true
  let failReason = ''
  let failDetails = ''

  for (let i = 0; i < puzzle.solution.length; i++) {
    const moveStr = puzzle.solution[i]
    try {
      const move = gameCopy.move(moveStr)
      if (!move) {
        failReason = 'illegalMove'
        failDetails = 'Move ' + (i + 1) + ' "' + moveStr + '" is illegal'
        puzzleOk = false
        break
      }

      if (isPlayerTurn) playerMoves++
      isPlayerTurn = !isPlayerTurn

      if (gameCopy.isCheckmate()) {
        if (i !== puzzle.solution.length - 1) {
          failReason = 'earlyCheckmate'
          failDetails = 'Checkmate at move ' + (i + 1) + ' but solution has ' + puzzle.solution.length + ' moves'
          puzzleOk = false
          break
        }

        // Last move: odd index = player (since opponent starts at index 0)
        const lastMoveByPlayer = (i % 2 === 1)
        if (!lastMoveByPlayer) {
          failReason = 'opponentCheckmate'
          failDetails = 'Opponent delivers checkmate'
          puzzleOk = false
          break
        }

        valid++
        // Fix category if needed
        const expectedCat = 'mat-en-' + playerMoves
        const expectedDiff = playerMoves
        if (puzzle.category !== expectedCat || puzzle.difficulty !== expectedDiff) {
          categoryFixed++
        }

        // Convert to player-first format for PuzzleBoard compatibility:
        // - Apply opponent's first move to FEN to get the "player's turn" position
        // - Strip the first move from the solution
        // Now solution[0] = player's move, which matches PuzzleBoard logic
        const newGame = new Chess(puzzle.fen)
        const opponentFirstMove = newGame.move(puzzle.solution[0])
        const newFen = newGame.fen()
        const newSolution = puzzle.solution.slice(1)
        const newSideToMove = puzzle.sideToMove // unchanged, just the FEN context shifts

        validPuzzles.push({
          id: puzzle.id,
          fen: newFen,
          solution: newSolution,
          category: expectedCat,
          subcategory: puzzle.subcategory,
          difficulty: expectedDiff,
          sideToMove: newSideToMove,
          source: puzzle.source,
          exerciseNumber: puzzle.exerciseNumber,
          ...(puzzle.rating !== undefined ? { rating: puzzle.rating } : {}),
          ...(puzzle.themes ? { themes: puzzle.themes } : {}),
          ...(puzzle.lichessId ? { lichessId: puzzle.lichessId } : {}),
        })
        break
      }
    } catch (e) {
      failReason = 'illegalMove'
      failDetails = 'Move ' + (i + 1) + ' "' + moveStr + '" error: ' + e.message
      puzzleOk = false
      break
    }
  }

  if (!puzzleOk) {
    invalid++
    errorReasons[failReason] = (errorReasons[failReason] || 0) + 1
    errors.push({ id: puzzle.id, reason: failReason, details: failDetails })
  }

  const processed = valid + invalid
  if (processed % 500 === 0) {
    console.log('  Processed ' + processed + '/' + raw.length + '...')
  }
}

// Verify converted puzzles with player-first logic
console.log('\n🔍 Verifying converted puzzles (player-first format)...')
let verifyOk = 0
let verifyFail = 0
for (const p of validPuzzles) {
  const g = new Chess(p.fen)
  let ok = true
  for (let i = 0; i < p.solution.length; i++) {
    try {
      const m = g.move(p.solution[i])
      if (!m) { ok = false; break }
      if (g.isCheckmate() && i !== p.solution.length - 1) { ok = false; break }
    } catch (e) { ok = false; break }
  }
  if (ok && g.isCheckmate()) verifyOk++
  else verifyFail++
}
console.log('  Verified: ' + verifyOk + ' ok, ' + verifyFail + ' fail')

// Stats by category
const byCategory = {}
const byDifficulty = {}
for (const p of validPuzzles) {
  byCategory[p.category] = (byCategory[p.category] || 0) + 1
  byDifficulty[p.difficulty] = (byDifficulty[p.difficulty] || 0) + 1
}

console.log('\n📊 Results:')
console.log('  Total:        ' + raw.length)
console.log('  ✅ Valid:     ' + valid)
console.log('  🔧 Fixed:     ' + categoryFixed + ' (category corrected)')
console.log('  ❌ Invalid:   ' + invalid)
console.log('  Final pool:   ' + validPuzzles.length + ' puzzles')
console.log('\n  By category:')
for (const [cat, count] of Object.entries(byCategory).sort()) {
  console.log('    ' + cat + ': ' + count)
}
console.log('\n  By difficulty:')
for (const [diff, count] of Object.entries(byDifficulty).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log('    difficulty ' + diff + ': ' + count)
}

if (Object.keys(errorReasons).length > 0) {
  console.log('\n  Error breakdown:')
  for (const [reason, count] of Object.entries(errorReasons)) {
    console.log('    ' + reason + ': ' + count)
  }
}

if (errors.length > 0 && errors.length <= 50) {
  console.log('\n❌ Invalid puzzles:')
  for (const err of errors) {
    console.log('  ' + err.id + ': [' + err.reason + '] ' + err.details)
  }
} else if (errors.length > 50) {
  console.log('\n❌ Too many errors to display (' + errors.length + ')')
}

// Write fixed file
writeFileSync('src/data/lichess-puzzles.json', JSON.stringify(validPuzzles, null, 2) + '\n')
console.log('\n✅ Wrote ' + validPuzzles.length + ' puzzles to src/data/lichess-puzzles.json')
