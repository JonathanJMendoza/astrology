# Astral Fortune

An astrology-themed slot game built with React, TypeScript, and Vite. Includes all 12 zodiac signs, five reels, ten paylines, casino-style synthesized audio, Sun wilds, Moon free spins, and a full-screen celestial sign-pick bonus. It uses virtual dollars only; there are no purchases, deposits, withdrawals, or cash prizes.

## Development

Requires Node.js 22.12 or newer. No API keys, database, or backend services are needed.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open the development server on port 5173. If that port belongs to another service, choose a free port. Fonts are bundled locally, so gameplay needs no third-party requests.

```sh
npm test
npm run math
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
- Choose 50, 100, 150, 200, or 250 credits. Denominations are $0.01, $0.02, $0.05, $0.10, $0.25, $0.50, $1.00, or $2.00 per credit. Total wager = credits times denomination. The wallet uses integer cents and keeps its dollar value when denomination changes.
- Three or more consecutive matching symbols pay from the leftmost reel. Only the highest payout per line is awarded; separate line wins add together.
- Sun symbols are wild and substitute for zodiac symbols, but not Moon scatters. A full screen of Suns pays 1,000 times the total bet.
- Three, four, or five or more Moons anywhere award 5, 8, or 12 free spins respectively, plus one celestial pick. Bonuses can retrigger. Free spins keep both the triggering credits and denomination.
- The 12 sign choices hide six Mini (2x), four Minor (5x), one Major (20x), and one Grand (100x) prize. Multipliers apply to the triggering total wager. The deck is shuffled uniformly before every bonus; all signs have equal odds.
- Each reel cell uses an independent weighted draw through `random-js` and the browser's cryptographic random source. All 12 signs have equal probabilities and paytables. Rules and weights are defined in `src/rules.ts`.
- The theoretical return is 98.00% including free spins, retriggers, and celestial picks, equivalent to a 2.00% house edge. This is a long-run expectation, not a guarantee for an individual session. See [the mathematical model](docs/MATH.md).
- A spin is settled and saved before its animation. Pending bonus decks and chosen prizes survive reloads; a selected prize is credited exactly once. Up to 30 spins are saved. Blocked storage falls back to the current page session. Legacy credit balances migrate at a one-cent denomination.
- The wallet refills to $10,000 in demo dollars for free. Autoplay runs for 10, 25, or 50 spins and stops on a bonus or when a panel opens. The current spin still finishes.
- Sound starts after a user gesture and can be muted immediately. Mechanical reel ticks, reel stops, coin chimes, win melodies, and bonus fanfares are synthesized locally without remote audio requests.

The game is a browser demo with locally editable state, not a real-money gambling system. It has no server-side ledger or certified gambling RNG.

## Environment

Use the existing checkout at `/workspace/astrology`. Each cloud task already has an isolated environment, so creating another worktree is unnecessary. Install dependencies with the lockfile using `npm ci`; setup should not alter source files or the lockfile. `.npmrc` places the package cache in writable `/tmp`.

Generated output (`dist`, `node_modules`, test reports) is ignored. The dev server must be restarted in a newly restored environment; live processes are not part of its snapshot.
