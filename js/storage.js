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

export const Storage = {
  getSettings: () => ({ theme: 'neon', sound: true, ...read('settings', {}) }),
  setSettings: (s) => write('settings', s),

  getSavedGame: () => read('game', null),
  saveGame: (data) => write('game', data),
  clearSavedGame: () => write('game', undefined),

  getHighscores: () => {
    const list = read('highscores', []);
    return Array.isArray(list) ? list : [];
  },

  /** Inserts a result and returns its rank (0-based) or -1 if it didn't place. */
  addHighscore(entry) {
    if (!entry.score) return -1;
    const list = this.getHighscores();
    const record = { ...entry, at: Date.now() };
    list.push(record);
    list.sort((a, b) => b.score - a.score || a.at - b.at);
    const trimmed = list.slice(0, CONFIG.highscoreSlots);
    write('highscores', trimmed);
    return trimmed.indexOf(record);
  },

  best() {
    const list = this.getHighscores();
    return list.length ? list[0].score : 0;
  },

  clearHighscores: () => write('highscores', []),
};
