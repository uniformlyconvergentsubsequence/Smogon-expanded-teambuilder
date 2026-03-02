# Smogon Expanded Teambuilder

A comprehensive competitive Pokémon teambuilder powered by Smogon usage statistics. Build teams, explore stats across every format and generation, and get AI-powered analysis — all in one clean, fast-loading interface.

**Live Site:** [GitHub Pages](https://yourusername.github.io/Smogon-expanded-teambuilder/)

## Features

### 📊 Stats Explorer
- Browse **usage rankings** for any format, generation, month, and rating cutoff
- View **lead statistics** to plan team openings
- Analyze **metagame composition** (playstyle distribution, stalliness)
- Data sourced directly from [Smogon Usage Statistics](https://www.smogon.com/stats/)
- Coverage: November 2014 – Present, 25+ tiers, Generations 1–9

### 🎯 Pokémon Detail Pages
- **Moveset analysis**: most common moves, abilities, items, EV spreads
- **Tera Type distribution** (Gen 9)
- **Common teammates** with correlation percentages
- **Checks & counters** with KO rates
- **Base stats** visualization
- **Type matchup chart** (defensive)
- Direct links to [Smogon Strategy Dex](https://www.smogon.com/dex/)

### 🔧 Team Builder
- Build teams of 6 with full move/item/ability/EV/IV/nature editing
- **Autocomplete search** for Pokémon, moves, and items (data from Showdown)
- **Import/Export** in Pokémon Showdown paste format
- Tera Type selection (Gen 9)
- Multiple saved teams with local storage persistence
- **Synergy score** indicator

### 🤖 AI Assistant
- **Built-in type analysis** (no API key needed):
  - Team defensive coverage chart
  - Individual Pokémon weaknesses
  - Weakness/resistance summary
- **Type combination suggestions** to cover team gaps
- **Teammate suggestions** from Smogon stats data
- **Format threat awareness** (top usage Pokémon in current format)
- **AI Chat** (optional, bring your own API key):
  - OpenAI and Anthropic support
  - Context-aware team analysis
  - Strategy and matchup discussion

## Tech Stack

- **React 18** with lazy-loaded routes for fast initial load
- **Vite** for instant dev server and optimized production builds
- **Tailwind CSS** for a polished, responsive dark-mode UI
- **React Router** (HashRouter for GitHub Pages compatibility)
- **LocalStorage** for persistent team and settings data
- No backend required — runs entirely in the browser

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment

The site auto-deploys to GitHub Pages via the included GitHub Actions workflow. Just push to `main`.

To configure:
1. Go to repo **Settings → Pages**
2. Set Source to **GitHub Actions**
3. Push to `main` — the workflow handles the rest

## Data Sources

| Source | What it provides |
|--------|-----------------|
| [Smogon Stats](https://www.smogon.com/stats/) | Usage rankings, movesets, leads, metagame, chaos JSON |
| [Pokémon Showdown](https://play.pokemonshowdown.com/) | Pokédex data, sprites, moves, items, abilities |
| [Smogon Dex](https://www.smogon.com/dex/) | Strategy articles (linked, not fetched) |

## License

This project is not affiliated with Smogon, Nintendo, Game Freak, or The Pokémon Company.
Pokémon and all related names are trademarks of their respective owners.
