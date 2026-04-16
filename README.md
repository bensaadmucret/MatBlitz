# MatBlitz ⚡

Entraînement interactif aux puzzles d'échecs avec gamification et apprentissage des ouvertures.

## À propos

MatBlitz est une app complète d'entraînement aux échecs. Résous des puzzles de mat en 1-5 coups, maîtrise plus de 3100 ouvertures classiques, et progresse avec un système de gamification complet.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** — Design dark mode soigné
- **react-chessboard** — Échiquier interactif drag & drop
- **chess.js** — Validation des coups et FEN
- **Zustand** — State management
- **Framer Motion** — Animations (combos, badges, transitions)
- **Recharts** — Graphiques de progression
- **Tauri** + **Rust** — Application desktop avec base SQLite locale

## Fonctionnalités

### ♟️ Puzzles interactifs
- Échiquier drag & drop avec validation instantanée
- 5 niveaux de difficulté (mat en 1, 2, 3, 4, 5 coups)
- Catégories par pièce (Dame, Tour, Cavalier, Fou, Pion, Divers, Mixte)
- Indices progressifs (3 niveaux, réduit l'XP)
- Réponse automatique de l'adversaire
- Plus de 4000 puzzles de collection variée

### ⏱️ Timer & Modes de jeu
- **Libre** — Pas de limite, timer pour les stats
- **Blitz** — Temps limité par difficulté (15s/30s/60s/90s)
- **Survie** — Timer partagé, +temps à chaque puzzle résolu

### 🔥 Gamification
- **XP** — Gagné par puzzle et ouverture maîtrisée (bonus : vitesse, premier essai, combo)
- **Niveaux** — ♟️ Pion → ♞ Cavalier → ♝ Fou → ♜ Tour → ♛ Dame → ♚ Roi
- **Streak quotidienne** — Comme Duolingo, résous au moins 1 puzzle/jour
- **Combo** — X puzzles de suite sans erreur → multiplicateur XP (x2, x3, x4)
- **Badges** — 15+ badges à débloquer :
  - Puzzles : Premier Sang, En Feu, Éclair, Stratège, Grand Maître
  - Ouvertures : Explorateur, Apprenti, Spécialiste, Maître, Grand Maître des Ouvertures
  - Engagement : Oiseau de Nuit, Resurrected, Guerrier de la Semaine, Centurion, Démon de Vitesse

### 📚 Ouvertures d'échecs (NOUVEAU)
- **3100+ ouvertures** du répertoire ECO complet (A, B, C, D, E)
- **3 modes d'entraînement** :
  - 📖 **Apprentissage** — Animation coup par coup pour mémoriser
  - 🎯 **Répertoire** — L'app joue les coups adverses, tu joues ton côté
  - 🧠 **Reconnaissance** — Retrouve toute la séquence depuis le début
- **Pagination** — 24 ouvertures par page pour de meilleures performances
- **Filtres** — Par volume (A-E), maîtrisées, à apprendre
- **Recherche** — Trouve une ouverture par nom ou code ECO
- **Progression** — 6 niveaux de maîtrise (Novice → Maître)
- **Traduction** — Noms d'ouvertures et notation PGN en français

### 📊 Statistiques
- Heatmap d'activité (style GitHub, 90 jours)
- Temps moyen/médian par puzzle et par ouverture
- Taux de réussite global et par catégorie
- Répartition des temps de résolution
- Tendance sur 7 jours vs semaine précédente
- Compteur de puzzles parfaits (1er coup, sans indice)
- Stats de maîtrise des ouvertures par volume (A, B, C, D, E)

### 🎨 Design
- Dark mode par défaut avec palette violette/or
- Glass morphism sur les cartes
- Animations fluides (Framer Motion)
- Gradient accents subtils
- Mobile-first responsive
- Logo personnalisé MatBlitz ⚡
- PWA installable
- Interface entièrement en français

## Démarrage

```bash
cd MatBlitz
npm install
npm run dev
```

L'app est accessible sur `http://localhost:5173/`

## Structure du projet

```
src/
├── components/
│   ├── board/           # Échiquier interactif (PuzzleBoard, OpeningTrainer, OpeningLearner)
│   ├── layout/          # Layout principal + navigation
│   ├── gamification/    # Animations combo, badges
│   ├── openings/        # Composants ouvertures (OpeningExplorer, OpeningCard, OpeningTrainer, OpeningLearner)
│   ├── stats/           # Graphiques
│   └── ui/              # Composants réutilisables
├── data/
│   ├── index.ts         # Catégories et sous-catégories
│   ├── lichess-puzzles.json  # Base de puzzles
│   ├── chess-openings.json   # 3100+ ouvertures ECO
│   ├── openings-fr.ts   # Traductions françaises
│   └── badges.ts        # Définition des badges
├── db/
│   ├── database.ts      # SQLite avec Tauri
│   └── queries.ts       # Requêtes SQL (puzzles, ouvertures)
├── hooks/
│   └── useTimer.ts      # Hook timer (libre/blitz/survie)
├── pages/
│   ├── HomePage.tsx     # Dashboard + stats rapides
│   ├── PlayPage.tsx     # Puzzle solving
│   ├── PuzzlesPage.tsx  # Catalogue par catégorie
│   ├── OpeningsPage.tsx # Liste des ouvertures avec pagination
│   ├── OpeningTrainPage.tsx # Entraînement d'une ouverture
│   ├── StatsPage.tsx    # Statistiques détaillées
│   ├── BadgesPage.tsx   # Galerie des badges
│   └── SettingsPage.tsx # Paramètres
├── stores/
│   ├── gameStore.ts     # Zustand state (XP, streaks, badges, résultats puzzles)
│   └── openingsStore.ts # State des ouvertures + progression
├── types/
│   └── index.ts         # Types TypeScript (Puzzle, ChessOpening, Badge, etc.)
└── utils/
    └── format.ts        # Utilitaires formatage
```


## Feuille de route

### ✅ Terminé
- [x] Système de puzzles interactifs avec 5 niveaux
- [x] Gamification complète (XP, niveaux, streak, badges)
- [x] Statistiques détaillées avec graphiques
- [x] **3100+ ouvertures avec 3 modes d'entraînement**
- [x] Pagination et recherche des ouvertures
- [x] Traduction française complète
- [x] Logo personnalisé

### 🚧 En cours / Futur
- [ ] Digitisation des ~2000 puzzles depuis les PDF (vision AI)
- [ ] Mode aveugle (l'échiquier disparaît après 5s)
- [ ] Mode inversé (jouer la défense)
- [ ] Défi quotidien (1 puzzle dur, même pour tous)
- [ ] Sons (clic des pièces, check, fanfare)
- [ ] Thèmes d'échiquier débloquables
- [ ] Export/import des répertoires d'ouvertures
- [ ] Backend + comptes + sync multi-device
- [ ] Classements et partage de puzzles/ouvertures
