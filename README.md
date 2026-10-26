# Astral Fortune

An astrology-themed slot game built with React, TypeScript, and Vite. Includes five animated reels, ten fixed paylines, original zodiac artwork, Sun wilds, Moon scatter bonuses, sound, quick spins, finite autoplay, a paytable, and spin history. It uses virtual credits only; there are no purchases, deposits, withdrawals, or cash prizes.

## Development

Requires Node.js 22.12 or newer. No API keys, database, or backend services are needed.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open the development server on port 5173. If that port belongs to another service, choose a free port. Fonts are bundled locally, so gameplay needs no third-party requests.

```sh
npm test
npm run build
npm run test:e2e
```

The browser tests use the environment's `/usr/bin/chromium`; set `CHROMIUM_PATH` to another installed Chromium executable when needed. Playwright starts the development server if one is not already running. Tests cover desktop and mobile gameplay, credit accounting, mid-spin refresh, free spins, autoplay cancellation, layout, and unavailable storage.

## Play on GitHub Pages

The production files are published separately on the `gh-pages` branch. In the repository's **Settings > Pages**, choose **Deploy from a branch**, select **gh-pages** and **/ (root)**, and save.

Once GitHub finishes publishing, the game is available at:

https://JonathanJMendoza.github.io/astrology/

Vite uses relative asset paths, so the build works under `/astrology/` as well as at a domain root. Run `npm run build` to produce the static site in `dist`. The `.nojekyll` file disables Jekyll processing. The `gh-pages` branch contains a built snapshot and must be updated after future source changes; deployments are not automatically rebuilt from `main`.

## Game Rules

- The total bet is divided equally among all ten active paylines.
- Three or more consecutive matching symbols pay from the leftmost reel. Only the highest payout per line is awarded; separate line wins add together.
- Sun symbols are wild and substitute for zodiac symbols, but not Moon scatters. A full screen of Suns pays 1,000 times the total bet.
- Three, four, or five or more Moons anywhere award 5, 8, or 12 free spins respectively. Bonuses can retrigger. Free spins keep the wager that triggered them.
- Each reel cell uses an independent weighted draw through `random-js` and the browser's cryptographic random source. Symbol weights and payouts are defined in `src/game.ts`.
- A spin is fully settled and saved before its animation. Reloading restores its result. Up to 30 spins are kept in browser storage. Blocked storage falls back to the current page session.
- The wallet can refill a balance below 10,000 credits for free. Autoplay runs for 10, 25, or 50 spins and can be stopped at any time. Opening a panel stops autoplay; the spin in progress still finishes.

The game is a browser demo with locally editable state, not a real-money gambling system. It has no server-side ledger or certified gambling RNG.

## Environment

Use the existing checkout at `/workspace/astrology`. Each cloud task already has an isolated environment, so creating another worktree is unnecessary. Install dependencies with the lockfile using `npm ci`; setup should not alter source files or the lockfile. `.npmrc` places the package cache in writable `/tmp`.

Generated output (`dist`, `node_modules`, test reports) is ignored. The dev server must be restarted in a newly restored environment; live processes are not part of its snapshot.
