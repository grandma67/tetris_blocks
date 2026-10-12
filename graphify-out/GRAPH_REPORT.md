# Graph Report - tetris_blocks  (2026-10-12)

## Corpus Check
- Corpus is ~21,487 words - fits in a single context window. You may not need a graph.

## Summary
- 290 nodes · 625 edges · 14 communities (10 shown, 4 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- App Controller (main.js)
- Board & Game Logic
- Config, Pieces & Twists
- Page Markup & Deploy
- Rendering & Drag Input
- Visual Effects
- Package Manifest
- PWA Icon Set
- Themes, Effects & Audio
- Drag Controller
- Sound Synthesis
- Service Worker
- Board & Tray Markup
- Dark Mode Handling

## God Nodes (most connected - your core abstractions)
1. `Game` - 34 edges
2. `Renderer` - 23 edges
3. `FX` - 16 edges
4. `makePiece()` - 11 edges
5. `findFullLines()` - 10 edges
6. `canPlaceAll()` - 9 edges
7. `CONFIG` - 9 edges
8. `renderAll()` - 9 edges
9. `onDrop()` - 9 edges
10. `levelComplete()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `levelGame()` --calls--> `Game`  [EXTRACTED]
  tests/modifiers.test.js → js/game.js
- `deploy job (collect _site, upload, deploy-pages)` --conceptually_related_to--> `PWA (manifest + service worker)`  [INFERRED]
  .github/workflows/pages.yml → README.md
- `deploy job (collect _site, upload, deploy-pages)` --references--> `index.html (markup + dialogs)`  [EXTRACTED]
  .github/workflows/pages.yml → index.html
- `Scorebar (score, combo, best, level progress)` --implements--> `Levels Mode`  [INFERRED]
  index.html → README.md
- `#modBadge level twist badge` --implements--> `Level Twists (modifiers)`  [INFERRED]
  index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GitHub Pages deploy pipeline** — _github_workflows_pages, _github_workflows_pages_test_job, _github_workflows_pages_deploy_job, readme_no_build_step, index [INFERRED 0.85]
- **Level twists: stones, gravity, stone floor** — readme_level_twists, readme_stones_twist, readme_gravity_twist, readme_stone_floor_twist, readme_seeded_levels [EXTRACTED 1.00]
- **Optional gameplay twists (Settings toggles)** — readme_rotate_tokens, readme_bomb_blocks, readme_settings, readme_per_combination_high_scores [EXTRACTED 1.00]
- **Static hosting & offline delivery** — readme_no_build_step, readme_github_pages_deploy, readme_pages_workflow, readme_pwa, readme_network_first_service_worker [INFERRED 0.85]
- **Modal dialog UI layer** — index_thememodal, index_settingsmodal, index_scoresmodal, index_helpmodal, index_darktipmodal, index_confirmmodal, index_gameovermodal [EXTRACTED 1.00]
- **PWA Icon Set rendered from icon.svg** — assets_icon_appicon, assets_icon_192_appicon, assets_icon_512_appicon, assets_icon_maskable_192_appicon, assets_icon_maskable_512_appicon, assets_apple_touch_icon_appicon [INFERRED 0.95]

## Communities (14 total, 4 thin omitted)

### Community 0 - "App Controller (main.js)"
Cohesion: 0.08
Nodes (57): afterSettle(), animateScore(), applySettings(), bestAtStart, BOOM_COLORS, buildThemeGrid(), celebrate(), closeAllModals() (+49 more)

### Community 1 - "Board & Game Logic"
Cohesion: 0.10
Nodes (25): canPlace(), canPlaceAll(), clearLines(), createGrid(), detonate(), findFullLines(), fitsAnywhere(), isEmpty() (+17 more)

### Community 2 - "Config, Pieces & Twists"
Cohesion: 0.09
Nodes (21): CONFIG, sameTwists(), STONE, modeKeyFor(), levelModifiers(), MODIFIERS, pickStoneCell(), stoneFloor() (+13 more)

### Community 3 - "Page Markup & Deploy"
Cohesion: 0.07
Nodes (34): Deploy to GitHub Pages workflow, deploy job (collect _site, upload, deploy-pages), test job (npm test), index.html (markup + dialogs), #confirmModal new game dialog, #gameOverModal dialog, #helpModal how-to-play dialog, #home menu section (+26 more)

### Community 4 - "Rendering & Drag Input"
Cohesion: 0.11
Nodes (5): buildHomeDeco(), buildPieceEl(), colorVar(), PALETTE_SIZE, Renderer

### Community 5 - "Visual Effects"
Cohesion: 0.19
Nodes (4): FX, Layer, pick(), rand()

### Community 6 - "Package Manifest"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, start, test, type, version

### Community 7 - "PWA Icon Set"
Cohesion: 0.36
Nodes (7): Apple Touch Icon PNG, App Icon 192px PNG, App Icon 512px PNG, Block Fit App Icon (SVG source), Maskable App Icon 192px PNG, Maskable App Icon 512px PNG, Neon Block Color Palette (#00fff0 cyan, #ff2bd6 magenta, #fff200 yellow on #140633)

### Community 8 - "Themes, Effects & Audio"
Cohesion: 0.29
Nodes (7): #ambient background canvas, #fx particles canvas, #themeModal dialog, Visual & Audio Effects, prefers-reduced-motion Support, Theme System (data-driven THEMES), Synthesized WebAudio Sounds

### Community 10 - "Sound Synthesis"
Cohesion: 0.47
Nodes (5): ensure(), noise(), SCALE, Sound, tone()

## Knowledge Gaps
- **16 isolated node(s):** `Synthesized WebAudio Sounds`, `prefers-reduced-motion Support`, `Project Layout`, `node:test Unit Tests`, `#board game board` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 69 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Game` connect `Board & Game Logic` to `App Controller (main.js)`, `Config, Pieces & Twists`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **What connects `Synthesized WebAudio Sounds`, `prefers-reduced-motion Support`, `Project Layout` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Controller (main.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.07595628415300547 - nodes in this community are weakly interconnected._
- **Why does `Renderer` connect `Rendering & Drag Input` to `App Controller (main.js)`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `Board & Game Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.10025062656641603 - nodes in this community are weakly interconnected._
- **Why does `FX` connect `Visual Effects` to `App Controller (main.js)`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `Config, Pieces & Twists` be split into smaller, more focused modules?**
  _Cohesion score 0.09487179487179487 - nodes in this community are weakly interconnected._