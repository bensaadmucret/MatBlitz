import { Chess } from 'chess.js'

const challenges = [
  { id: 'spartacus-001', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', title: 'Défends le mat du berger', goal: 'survive' },
  { id: 'spartacus-002', fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', title: 'Le mat du couloir', solution: ['a8a1'] },
  { id: 'spartacus-003', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', title: 'Le couloir fatal', solution: ['e1e8'] },
  { id: 'spartacus-004', fen: '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', title: 'Dame fatale', solution: ['d1d8'] },
  { id: 'spartacus-005', fen: '7k/5ppp/8/8/8/8/8/R6K w - - 0 1', title: 'Tour et roi', solution: ['a1a8'] },
  { id: 'spartacus-006', fen: 'k7/8/1K6/8/8/8/8/3R4 w - - 0 1', title: 'Roi + Tour — mat en 1', solution: ['d1d8'] },
  { id: 'spartacus-007', fen: '8/8/8/8/8/1K6/1Q6/3k4 w - - 0 1', title: 'Le mat du coin', solution: ['b2e2', 'd1c1', 'e2e1'] },
  { id: 'spartacus-008', fen: '4k3/8/4K3/8/8/8/8/4R3 w - - 0 1', title: 'Roi + Tour contre Roi' },
  { id: 'spartacus-009', fen: 'r5k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', title: 'Tour gratuite' },
  { id: 'spartacus-010', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 4', title: 'Défense des deux cavaliers', goal: 'survive' },
  { id: 'spartacus-011', fen: 'r3k2r/ppp2ppp/2n5/3qp3/3P4/2P2N2/PP3PPP/R2QKB1R w KQkq - 0 1', title: 'Position complexe', goal: 'survive' },
  { id: 'spartacus-012', fen: 'r1bq1b1r/ppp2kpp/2n5/3np3/2B5/8/PPPP1PPP/RNBQK2R w KQ - 0 7', title: 'L\'attaque du foie frit', solution: ['d1f3'] },
]

let errors = 0

for (const c of challenges) {
  let game
  try {
    game = new Chess(c.fen)
  } catch (e) {
    console.log(`❌ ${c.id} "${c.title}" — INVALID FEN: ${e.message}`)
    errors++
    continue
  }

  const turn = game.turn() === 'w' ? 'blancs' : 'noirs'

  if (game.isCheckmate()) {
    console.log(`❌ ${c.id} "${c.title}" — ALREADY checkmate`)
    errors++
    continue
  }
  if (game.isStalemate()) {
    console.log(`❌ ${c.id} "${c.title}" — ALREADY stalemate`)
    errors++
    continue
  }

  if (c.solution) {
    const testGame = new Chess(c.fen)
    let valid = true
    let lastSan = ''
    for (const uci of c.solution) {
      try {
        const move = testGame.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length === 5 ? uci[4] : 'q',
        })
        if (!move) { valid = false; break }
        lastSan = move.san
      } catch {
        valid = false
        break
      }
    }
    if (!valid) {
      console.log(`❌ ${c.id} "${c.title}" — solution INVALID`)
      errors++
    } else {
      const isMate = testGame.isCheckmate()
      const isCheck = testGame.inCheck()
      const tag = isMate ? '✅ MATE' : isCheck ? '✅ check' : '⚠️ no check'
      console.log(`${tag} ${c.id} "${c.title}" (${turn}) — ${lastSan}`)
    }
  } else {
    console.log(`✅ ${c.id} "${c.title}" (${turn}) — OK`)
  }
}

console.log(`\n${errors === 0 ? '✅' : '❌'} ${challenges.length} validated, ${errors} errors`)
process.exit(errors > 0 ? 1 : 0)
