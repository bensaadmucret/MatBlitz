import type { Puzzle, PuzzleCategory } from '../types'
import lichessPuzzles from './lichess-puzzles.json'
import lichessPuzzlesHard from './lichess-puzzles-hard.json'

export const allPuzzles: Puzzle[] = [
  ...(lichessPuzzles as Puzzle[]),
  ...(lichessPuzzlesHard as Puzzle[]),
]

export const categories: { key: PuzzleCategory; label: string; count: number }[] = [
  { key: 'mat-en-1', label: 'Mat en 1 coup', count: allPuzzles.filter(p => p.category === 'mat-en-1').length },
  { key: 'mat-en-2', label: 'Mat en 2 coups', count: allPuzzles.filter(p => p.category === 'mat-en-2').length },
  { key: 'mat-en-3', label: 'Mat en 3 coups', count: allPuzzles.filter(p => p.category === 'mat-en-3').length },
  { key: 'mat-en-4', label: 'Mat en 4 coups', count: allPuzzles.filter(p => p.category === 'mat-en-4').length },
  { key: 'mat-en-5', label: 'Mat en 5 coups', count: allPuzzles.filter(p => p.category === 'mat-en-5').length },
]

export const subcategories: Record<PuzzleCategory, { key: string; label: string }[]> = {
  'mat-en-1': [
    { key: 'lichess', label: 'Mixte' },
    { key: 'dame', label: 'Dame' },
    { key: 'tour', label: 'Tour' },
    { key: 'cavalier', label: 'Cavalier' },
    { key: 'pion', label: 'Pion' },
    { key: 'tactique', label: 'Tactique' },
  ],
  'mat-en-2': [
    { key: 'lichess', label: 'Mixte' },
    { key: 'dame', label: 'Dame' },
    { key: 'divers', label: 'Divers' },
    { key: 'tactique', label: 'Tactique' },
  ],
  'mat-en-3': [
    { key: 'lichess', label: 'Mixte' },
    { key: 'divers', label: 'Divers' },
    { key: 'tactique', label: 'Tactique' },
  ],
  'mat-en-4': [
    { key: 'lichess', label: 'Mixte' },
    { key: 'divers', label: 'Divers' },
    { key: 'tactique', label: 'Tactique' },
  ],
  'mat-en-5': [
    { key: 'lichess', label: 'Mixte' },
    { key: 'tactique', label: 'Tactique' },
  ],
}
