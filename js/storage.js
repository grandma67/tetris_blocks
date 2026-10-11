// localStorage wrapper. Storage can be unavailable (private mode, blocked
// cookies), so every access is guarded and the game works without it.
import { CONFIG } from './config.js';

const key = (k) => CONFIG.storagePrefix + k;

function read(k, fallback) {
  try {
    const raw = localStorage.getItem(key(k));
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(k, value) {
  try {
    if (value === undefined) localStorage.removeItem(key(k));
    else localStorage.setItem(key(k), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const DEFAULT_THEME = 'candy';

const clamp = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Score tables are kept per mode, since board size and piece count change what a score means. */
export const modeKey = (size, pieces, twists = {}, gameMode = 'endless') =>
  `${gameMode === 'levels' ? 'levels.' : ''}${size}x${pieces}` +
  `${twists.rotate || twists.bombs ? `+${twists.rotate ? 'r' : ''}${twists.bombs ? 'b' : ''}` : ''}`;
// The default mode keeps the original key so existing high scores survive.
const scoresKey = (mode) => (mode === modeKey(CONFIG.boardSize, CONFIG.piecesPerRound) ? 'highscores' : `highscores.${mode}`);

export const Storage = {
  getSettings() {
    const s = { theme: DEFAULT_THEME, sound: true, ...read('settings', {}) };
    if (!s.themeChosen) s.theme = DEFAULT_THEME;
    const sizes = CONFIG.boardSizes;
    s.boardSize = sizes.includes(s.boardSize) ? s.boardSize : CONFIG.boardSize;
    s.pieces = clamp(s.pieces, ...CONFIG.piecesRange, CONFIG.piecesPerRound);
    s.gameMode = s.gameMode === 'endless' ? 'endless' : 'levels';
    s.twists = { ...CONFIG.defaultTwists, ...(s.twists && typeof s.twists === 'object' ? s.twists : {}) };
    return s;
  },
  setSettings: (s) => write('settings', s),

  // One saved game per mode ('game' is the original endless key).
  getSavedGame: (gameMode = 'endless') => read(gameMode === 'levels' ? 'game.levels' : 'game', null),
  saveGame: (data) => write(data.mode === 'levels' ? 'game.levels' : 'game', data),
  clearSavedGame: (gameMode = 'endless') => write(gameMode === 'levels' ? 'game.levels' : 'game', undefined),

  // Levels progress: where a retry (or a fresh levels game) starts. Kept until
  // the player explicitly restarts from level 1.
  getLevelCheckpoint() {
    const cp = read('levels.checkpoint', null);
    return cp && Number.isInteger(cp.level) && cp.level >= 1 ? cp : null;
  },
  setLevelCheckpoint: (cp) => write('levels.checkpoint', cp),
  clearLevelCheckpoint: () => write('levels.checkpoint', undefined),

  getHighscores(mode) {
    const list = read(scoresKey(mode), []);
    return Array.isArray(list) ? list : [];
  },

  /** Inserts a result and returns its rank (0-based) or -1 if it didn't place. */
  addHighscore(mode, entry) {
    if (!entry.score) return -1;
    let list = this.getHighscores(mode);
    const record = { ...entry, at: Date.now() };
    // One row per levels run: a retry replaces that run's row if it did better.
    if (entry.runId) {
      const prev = list.find((e) => e.runId === entry.runId);
      if (prev && prev.score >= entry.score) return list.indexOf(prev);
      list = list.filter((e) => e.runId !== entry.runId);
    }
    list.push(record);
    list.sort((a, b) => b.score - a.score || a.at - b.at);
    const trimmed = list.slice(0, CONFIG.highscoreSlots);
    write(scoresKey(mode), trimmed);
    return trimmed.indexOf(record);
  },

  best(mode) {
    const list = this.getHighscores(mode);
    return list.length ? list[0].score : 0;
  },

  clearHighscores: (mode) => write(scoresKey(mode), []),
};
