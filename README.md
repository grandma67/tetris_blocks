# 🧩 Block Fit

A themeable block-placement puzzle. Drag tetris-style pieces onto an 8×8 board, fill rows and
columns to clear them, and survive as long as you can — the game ends when none of your pieces fits.

Pure HTML/CSS/JS (ES modules), **no build step** — it runs straight from GitHub Pages.

## Play locally

```bash
npm start          # serves on http://localhost:8080 (any static server works)
npm test           # logic unit tests (node:test, no deps)
```

> Opening `index.html` via `file://` won't work — ES modules need an HTTP server.

## Deploy to GitHub Pages

1. Create a repo and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` runs the tests and publishes the site on every push.

(Alternatively choose *Deploy from a branch → main / root* — the site has no build step, so that works too.)

## Install as an app

Block Fit is a PWA (`manifest.webmanifest` + `sw.js`). On Android Chrome open the site and tap
**⋮ → Add to Home screen / Install app**; on iOS Safari use **Share → Add to Home Screen**. It then
launches full-screen with its own icon and works offline. The service worker is network-first, so a new
deploy shows up on the next launch; if you add a JS/CSS file, add it to `CORE` in `sw.js`.
Installing needs HTTPS (GitHub Pages is fine) or `localhost`.

## Modes

- **🎯 Levels (default)** — each level has a goal score (100, 115, 130… about 1500 by level 60, growing forever).
  Reach it and you move on to a fresh board with +1 rotate token; from level 2 the board starts with
  grey stone blocks (more each level) and big pieces get more common. Run out of room before the goal
  and you **retry that same level** — score and rotate tokens go back to what you had when the level
  began. Progress is kept in `localStorage` (a checkpoint saved at the start of every level) and
  survives reloads and settings changes; only "Restart from Level 1" on the home page resets it.
  The high-score table keeps one row per run, updated as the run gets further. Tuning: `CONFIG.levels`.

  **Seeded levels with twists.** The level number seeds that level's random generator, so level N
  always gets the same twist, stone layout and opening pieces — for every player. Level 1 plays
  normally; from level 2 about a third of levels play normally and the rest get a twist (from
  level 8, sometimes two):
  - 🪨 **Stones** — every 2 rounds a stone drops into a random empty cell; it only leaves when its
    row or column clears.
  - ⬇ **Gravity** — after every clear, blocks fall down; lines formed by the fall clear too, each
    cascade raising the combo multiplier.
  - 🧱 **Stone floor** — every 3 rounds the lowest row with room turns to stone, leaving one gap
    (blocks already in that row turn to stone too). Each time it climbs a row higher, so the floor
    grows; fill a gap to clear a stone row and push it back down. Never ends the game by itself.

  A badge above the tray shows the level's twists and counts down to the next stone / stone row.
  Tuning: `CONFIG.levels.modifiers`; logic in `js/modifiers.js`, PRNG in `js/rng.js`.
  **🤖 Solver.** In Levels, the 🤖 button searches for a way to finish the current level from the
  current position. Because levels are seeded, it plays the real game model forward (future trays,
  stone drops and floor rows included). It's capped at 10 seconds (`CONFIG.solver`). If it finds a
  win, it plays the moves step by step with a hop-and-drop animation. Otherwise it says there's no
  way to win, or that it ran out of time. The search runs in a Web Worker (`js/solver-worker.js`);
  the logic is in `js/solver.js`.
- **∞ Endless** — the classic mode: play until no piece fits.

Each mode keeps its own saved game and high-score tables.

## Home page

The game opens on a menu page: 🎯 Levels and ∞ Endless (each shows Continue + progress), Restart, Themes,
Settings, High Scores and How to Play, plus your best score and the active mode. The ☰ button
in-game returns to it; the current game is saved, so Continue picks up where you left off.

## Rules & scoring

| Event | Points |
| --- | --- |
| Place a piece | 1 per block |
| Clear L lines at once | `10 × L(L+1)/2` → 10, 30, 60, 100… |
| Combo (clearing on consecutive moves) | ×1, ×1.5, ×2, ×2.5… — survives up to 2 non-clearing moves |
| Empty the entire board | +300 |

Each round deals 3 pieces (by default); once all are placed you get a new set. Pieces never rotate. The
generator tries to deal at least one piece that fits, and larger pieces become more common as your
score grows. All tuning lives in `js/config.js`.

### Twists (on by default, toggle in Settings)

- **↻ Rotate tokens** — tap a tray piece to turn it 90° clockwise; each turn costs a token. You start
  with 3 (max 9) and earn one for every 3+ line clear or board wipe. Pieces that only fit when rotated
  show a ↻ badge, and the game isn't over while a rotation could still save you.
- **💣 Bomb blocks** — ~10% of dealt pieces carry a bomb. When a bomb's row or column clears it blows
  up the 3×3 area around it (+3 per extra block destroyed); bombs caught in a blast chain-react.
  While dragging, the board previews the blast area in orange.

### Settings (☰ → ⚙️ Settings)

- **Board size:** 6×6, 7×7, 8×8 (classic), 9×9, 10×10
- **Pieces per round:** 1–6 (4–6 use a two-row tray)

Changing any setting starts a new game. High scores are kept **separately for each combination**
(including which twists are on),
since scores on a 10×10 board aren't comparable to a 6×6 one. The options are listed in `CONFIG.boardSizes` / `CONFIG.piecesRange`.

High scores (top 10 per mode), settings and the in-progress game are stored in `localStorage`.

## Themes

Six built-in themes: Neon Nights, Candy Pop, Deep Ocean, Retro Arcade, Zen Garden, Volcano. Each theme is
plain data in `js/themes.js`:

```js
{
  id: 'mytheme', name: 'My Theme', icon: '✨',
  block: 'glossy',            // glossy | neon | jelly | pixel | flat | gem
  ambient: 'stars',           // stars | bubbles | petals | embers | none
  vars: { '--bg': '...', '--accent': '...', '--font': '...', /* see others */ },
  palette: [/* 8 colors */],
  particles: { shape: 'circle' /* square | circle | emoji */, emojis: [], glow: true },
  praise: { big: [...], huge: [...], epic: [...], boardClear: '...' },
}
```

Append an object to `THEMES` and it shows up in the theme picker automatically. If you use a new
font, add it to the Google Fonts link in `index.html`.

## Effects

- Every clear: line flash, blocks burst outward staggered from the drop point, themed particles.
- 2+ lines: screen shake + praise text. 3+ lines: shockwave + screen flash.
- 4+ lines (or a long combo): double shockwave, fireworks, rainbow board pulse, hue-spinning blocks.
- Board wipe: fireworks + confetti + bonus banner. New high score: confetti + fanfare.
- Synthesized WebAudio sound effects (no audio files), mute toggle. Honors `prefers-reduced-motion`.

## Project layout

```
index.html          markup + dialogs
css/style.css       layout, block styles, animations
js/config.js        tuning
js/pieces.js        piece catalogue + weighted generator
js/board.js         pure grid logic
js/modifiers.js     level twists: stones, gravity, stone floor
js/rng.js           seedable PRNG (level number → seed)
js/solver.js        level solver (search) + solver-worker.js
js/game.js          game state machine (score, combo, rounds, save/load)
js/renderer.js      DOM board/tray rendering + clear animations
js/input.js         pointer drag & drop (mouse/touch/pen)
js/fx.js            canvas particles, shockwaves, ambient background, shake
js/audio.js         WebAudio synth
js/themes.js        theme data + apply
js/storage.js       localStorage (guarded)
js/main.js          wiring
tests/              node:test unit tests
```
