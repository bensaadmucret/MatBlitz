# MatBlitz ⚡

Interactive chess puzzle training with gamification and opening learning.

## About

MatBlitz is a comprehensive chess training app. Solve mate-in-1 to mate-5 puzzles, master 3100+ classic chess openings, and progress with a complete gamification system.

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** — Polished dark mode design
- **react-chessboard** — Interactive drag & drop chessboard
- **chess.js** — Move validation and FEN handling
- **Zustand** — State management
- **Framer Motion** — Smooth animations (combos, badges, transitions)
- **Recharts** — Progress charts
- **Tauri** + **Rust** + **SQLite** — Desktop app with local database

## Features

### ♟️ Interactive Puzzles
- Drag & drop chessboard with instant validation
- 5 difficulty levels (mate in 1, 2, 3, 4, 5 moves)
- Categories by piece (Queen, Rook, Knight, Bishop, Pawn, Mixed, Divers)
- Progressive hints (3 levels, reduces XP)
- Automatic opponent responses
- 4000+ puzzles from varied collection

### ⏱️ Timer & Game Modes
- **Free** — No limit, timer runs for stats
- **Blitz** — Time limit per difficulty (15s/30s/60s/90s)
- **Survival** — Shared timer, +time for each solved puzzle

### 🔥 Gamification
- **XP** — Earned per puzzle and mastered opening (bonuses: speed, first try, combo)
- **Levels** — ♟️ Pawn → ♞ Knight → ♝ Bishop → ♜ Rook → ♛ Queen → ♚ King
- **Daily Streak** — Like Duolingo, solve at least 1 puzzle/day
- **Combo** — X puzzles in a row without error → XP multiplier (x2, x3, x4)
- **Badges** — 15+ badges to unlock:
  - Puzzles: First Blood, On Fire, Lightning, Strategist, Grandmaster
  - Openings: Explorer, Apprentice, Specialist, Master, Grandmaster of Openings
  - Engagement: Night Owl, Resurrected, Warrior of the Week, Centurion, Speed Demon

### 📚 Chess Openings (NEW)
- **3100+ openings** from complete ECO repertoire (A, B, C, D, E)
- **3 training modes**:
  - 📖 **Learning** — Step-by-step animation to memorize
  - 🎯 **Repertoire** — App plays opponent moves, you play your side
  - 🧠 **Recognition** — Recall the entire sequence from the start
- **Pagination** — 24 openings per page for better performance
- **Filters** — By volume (A-E), mastered, to learn
- **Search** — Find opening by name or ECO code
- **Progression** — 6 mastery levels (Novice → Master)
- **Translation** — Opening names and PGN notation in French

### 📊 Statistics
- Activity heatmap (GitHub style, 90 days)
- Average/median time per puzzle and opening
- Global and category success rates
- Resolution time distribution
- 7-day trend vs previous week
- Perfect puzzle counter (first move, no hints)
- Opening mastery stats by volume (A, B, C, D, E)

### 🎨 Design
- Dark mode by default with purple/orange palette
- Glass morphism on cards
- Smooth animations (Framer Motion)
- Subtle gradient accents
- Mobile-first responsive
- Custom MatBlitz logo ⚡
- PWA installable
- Fully French interface

## Getting Started

```bash
cd MatBlitz
npm install
npm run dev
```

The app is available at `http://localhost:5173/`

For desktop app:
```bash
cd src-tauri
cargo tauri dev
```

## Project Structure

```
src/
├── components/
│   ├── board/           # Interactive board (PuzzleBoard, OpeningTrainer, OpeningLearner)
│   ├── layout/          # Main layout + navigation
│   ├── gamification/    # Combo animations, badges
│   ├── openings/        # Opening components (OpeningExplorer, OpeningCard, OpeningTrainer, OpeningLearner)
│   ├── stats/           # Charts
│   └── ui/              # Reusable components
├── data/
│   ├── index.ts         # Categories and subcategories
│   ├── lichess-puzzles.json  # Puzzle database
│   ├── chess-openings.json   # 3100+ ECO openings
│   ├── openings-fr.ts   # French translations
│   └── badges.ts        # Badge definitions
├── db/
│   ├── database.ts      # SQLite with Tauri
│   └── queries.ts       # SQL queries (puzzles, openings)
├── hooks/
│   └── useTimer.ts      # Timer hook (free/blitz/survival)
├── pages/
│   ├── HomePage.tsx     # Dashboard + quick stats
│   ├── PlayPage.tsx     # Puzzle solving
│   ├── PuzzlesPage.tsx  # Category catalog
│   ├── OpeningsPage.tsx # Openings list with pagination
│   ├── OpeningTrainPage.tsx # Single opening training
│   ├── StatsPage.tsx    # Detailed statistics
│   ├── BadgesPage.tsx   # Badge gallery
│   └── SettingsPage.tsx # Settings
├── stores/
│   ├── gameStore.ts     # Zustand state (XP, streaks, badges, puzzle results)
│   └── openingsStore.ts # Openings state + progression
├── types/
│   └── index.ts         # TypeScript types (Puzzle, ChessOpening, Badge, etc.)
└── utils/
    └── format.ts        # Formatting utilities
```

## Roadmap

### ✅ Completed
- [x] Interactive puzzle system with 5 levels
- [x] Complete gamification (XP, levels, streak, badges)
- [x] Detailed statistics with charts
- [x] **3100+ openings with 3 training modes**
- [x] Pagination and search for openings
- [x] Full French translation
- [x] Custom MatBlitz logo
- [x] Desktop app with Tauri

### 🚧 In Progress / Future
- [ ] Digitization of ~2000 puzzles from PDFs (AI vision)
- [ ] Blind mode (board disappears after 5s)
- [ ] Reverse mode (play defense)
- [ ] Daily challenge (1 hard puzzle, same for everyone)
- [ ] Sounds (piece clicks, check, fanfare)
- [ ] Unlockable chessboard themes
- [ ] Export/import opening repertoires
- [ ] Backend + accounts + multi-device sync
- [ ] Leaderboards and puzzle/opening sharing

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.

## Credits

MatBlitz ⚡ — Interactive chess puzzle training with gamification.
Created with ❤️ for chess enthusiasts.
