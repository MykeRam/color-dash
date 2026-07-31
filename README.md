# Color Dash

A fast, mobile-first color-matching game for the browser. Tap the matching
color before the timer runs out, build a streak, and beat your device's best
score.

Play the latest version at
[mykeram.github.io/color-dash](https://mykeram.github.io/color-dash/).

## Play locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## How it works

- Four large touch-friendly color choices per round
- Speed bonuses for quick matches
- Three lives per run
- Increasing difficulty as the score rises
- Best score saved locally in the browser
- Global top-five leaderboard shared across every player
- One leaderboard entry per browser player, updated only by a new personal best
- Responsive layouts for mobile and desktop

## Tech stack

- **TypeScript** — strongly typed game logic and UI behavior
- **React 19** — interactive game state and component rendering
- **Next.js 16** — application framework and static site generation
- **HTML and CSS** — responsive layout, animations, and touch-friendly controls
- **Web Storage API** — device-local best score persistence
- **Supabase Postgres, Auth, and JavaScript client** — anonymous player identity,
  shared leaderboard storage, atomic personal-best updates, and Row Level
  Security
- **Node.js test runner** — production-render verification
- **GitHub Actions and GitHub Pages** — automatic builds and public hosting from
  the `main` branch
- **Codex Sites / Cloudflare** — an additional production deployment target

## Commands

- `npm run dev` — run the development game
- `npm run build` — create a production build
- `npm run build:pages` — create the static GitHub Pages build
- `npm test` — build and verify the rendered game
- `npm run lint` — run static checks
