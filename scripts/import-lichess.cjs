#!/usr/bin/env node
/**
 * Import Lichess puzzles into MatBlitz format.
 * Reads CSV, filters by mate themes, converts UCI->SAN, outputs JSON.
 */
const { Chess } = require('chess.js');
const fs = require('fs');
const readline = require('readline');

const CSV_PATH = '/tmp/lichess_puzzles.csv';
const OUTPUT_PATH = __dirname + '/../src/data/lichess-puzzles.json';

const THEME_MAP = {
  mateIn1: 'mat-en-1',
  mateIn2: 'mat-en-2',
  mateIn3: 'mat-en-3',
  mateIn4: 'mat-en-4',
};

const TARGET = { mateIn1: 500, mateIn2: 500, mateIn3: 200, mateIn4: 100 };
const collected = { mateIn1: [], mateIn2: [], mateIn3: [], mateIn4: [] };

function ratingToDifficulty(r) {
  if (r < 1000) return 1;
  if (r < 1400) return 2;
  if (r < 1800) return 3;
  return 4;
}

function uciToSan(fen, uciMoves) {
  try {
    const game = new Chess(fen);
    const sanMoves = [];
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = game.move({ from, to, promotion });
      if (!move) return null;
      sanMoves.push(move.san);
    }
    return { san: sanMoves, checkmate: game.isCheckmate() };
  } catch (e) {
    return null;
  }
}

async function main() {
  const stream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let total = 0;
  let imported = 0;
  let errors = 0;
  let header = true;

  for await (const line of rl) {
    if (header) { header = false; continue; }
    total++;

    // Simple CSV parse (fields may not contain commas in our relevant fields)
    const parts = line.split(',');
    if (parts.length < 8) continue;

    const puzzleId = parts[0];
    const fen = parts[1];
    const moves = parts[2];
    const rating = parseInt(parts[3]);
    const popularity = parseInt(parts[6]);
    const themes = parts[7];

    if (!themes) continue;

    // Find mate theme
    let mateTheme = null;
    for (const t of themes.split(' ')) {
      if (THEME_MAP[t]) { mateTheme = t; break; }
    }
    if (!mateTheme) continue;
    if (collected[mateTheme].length >= TARGET[mateTheme]) continue;
    if (popularity < 80) continue;
    if (rating < 600 || rating > 2200) continue;

    // Convert moves
    const uciMoves = moves.split(' ');
    const result = uciToSan(fen, uciMoves);
    if (!result || !result.checkmate) { errors++; continue; }

    const sideToMove = fen.includes(' w ') ? 'white' : 'black';

    collected[mateTheme].push({
      id: `lichess-${puzzleId}`,
      fen,
      solution: result.san,
      category: THEME_MAP[mateTheme],
      subcategory: 'lichess',
      difficulty: ratingToDifficulty(rating),
      sideToMove,
      source: 'lichess',
      exerciseNumber: imported + 1,
      rating,
      themes: themes.split(' '),
      lichessId: puzzleId,
      lichessUrl: `https://lichess.org/training/${puzzleId}`,
    });

    imported++;

    if (imported % 200 === 0) {
      console.log(`  ${imported} imported (m1:${collected.mateIn1.length} m2:${collected.mateIn2.length} m3:${collected.mateIn3.length} m4:${collected.mateIn4.length})`);
    }

    if (Object.keys(TARGET).every(k => collected[k].length >= TARGET[k])) {
      console.log('All targets met!');
      break;
    }
  }

  // Combine and sort
  const all = [
    ...collected.mateIn1,
    ...collected.mateIn2,
    ...collected.mateIn3,
    ...collected.mateIn4,
  ].sort((a, b) => a.difficulty - b.difficulty || a.rating - b.rating);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2));

  console.log(`\n✅ Done! ${imported} puzzles imported, ${errors} errors, ${total} rows scanned`);
  console.log(`   mateIn1: ${collected.mateIn1.length}`);
  console.log(`   mateIn2: ${collected.mateIn2.length}`);
  console.log(`   mateIn3: ${collected.mateIn3.length}`);
  console.log(`   mateIn4: ${collected.mateIn4.length}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
}

main().catch(console.error);
