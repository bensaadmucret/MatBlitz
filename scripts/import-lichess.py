#!/usr/bin/env python3
"""
Import Lichess puzzles into MatBlitz format.
Filters by mate themes, converts UCI to SAN, validates with chess.js equivalent.
"""

import csv
import json
import subprocess
import sys
import os

# Theme mapping from Lichess to MatBlitz categories
THEME_MAP = {
    'mateIn1': 'mat-en-1',
    'mateIn2': 'mat-en-2',
    'mateIn3': 'mat-en-3',
    'mateIn4': 'mat-en-4',
}

# Difficulty based on rating
def rating_to_difficulty(rating):
    if rating < 1000:
        return 1
    elif rating < 1400:
        return 2
    elif rating < 1800:
        return 3
    else:
        return 4

# Convert UCI moves to SAN using chess.js via Node
def uci_to_san(fen, uci_moves):
    """Use a Node.js subprocess to convert UCI to SAN with chess.js"""
    try:
        input_data = json.dumps({"fen": fen, "moves": uci_moves})
        result = subprocess.run(
            ['node', '-e', '''
const { Chess } = require('chess.js');
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
try {
  const game = new Chess(data.fen);
  const sanMoves = [];
  for (const uci of data.moves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = game.move({ from, to, promotion });
    if (!move) {
      process.stdout.write(JSON.stringify({ error: "Invalid move: " + uci }));
      process.exit(0);
    }
    sanMoves.push(move.san);
  }
  const isCheckmate = game.isCheckmate();
  process.stdout.write(JSON.stringify({ san: sanMoves, checkmate: isCheckmate, finalFen: game.fen() }));
} catch(e) {
  process.stdout.write(JSON.stringify({ error: e.message }));
}
'''],
            input=input_data,
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.path.dirname(os.path.abspath(__file__)) + '/..'
        )
        return json.loads(result.stdout.strip())
    except Exception as e:
        return {"error": str(e)}

def main():
    csv_path = '/tmp/lichess_puzzles.csv'
    output_path = os.path.dirname(os.path.abspath(__file__)) + '/../src/data/lichess-puzzles.json'
    
    if not os.path.exists(csv_path):
        print(f"CSV not found at {csv_path}", file=sys.stderr)
        sys.exit(1)
    
    # Counters
    total = 0
    imported = 0
    errors = 0
    by_theme = {}
    
    # Target counts per theme
    TARGET = {
        'mateIn1': 500,
        'mateIn2': 500,
        'mateIn3': 200,
        'mateIn4': 100,
    }
    
    collected = {k: [] for k in TARGET}
    
    print("Reading Lichess puzzle database...")
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            
            themes = row.get('Themes', '')
            if not themes:
                continue
            
            theme_list = themes.split()
            
            # Find matching mate theme
            mate_theme = None
            for t in theme_list:
                if t in THEME_MAP:
                    mate_theme = t
                    break
            
            if not mate_theme:
                continue
            
            # Check if we already have enough
            if len(collected[mate_theme]) >= TARGET[mate_theme]:
                continue
            
            rating = int(row.get('Rating', 0))
            
            # Filter: only popular puzzles (popularity > 80) and reasonable rating
            popularity = int(row.get('Popularity', 0))
            if popularity < 80:
                continue
            if rating < 600 or rating > 2200:
                continue
            
            fen = row['FEN']
            uci_moves = row['Moves'].split()
            
            # Determine side to move from FEN
            side_to_move = 'white' if ' w ' in fen else 'black'
            
            # Convert to SAN
            result = uci_to_san(fen, uci_moves)
            if 'error' in result:
                errors += 1
                continue
            
            if not result.get('checkmate'):
                errors += 1
                continue
            
            difficulty = rating_to_difficulty(rating)
            
            puzzle = {
                'id': f"lichess-{row['PuzzleId']}",
                'fen': fen,
                'solution': result['san'],
                'category': THEME_MAP[mate_theme],
                'subcategory': 'lichess',
                'difficulty': difficulty,
                'sideToMove': side_to_move,
                'source': 'lichess',
                'exerciseNumber': imported + 1,
                'rating': rating,
                'themes': theme_list,
                'lichessId': row['PuzzleId'],
                'lichessUrl': f"https://lichess.org/training/{row['PuzzleId']}",
            }
            
            collected[mate_theme].append(puzzle)
            imported += 1
            
            if imported % 100 == 0:
                print(f"  Imported {imported} puzzles... (mate1: {len(collected['mateIn1'])}, mate2: {len(collected['mateIn2'])}, mate3: {len(collected['mateIn3'])}, mate4: {len(collected['mateIn4'])})")
            
            # Check if all targets met
            if all(len(collected[k]) >= TARGET[k] for k in TARGET):
                print(f"All targets met! Stopping at row {total}.")
                break
    
    # Combine and sort by difficulty/rating
    all_puzzles = []
    for theme, puzzles in collected.items():
        puzzles.sort(key=lambda p: p.get('rating', 0))
        all_puzzles.extend(puzzles)
    
    all_puzzles.sort(key=lambda p: (p['difficulty'], p.get('rating', 0)))
    
    # Write output
    with open(output_path, 'w') as f:
        json.dump(all_puzzles, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Done!")
    print(f"   Total rows scanned: {total}")
    print(f"   Puzzles imported: {imported}")
    print(f"   Errors: {errors}")
    print(f"   mateIn1: {len(collected['mateIn1'])}")
    print(f"   mateIn2: {len(collected['mateIn2'])}")
    print(f"   mateIn3: {len(collected['mateIn3'])}")
    print(f"   mateIn4: {len(collected['mateIn4'])}")
    print(f"   Output: {output_path}")

if __name__ == '__main__':
    main()
