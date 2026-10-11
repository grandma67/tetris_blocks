# Graph Report - tetris_blocks  (2026-10-11)

## Corpus Check
- Corpus is ~19,565 words - fits in a single context window. You may not need a graph.

## Summary
- 268 nodes · 565 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.88)
- Token cost: 85,231 input · 0 output

## Community Hubs (Navigation)
- App Controller (main.js)
- Board & Game Logic
- Page Markup & Deploy
- Config, Pieces & Twists
- Rendering & Drag Input
- Visual Effects
- Persistence (Storage)
- Package Manifest
- PWA Icon Set
- Drag Controller
- Sound Synthesis
- Effect Canvases
- Board & Tray Markup
- Dark Mode Handling
- Service Worker

## God Nodes (most connected - your core abstractions)
1. `Game` - 32 edges
2. `Renderer` - 23 edges
3. `FX` - 16 edges
4. `makePiece()` - 10 edges
5. `renderAll()` - 9 edges
6. `onDrop()` - 9 edges
7. `levelComplete()` - 9 edges
8. `newGame()` - 9 edges
9. `SeededRng` - 9 edges
10. `findFullLines()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `deploy job (collect _site, upload, deploy-pages)` --conceptually_related_to--> `Installable PWA (manifest + service worker)`  [INFERRED]
  .github/workflows/pages.yml → README.md
- `No build step (pure ES modules)` --rationale_for--> `deploy job (collect _site, upload, deploy-pages)`  [INFERRED]
  README.md → .github/workflows/pages.yml
- `levelGame()` --calls--> `Game`  [EXTRACTED]
  tests/modifiers.test.js → js/game.js
- `Block Fit README` --references--> `Deploy to GitHub Pages workflow`  [EXTRACTED]
  README.md → .github/workflows/pages.yml
- `deploy job (collect _site, upload, deploy-pages)` --references--> `index.html (markup + dialogs)`  [EXTRACTED]
  .github/workflows/pages.yml → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Level twist modifiers (stones, gravity, stone floor)** — readme_level_twists, readme_stones_twist, readme_gravity_twist, readme_stone_floor_twist, readme_seeded_levels, index_modbadge [EXTRACTED 1.00]
- **GitHub Pages deploy pipeline** — _github_workflows_pages, _github_workflows_pages_test_job, _github_workflows_pages_deploy_job, readme_no_build_step, index [INFERRED 0.85]
- **Modal dialog UI layer** — index_thememodal, index_settingsmodal, index_scoresmodal, index_helpmodal, index_darktipmodal, index_confirmmodal, index_gameovermodal [EXTRACTED 1.00]
- **PWA Icon Set rendered from icon.svg** — assets_icon_appicon, assets_icon_192_appicon, assets_icon_512_appicon, assets_icon_maskable_192_appicon, assets_icon_maskable_512_appicon, assets_apple_touch_icon_appicon [INFERRED 0.95]

## Communities (15 total, 4 thin omitted)

### Community 0 - "App Controller (main.js)"
Cohesion: 0.08
Nodes (57): afterSettle(), animateScore(), applySettings(), bestAtStart, BOOM_COLORS, buildThemeGrid(), celebrate(), closeAllModals() (+49 more)

### Community 1 - "Board & Game Logic"
Cohesion: 0.12
Nodes (15): canPlace(), clearLines(), createGrid(), detonate(), findFullLines(), fitsAnywhere(), isEmpty(), place() (+7 more)

### Community 2 - "Page Markup & Deploy"
Cohesion: 0.07
Nodes (30): Deploy to GitHub Pages workflow, deploy job (collect _site, upload, deploy-pages), test job (npm test), index.html (markup + dialogs), #confirmModal new game dialog, #gameOverModal dialog, #helpModal how-to-play dialog, #home menu section (+22 more)

### Community 3 - "Config, Pieces & Twists"
Cohesion: 0.12
Nodes (21): CONFIG, sameTwists(), STONE, buildHomeDeco(), applyGravity(), levelModifiers(), MODIFIERS, pickStoneCell() (+13 more)

### Community 4 - "Rendering & Drag Input"
Cohesion: 0.12
Nodes (4): buildPieceEl(), colorVar(), PALETTE_SIZE, Renderer

### Community 5 - "Visual Effects"
Cohesion: 0.19
Nodes (4): FX, Layer, pick(), rand()

### Community 6 - "Persistence (Storage)"
Cohesion: 0.27
Nodes (8): modeKeyFor(), DEFAULT_THEME, key(), modeKey(), read(), scoresKey(), Storage, write()

### Community 7 - "Package Manifest"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, start, test, type, version

### Community 8 - "PWA Icon Set"
Cohesion: 0.36
Nodes (7): Apple Touch Icon PNG, App Icon 192px PNG, App Icon 512px PNG, Block Fit App Icon (SVG source), Maskable App Icon 192px PNG, Maskable App Icon 512px PNG, Neon Block Color Palette (#00fff0 cyan, #ff2bd6 magenta, #fff200 yellow on #140633)

### Community 10 - "Sound Synthesis"
Cohesion: 0.47
Nodes (5): ensure(), noise(), SCALE, Sound, tone()

### Community 11 - "Effect Canvases"
Cohesion: 0.67
Nodes (3): #ambient background canvas, #fx particles canvas, Visual/audio effects

## Knowledge Gaps
- **15 isolated node(s):** `Endless mode`, `Bomb blocks twist`, `Home page menu`, `#board game board`, `#tray pieces tray` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 63 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Game` connect `Board & Game Logic` to `App Controller (main.js)`, `Config, Pieces & Twists`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **What connects `Endless mode`, `Bomb blocks twist`, `Home page menu` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Controller (main.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.07595628415300547 - nodes in this community are weakly interconnected._
- **Why does `Renderer` connect `Rendering & Drag Input` to `App Controller (main.js)`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `Board & Game Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.12367864693446089 - nodes in this community are weakly interconnected._
- **Why does `FX` connect `Visual Effects` to `App Controller (main.js)`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `Page Markup & Deploy` be split into smaller, more focused modules?**
  _Cohesion score 0.07196969696969698 - nodes in this community are weakly interconnected._