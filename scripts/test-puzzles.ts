import { Chess } from 'chess.js'
import lichessPuzzles from '../src/data/lichess-puzzles.json'
import type { Puzzle } from '../src/types'

const allPuzzles: Puzzle[] = lichessPuzzles as unknown as Puzzle[]

interface TestResult {
  id: string
  valid: boolean
  errors: string[]
}

function testPuzzle(puzzle: Puzzle): TestResult {
  const errors: string[] = []

  try {
    // Test 1: FEN valide
    const game = new Chess(puzzle.fen)

    // Test 2: Solution complète
    const turn = game.turn()
    if (puzzle.sideToMove === 'white' && turn !== 'w') {
      errors.push(`sideToMove white mais FEN indique noir`)
    }
    if (puzzle.sideToMove === 'black' && turn !== 'b') {
      errors.push(`sideToMove black mais FEN indique blanc`)
    }

    // Test 3: Chaque coup de la solution
    const gameCopy = new Chess(puzzle.fen)
    for (let i = 0; i < puzzle.solution.length; i++) {
      const move = puzzle.solution[i]
      const isLastMove = i === puzzle.solution.length - 1

      try {
        const result = gameCopy.move(move)
        if (!result) {
          errors.push(`Coup ${i + 1} "${move}" est illégal`)
          break
        }

        // Vérifier mat sur le dernier coup
        if (isLastMove && !gameCopy.isCheckmate()) {
          errors.push(`Dernier coup "${move}" ne donne pas mat`)
        }

      } catch (e) {
        errors.push(`Coup ${i + 1} "${move}" erreur: ${e}`)
        break
      }
    }

  } catch (e) {
    errors.push(`FEN invalide: ${puzzle.fen}`)
  }

  return {
    id: puzzle.id,
    valid: errors.length === 0,
    errors
  }
}

console.log(`🧩 Test de ${allPuzzles.length} puzzles...\n`)

let passed = 0
let failed = 0
const failedIds: string[] = []

for (const puzzle of allPuzzles) {
  const result = testPuzzle(puzzle)
  if (result.valid) {
    passed++
    // Afficher progress tous les 100
    if (passed % 500 === 0) {
      console.log(`✅ ${passed} puzzles vérifiés...`)
    }
  } else {
    failed++
    failedIds.push(puzzle.id)
    console.log(`\n❌ ${puzzle.id} (${puzzle.category})`)
    for (const error of result.errors) {
      console.log(`   → ${error}`)
    }
  }
}

console.log(`\n📊 Résultat final:`)
console.log(`   ✅ ${passed} puzzles valides`)
console.log(`   ❌ ${failed} puzzles avec erreurs`)
console.log(`   📈 ${((passed / allPuzzles.length) * 100).toFixed(1)}% de réussite`)

if (failed > 0) {
  console.log(`\n📝 IDs en erreur: ${failedIds.slice(0, 10).join(', ')}${failedIds.length > 10 ? '...' : ''}`)
  process.exit(1)
} else {
  console.log('\n🎉 Tous les puzzles sont valides !')
}
