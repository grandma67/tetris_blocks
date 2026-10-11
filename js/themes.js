// Themes are pure data. To add one, append an object to THEMES — nothing else
// needs to change. Fields:
//   vars      CSS custom properties applied to :root
//   palette   block colors (pieces pick palette[familyIndex % length])
//   block     visual block style: glossy | neon | jelly | pixel | flat | gem
//   ambient   animated background: stars | bubbles | petals | embers | none
//   particles burst style for line clears: { shape, emojis?, glow }
//   praise    celebration words per tier

export const THEMES = [
  {
    id: 'neon',
    name: 'Neon Nights',
    icon: '🌃',
    block: 'neon',
    ambient: 'stars',
    vars: {
      '--bg': 'radial-gradient(ellipse at top, #2b0b4f 0%, #0d0221 55%, #05010f 100%)',
      '--panel': 'rgba(255,255,255,0.05)',
      '--panel-border': 'rgba(0,255,240,0.25)',
      '--board-bg': 'rgba(10,2,30,0.85)',
      '--cell-empty': 'rgba(120,80,255,0.08)',
      '--cell-border': 'rgba(140,100,255,0.18)',
      '--text': '#f4ecff',
      '--muted': '#a597c9',
      '--accent': '#00fff0',
      '--accent-2': '#ff2bd6',
      '--font': "'Orbitron', system-ui, sans-serif",
      '--font-scale': '1',
      '--radius': '5px',
    },
    palette: ['#00fff0', '#ff2bd6', '#fff200', '#39ff14', '#ff6b00', '#7d5bff', '#ff3864', '#00a2ff'],
    particles: { shape: 'square', glow: true },
    praise: {
      big: ['NICE!', 'SHARP!', 'CHARGED!'],
      huge: ['ELECTRIC!', 'OVERDRIVE!'],
      epic: ['HYPERDRIVE!!', 'MAX VOLTAGE!!'],
      boardClear: 'SYSTEM CLEAR',
    },
  },
  {
    id: 'candy',
    name: 'Candy Pop',
    icon: '🍭',
    block: 'jelly',
    ambient: 'bubbles',
    vars: {
      '--bg': 'linear-gradient(160deg, #ffd6ec 0%, #ffe9c7 50%, #d4f1ff 100%)',
      '--panel': 'rgba(255,255,255,0.6)',
      '--panel-border': 'rgba(255,120,190,0.35)',
      '--board-bg': 'rgba(255,255,255,0.75)',
      '--cell-empty': 'rgba(255,170,210,0.18)',
      '--cell-border': 'rgba(255,140,200,0.25)',
      '--text': '#5a2149',
      '--muted': '#a0638b',
      '--accent': '#ff4fa3',
      '--accent-2': '#7b61ff',
      '--font': "'Fredoka', system-ui, sans-serif",
      '--font-scale': '1',
      '--radius': '10px',
    },
    palette: ['#ff5fa2', '#ffb84d', '#7ee081', '#5ec8ff', '#b388ff', '#ff7a6b', '#ffe066', '#4de1c1'],
    particles: { shape: 'emoji', emojis: ['🍬', '🍭', '⭐', '🍩', '🧁', '💖'], glow: false },
    praise: {
      big: ['Sweet!', 'Yummy!', 'Tasty!'],
      huge: ['Delicious!', 'Sugar Rush!'],
      epic: ['CANDY CRUSHER!!', 'SWEET DREAMS!!'],
      boardClear: 'Spotless! 🍰',
    },
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    icon: '🌊',
    block: 'glossy',
    ambient: 'bubbles',
    vars: {
      '--bg': 'linear-gradient(180deg, #0a4d7a 0%, #04253f 60%, #01121f 100%)',
      '--panel': 'rgba(255,255,255,0.07)',
      '--panel-border': 'rgba(120,220,255,0.25)',
      '--board-bg': 'rgba(0,30,55,0.75)',
      '--cell-empty': 'rgba(120,200,255,0.08)',
      '--cell-border': 'rgba(120,200,255,0.15)',
      '--text': '#e6f7ff',
      '--muted': '#8fbcd4',
      '--accent': '#4ce0ff',
      '--accent-2': '#ffd166',
      '--font': "'Fredoka', system-ui, sans-serif",
      '--font-scale': '1',
      '--radius': '7px',
    },
    palette: ['#2ec4f1', '#06d6a0', '#ffd166', '#ef476f', '#118ab2', '#9b5de5', '#f78c6b', '#7bdff2'],
    particles: { shape: 'circle', glow: false },
    praise: {
      big: ['Splash!', 'Ripple!', 'Wavy!'],
      huge: ['Tidal Wave!', 'Riptide!'],
      epic: ['TSUNAMI!!', 'KRAKEN!!'],
      boardClear: 'Crystal Clear 🐚',
    },
  },
  {
    id: 'retro',
    name: 'Retro Arcade',
    icon: '👾',
    block: 'pixel',
    ambient: 'stars',
    vars: {
      '--bg': '#0b0b12',
      '--panel': '#16162a',
      '--panel-border': '#3b3b6d',
      '--board-bg': '#000000',
      '--cell-empty': '#0f0f1e',
      '--cell-border': '#1e1e38',
      '--text': '#f8f8f8',
      '--muted': '#8888aa',
      '--accent': '#ffcc00',
      '--accent-2': '#ff3355',
      '--font': "'Press Start 2P', monospace",
      '--font-scale': '0.62',
      '--radius': '0px',
    },
    palette: ['#00e5ff', '#ffcc00', '#b026ff', '#00ff66', '#ff3355', '#3366ff', '#ff8800', '#ff66cc'],
    particles: { shape: 'square', glow: false },
    praise: {
      big: ['NICE!', 'COMBO!', '1UP!'],
      huge: ['RADICAL!', 'TUBULAR!'],
      epic: ['HIGH SCORE!!', 'GAME GENIE!!'],
      boardClear: 'PERFECT!',
    },
  },
  {
    id: 'zen',
    name: 'Zen Garden',
    icon: '🌸',
    block: 'flat',
    ambient: 'petals',
    vars: {
      '--bg': 'linear-gradient(170deg, #f4efe6 0%, #e7efe0 100%)',
      '--panel': 'rgba(255,255,255,0.55)',
      '--panel-border': 'rgba(110,140,100,0.25)',
      '--board-bg': 'rgba(255,253,248,0.85)',
      '--cell-empty': 'rgba(120,140,110,0.09)',
      '--cell-border': 'rgba(120,140,110,0.14)',
      '--text': '#3d4a3a',
      '--muted': '#7d8b78',
      '--accent': '#d9727f',
      '--accent-2': '#6e9b6a',
      '--font': "'Quicksand', system-ui, sans-serif",
      '--font-scale': '1',
      '--radius': '6px',
    },
    palette: ['#e8a0a8', '#9cc5a1', '#f2cc8f', '#81b2d9', '#c3a6d8', '#e07a5f', '#88b7b5', '#d4a373'],
    particles: { shape: 'emoji', emojis: ['🌸', '🍃', '🌿', '💮'], glow: false },
    praise: {
      big: ['Calm', 'Balance', 'Flow'],
      huge: ['Harmony', 'Serenity'],
      epic: ['Enlightened', 'Satori'],
      boardClear: 'Nirvana 🪷',
    },
  },
  {
    id: 'lava',
    name: 'Volcano',
    icon: '🌋',
    block: 'gem',
    ambient: 'embers',
    vars: {
      '--bg': 'radial-gradient(ellipse at bottom, #5c1200 0%, #1f0603 55%, #0b0201 100%)',
      '--panel': 'rgba(255,120,40,0.07)',
      '--panel-border': 'rgba(255,110,40,0.3)',
      '--board-bg': 'rgba(25,6,3,0.85)',
      '--cell-empty': 'rgba(255,90,30,0.07)',
      '--cell-border': 'rgba(255,90,30,0.14)',
      '--text': '#ffeadb',
      '--muted': '#c28b74',
      '--accent': '#ff7b1c',
      '--accent-2': '#ffd23f',
      '--font': "'Fredoka', system-ui, sans-serif",
      '--font-scale': '1',
      '--radius': '6px',
    },
    palette: ['#ff4d1c', '#ffb01f', '#ff2e63', '#ffd23f', '#c2185b', '#ff8a3d', '#e53935', '#ffc46b'],
    particles: { shape: 'circle', glow: true },
    praise: {
      big: ['Hot!', 'Sizzling!', 'Blazing!'],
      huge: ['Scorching!', 'Inferno!'],
      epic: ['ERUPTION!!', 'MELTDOWN!!'],
      boardClear: 'Scorched Earth 🔥',
    },
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

export function applyTheme(theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  theme.palette.forEach((c, i) => root.style.setProperty(`--p${i}`, c));
  root.dataset.block = theme.block;
  root.dataset.theme = theme.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.palette[0]);
}

export const colorFor = (theme, colorIndex) => theme.palette[((colorIndex % theme.palette.length) + theme.palette.length) % theme.palette.length];
