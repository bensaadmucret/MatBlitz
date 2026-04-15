/**
 * Vérifie tous les puzzles Lichess contre chess.js
 * - Identifie les puzzles dont la solution ne termine pas en mat
 * - Vérifie la cohérence category vs nombre de coups du joueur
 * - Corrige les catégories décalées
 * - Génère un nouveau fichier JSON propre
 * 
 * Usage: npx tsx scripts/verify-and-fix-puzzles.ts
 */

import { Chess } from 'chess.js'
import { readFileSync, writeFileSync } from 'fs'

interface RawPuzzle {
  id: string
  fen: string
  solution: string[]
  category: string
  subcategory: string
  difficulty: number
  sideToMove: 'white' | 'black'
  source: string
  exerciseNumber: number
  rating?: number
  themes?: string[]
  lichessId?: string
}

interface Result {
  total: number
  valid: number
  invalid: number
  categoryFixed: number
  notCheckmate: number
  wrongSide: number
  illegalMove: number
  wrongCategory: number
  errors: { id: string; reason: string; details: string }[]
}

function verifyPuzzle(puzzle: RawPuzzle): { valid: boolean; reason: string; details: string; playerMoves: number } {
  const game = new Chess(puzzle.fen)

  // Check sideToMove matches FEN
  const fenTurn = game.turn() === 'w' ? 'white' : 'black'
  if (puzzle.sideToMove !== fenTurn) {
    return { valid: false, reason: 'wrongSide', details: `sideToMove=${puzzle.sideToMove} but FEN says ${fenTurn}`, playerMoves: 0 }
  }

  // Play through solution
  const gameCopy = new Chess(puzzle.fen)
  let playerMoves = 0
  let isPlayerTurn = true // solution[0] is the player's move

  for (let i = 0; i < puzzle.solution.length; i++) {
    const moveStr = puzzle.solution[i]
    try {
      const move = gameCopy.move(moveStr)
      if (!move) {
        return { valid: false, reason: 'illegalMove', details: `Move ${i + 1} "${moveStr}" is illegal from ${gameCopy.fen()}`, playerMoves }
      }

      if (isPlayerTurn) playerMoves++
      isPlayerTurn = !isPlayerTurn

      // Check for checkmate
      if (gameCopy.isCheckmate()) {
        // Last move should deliver checkmate
        if (i !== puzzle.solution.length - 1) {
          return { valid: false, reason: 'earlyCheckmate', details: `Checkmate at move ${i + 1} but solution has ${puzzle.solution.length} moves`, playerMoves }
        }

        // Check: who delivered checkmate? It should be the player
        const matingSide = i % 2 === 0 ? puzzle.sideToMove : (puzzle.sideToMove === 'white' ? 'black' : 'white')
        if (matingSide !== puzzle.sideToMove) {
          return { valid: false, reason: 'opponentCheckmate', details: `Opponent delivers checkmate, not the player`, playerMoves }
        }

        // Check category matches playerMoves
        const expectedCat = `mat-en-${playerMoves}`
        if (puzzle.category !== expectedCat) {
          return { valid: false, reason: 'wrongCategory', details: `Category=${puzzle.category} but player makes ${playerMoves} moves (should be ${expectedCat})`, playerMoves }
        }

        return { valid: true, reason: '', details: '', playerMoves }
      }
    } catch (e) {
      return { valid: false, reason: 'illegalMove', details: `Move ${i + 1} "${moveStr}" error: ${e}`, playerMoves }
    }
  }

  // Solution exhausted without checkmate
  return { valid: false, reason: 'notCheckmate', details: `Solution has ${puzzle.solution.length} moves but no checkmate`, playerMoves }
}

// Main
const raw = JSON.parse(readFileSync('src/data/lichess-puzzles.json', 'utf8')) as RawPuzzle[]
console.log(`\n🔍 Verifying ${raw.length} Lichess puzzles...\n`)

const result: Result = {
  total: raw.length,
  valid: 0,
  invalid: 0,
  categoryFixed: 0,
  notCheckmate: 0,
  wrongSide: 0,
  illegalMove: 0,
  wrongCategory: 0,
  errors: [],
}

const fixed: RawPuzzle[] = []
const validPuzzles: RawPuzzle[] = []

for (const puzzle of raw) {
  const check = verifyPuzzle(puzzle)

  if (check.valid) {
    result.valid++
    validPuzzles.push(puzzle)
  } else {
    result.invalid++

    if (check.reason === 'wrongCategory') {
      // Fix category
      const correctCategory = `mat-en-${check.playerMoves}` as RawPuzzle['category']
      const correctDifficulty = check.playerMoves as RawPuzzle['difficulty']
      const fixedPuzzle = { ...puzzle, category: correctCategory, difficulty: correctDifficulty }
      validPuzzles.push(fixedPuzzle)
      result.categoryFixed++
    } else {
      result.errors.push({ id: puzzle.id, reason: check.reason, details: check.details })

      switch (check.reason) {
        case 'notCheckmate': result.notCheckmate++; break
        case 'wrongSide': result.wrongSide++; break
        case 'illegalMove': result.illegalMove++; break
      }
    }
  }

  if ((result.valid + result.invalid) % 500 === 0) {
    console.log(`  Processed ${result.valid + result.invalid}/${result.total}...`)
  }
}

// Stats by category
const byCategory: Record<string, number> = {}
for (const p of validPuzzles) {
  byCategory[p.category] = (byCategory[p.category] || 0) + 1
}

console.log(`\n📊 Results:`)
console.log(`  Total:     ${result.total}`)
console.log(`  ✅ Valid:  ${result.valid}`)
console.log(`  🔧 Fixed:  ${result.categoryFixed} (category corrected)`)
console.log(`  ❌ Invalid: ${result.invalid - result.categoryFixed}`)
console.log(`  Final pool: ${validPuzzles.length} puzzles`)
console.log(`\n  By category:`)
for (const [cat, count] of Object.entries(byCategory).sort()) {
  console.log(`    ${cat}: ${count}`)
})

if (result.errors.length > 0) {
  console.log(`\n❌ Invalid puzzles (${result.errors.length}):`)
  for (const err of result.errors.slice(0, 30)) {
    console.log(`  ${err.id}: [${err.reason}] ${err.details}`)
  }
  if (result.errors.length > 30) {
    console.log(`  ... and ${result.errors.length - 30} more`)
  }
}

// Write fixed file
const output = JSON.stringify(validPuzzles, null, 2)
writeFileSync('src/data/lichess-puzzles.json', output + '\n')
console.log(`\n✅ Wrote ${validPuzzles.length} puzzles to src/data/lichess-puzzles.json`)
