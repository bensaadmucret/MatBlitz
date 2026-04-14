# MatBlitz ⚡

Entraînement interactif aux puzzles d'échecs avec gamification.

## À propos

MatBlitz est une app d'entraînement aux puzzles d'échecs basée sur les livres **1000 Exercices et Puzzles d'Échecs** et **1000 Exercices Mat en 2 (Vol. 2)**. Résous des puzzles de mat en 1, 2, 3 et 4 coups, progresse avec le système de gamification et suis ta courbe d'amélioration.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4** — Design dark mode soigné
- **react-chessboard** — Échiquier interactif drag & drop
- **chess.js** — Validation des coups et FEN
- **Zustand** — State management + localStorage persistence
- **Framer Motion** — Animations (combos, badges, transitions)
- **Recharts** — Graphiques de progression

## Fonctionnalités

### ♟️ Puzzles interactifs
- Échiquier drag & drop avec validation instantanée
- 4 niveaux de difficulté (mat en 1, 2, 3, 4 coups)
- Catégories par pièce (Dame, Tour, Cavalier, Fou, Pion, Divers)
- Indices progressifs (3 niveaux, réduit l'XP)
- Réponse automatique de l'adversaire

### ⏱️ Timer & Modes de jeu
- **Libre** — Pas de limite, timer pour les stats
- **Blitz** — Temps limité par difficulté (15s/30s/60s/90s)
- **Survie** — Timer partagé, +temps à chaque puzzle résolu

### 🔥 Gamification
- **XP** — Gagné par puzzle (bonus : vitesse, premier essai, combo)
- **Niveaux** — ♟️ Pion → ♞ Cavalier → ♝ Fou → ♜ Tour → ♛ Dame → ♚ Roi
- **Streak quotidienne** — Comme Duolingo, résous au moins 1 puzzle/jour
- **Combo** — X puzzles de suite sans erreur → multiplicateur XP (x2, x3, x4)
- **10 badges** — Premier Sang, En Feu, Éclair, Stratège, Grand Maître, Oiseau de Nuit, Resurrected, Guerrier de la Semaine, Centurion, Démon de Vitesse

### 📊 Statistiques
- Heatmap d'activité (style GitHub, 90 jours)
- Temps moyen/médian par puzzle
- Taux de réussite global et par catégorie
- Répartition des temps de résolution
- Tendance sur 7 jours vs semaine précédente
- Compteur de puzzles parfaits (1er coup, sans indice)

### 🎨 Design
- Dark mode par défaut
- Glass morphism sur les cartes
- Animations fluides (Framer Motion)
- Gradient accents subtils
- Mobile-first responsive
- PWA installable

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
│   ├── board/          # Échiquier interactif
│   ├── layout/         # Layout principal + navigation
│   ├── gamification/   # Animations combo, badges
│   ├── stats/          # Graphiques
│   └── ui/             # Composants réutilisables
├── data/
│   ├── puzzles.ts      # Données puzzles (FEN + solutions)
│   └── badges.ts       # Définition des badges
├── hooks/
│   └── useTimer.ts     # Hook timer (libre/blitz/survie)
├── pages/
│   ├── HomePage.tsx    # Dashboard + stats rapides
│   ├── PlayPage.tsx    # Puzzle solving
│   ├── PuzzlesPage.tsx # Catalogue par catégorie
│   ├── StatsPage.tsx   # Statistiques détaillées
│   ├── BadgesPage.tsx  # Galerie des badges
│   └── SettingsPage.tsx # Paramètres
├── stores/
│   └── gameStore.ts    # Zustand state (XP, streaks, badges, résultats)
├── types/
│   └── index.ts        # Types TypeScript
└── utils/
    └── format.ts       # Utilitaires formatage
```

## Sources des puzzles

- **Livre 1** : *1000 exercices et puzzles d'échecs* (202 pages) — 200 mat en 1, 600 mat en 2, 100 mat en 3, 100 mat en 4
- **Livre 2** : *1000 exercices mat en 2 — Volume 2* (213 pages) — 1000 mat en 2 classés par combinaison de pièces

## Feuille de route

- [ ] Digitisation des ~2000 puzzles depuis les PDF (vision AI)
- [ ] Mode aveugle (l'échiquier disparaît après 5s)
- [ ] Mode inversé (jouer la défense)
- [ ] Défi quotidien (1 puzzle dur, même pour tous)
- [ ] Sons (clic des pièces, check, fanfare)
- [ ] Thèmes d'échiquier débloquables
- [ ] Backend + comptes + sync multi-device
- [ ] Classements et partage de puzzles
