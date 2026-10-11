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

### Settings (☰ → ⚙️ Settings)

- **Board size:** 6×6, 7×7, 8×8 (classic), 9×9, 10×10
- **Pieces per round:** 1–6 (4–6 use a two-row tray)

Changing either starts a new game. High scores are kept **separately for each combination**,
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
