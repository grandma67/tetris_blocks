import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Storage, modeKey, DEFAULT_THEME } from '../js/storage.js';
import { CONFIG } from '../js/config.js';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
beforeEach(() => mem.clear());

const DEFAULT_MODE = modeKey(CONFIG.boardSize, CONFIG.piecesPerRound);

test('mode keys separate size, pieces, twists and game mode', () => {
  assert.equal(modeKey(8, 3), '8x3');
  assert.equal(modeKey(8, 3, { rotate: true, bombs: true }), '8x3+rb');
  assert.equal(modeKey(8, 3, { rotate: false, bombs: true }), '8x3+b');
  assert.equal(modeKey(10, 5, {}, 'levels'), 'levels.10x5');
});

test('high scores are sorted, capped and kept per mode', () => {
  for (let s = 1; s <= CONFIG.highscoreSlots + 3; s++) Storage.addHighscore(DEFAULT_MODE, { score: s * 10 });
  const list = Storage.getHighscores(DEFAULT_MODE);
  assert.equal(list.length, CONFIG.highscoreSlots);
  assert.deepEqual(list.map((e) => e.score), [...list.map((e) => e.score)].sort((a, b) => b - a));
  assert.equal(Storage.best(DEFAULT_MODE), (CONFIG.highscoreSlots + 3) * 10);
  assert.equal(Storage.addHighscore(DEFAULT_MODE, { score: 1 }), -1, 'too low to place');
  assert.equal(Storage.addHighscore(DEFAULT_MODE, { score: 0 }), -1, 'zero never places');
  assert.ok(mem.has(CONFIG.storagePrefix + 'highscores'), 'default mode keeps the original key');

  assert.equal(Storage.best('levels.8x3'), 0, 'other modes are separate');
  assert.equal(Storage.addHighscore('levels.8x3', { score: 5 }), 0);
  Storage.clearHighscores(DEFAULT_MODE);
  assert.equal(Storage.best(DEFAULT_MODE), 0);
  assert.equal(Storage.best('levels.8x3'), 5);
});

test('a levels run keeps one row, replaced only by a better retry', () => {
  const mode = 'levels.8x3';
  Storage.addHighscore(mode, { score: 500, runId: 'a' });
  Storage.addHighscore(mode, { score: 300, runId: 'a' });
  assert.deepEqual(Storage.getHighscores(mode).map((e) => e.score), [500]);
  Storage.addHighscore(mode, { score: 800, runId: 'a' });
  Storage.addHighscore(mode, { score: 600, runId: 'b' });
  assert.deepEqual(Storage.getHighscores(mode).map((e) => [e.runId, e.score]), [['a', 800], ['b', 600]]);
});

test('settings fall back to sane defaults and clamp bad values', () => {
  let s = Storage.getSettings();
  assert.equal(s.theme, DEFAULT_THEME);
  assert.equal(s.boardSize, CONFIG.boardSize);
  assert.equal(s.pieces, CONFIG.piecesPerRound);
  assert.equal(s.gameMode, 'levels');
  assert.deepEqual(s.twists, CONFIG.defaultTwists);

  Storage.setSettings({ boardSize: 13, pieces: 99, gameMode: 'weird', twists: 'nope', theme: 'x' });
  s = Storage.getSettings();
  assert.equal(s.boardSize, CONFIG.boardSize);
  assert.equal(s.pieces, CONFIG.piecesRange[1]);
  assert.equal(s.gameMode, 'levels');
  assert.deepEqual(s.twists, CONFIG.defaultTwists);
  assert.equal(s.theme, DEFAULT_THEME, 'theme only sticks once the player chose one');

  Storage.setSettings({ boardSize: 10, pieces: 5, gameMode: 'endless', twists: { bombs: false }, theme: 'x', themeChosen: true });
  s = Storage.getSettings();
  assert.deepEqual([s.boardSize, s.pieces, s.gameMode, s.theme], [10, 5, 'endless', 'x']);
  assert.deepEqual(s.twists, { ...CONFIG.defaultTwists, bombs: false });
});

test('saved games are kept per game mode', () => {
  Storage.saveGame({ mode: 'endless', score: 1 });
  Storage.saveGame({ mode: 'levels', score: 2 });
  assert.equal(Storage.getSavedGame('endless').score, 1);
  assert.equal(Storage.getSavedGame('levels').score, 2);
  Storage.clearSavedGame('levels');
  assert.equal(Storage.getSavedGame('levels'), null);
  assert.equal(Storage.getSavedGame('endless').score, 1);
});

test('level checkpoint round-trips and ignores invalid data', () => {
  assert.equal(Storage.getLevelCheckpoint(), null);
  Storage.setLevelCheckpoint({ level: 4, score: 900 });
  assert.deepEqual(Storage.getLevelCheckpoint(), { level: 4, score: 900 });
  Storage.setLevelCheckpoint({ level: 0 });
  assert.equal(Storage.getLevelCheckpoint(), null);
  Storage.clearLevelCheckpoint();
  assert.equal(Storage.getLevelCheckpoint(), null);
});

test('corrupt or unavailable storage never throws', () => {
  mem.set(CONFIG.storagePrefix + 'highscores', '{not json');
  assert.deepEqual(Storage.getHighscores(DEFAULT_MODE), []);
  const real = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  try {
    assert.equal(Storage.getSettings().boardSize, CONFIG.boardSize);
    assert.equal(Storage.getSavedGame(), null);
    assert.doesNotThrow(() => Storage.saveGame({ mode: 'endless' }));
    assert.doesNotThrow(() => Storage.addHighscore(DEFAULT_MODE, { score: 10 }));
  } finally {
    globalThis.localStorage = real;
  }
});
