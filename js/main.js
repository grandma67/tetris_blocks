// App controller: wires the pure game model to rendering, input, sound & fx.
import { CONFIG } from './config.js';
import { Game } from './game.js';
import { Renderer, buildPieceEl } from './renderer.js';
import { DragController } from './input.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Storage, modeKey } from './storage.js';
import { THEMES, themeById, applyTheme, colorFor } from './themes.js';
import { SHAPES, makePiece } from './pieces.js';
import { MODIFIERS } from './modifiers.js';

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const settings = Storage.getSettings();
let theme = themeById(settings.theme);
const gameOpts = (gameMode = settings.gameMode) => ({ mode: gameMode, size: settings.boardSize, pieces: settings.pieces, twists: settings.twists });
const loadGame = (gameMode) => Game.fromJSON(Storage.getSavedGame(gameMode), gameOpts(gameMode)) || new Game(gameOpts(gameMode));
let game = loadGame(settings.gameMode);
const mode = () => modeKey(game.size, game.piecesPerRound, game.twists, game.mode);
let busy = false; // true during the level-complete transition
/** Tray hint: fits as-is, fits only if rotated, or not at all. */
const fitOf = (p) => (game.fits(p) ? 'fits' : game.fitsRotated(p) ? 'rotate' : 'no');
let bestAtStart = Storage.best(mode());
let shownScore = game.score;
let gameOverHandled = false;

const renderer = new Renderer({ boardEl: $('board'), boardFxEl: $('boardFx'), trayEl: $('tray'), size: game.size });
const fx = new FX({ fxCanvas: $('fx'), ambientCanvas: $('ambient'), shakeTarget: $('app'), textLayer: $('textLayer') });

// ---------------------------------------------------------------- Theme & sound

function setTheme(t) {
  theme = t;
  applyTheme(t);
  fx.setTheme(t);
  settings.theme = t.id;
  Storage.setSettings(settings);
  document.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('active', c.dataset.id === t.id));
}

function setSound(on) {
  settings.sound = on;
  Sound.setEnabled(on);
  $('btnSound').textContent = on ? '🔊' : '🔇';
  Storage.setSettings(settings);
}

// ---------------------------------------------------------------- HUD

function animateScore() {
  const target = game.score;
  const start = shownScore;
  const t0 = performance.now();
  const dur = Math.min(700, 200 + Math.abs(target - start) * 4);
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    shownScore = Math.round(start + (target - start) * (1 - (1 - k) ** 3));
    $('score').textContent = shownScore.toLocaleString();
    updateBest();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  const el = $('score');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateBest() {
  const best = Math.max(bestAtStart, shownScore);
  $('best').textContent = best.toLocaleString();
  $('best').parentElement.classList.toggle('beating', bestAtStart > 0 && shownScore > bestAtStart);
}

function updateCombo() {
  const el = $('combo');
  if (game.combo >= 2) {
    el.textContent = `🔥 Combo x${game.combo}`;
    el.classList.add('show');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  } else {
    el.classList.remove('show');
  }
}

function renderAll() {
  renderer.renderBoard(game.grid, game.bombs);
  renderer.renderTray(game.tray, fitOf);
  $('score').textContent = game.score.toLocaleString();
  shownScore = game.score;
  updateBest();
  updateCombo();
  updateTokens();
  updateLevelHud();
  updateModBadge();
  document.querySelectorAll('[data-twist]').forEach((el) => (el.hidden = !game.twists[el.dataset.twist]));
}

function updateLevelHud(complete = false) {
  const levels = game.mode === 'levels';
  $('bestStat').hidden = levels;
  $('levelStat').hidden = !levels;
  $('levelBar').hidden = !levels;
  if (!levels) return;
  const target = game.levelTarget;
  const done = complete ? target : Math.min(game.levelScore, target);
  $('levelNum').textContent = complete ? game.level - 1 : game.level;
  $('levelProgress').textContent = complete ? 'Clear!' : `${done.toLocaleString()} / ${target.toLocaleString()}`;
  $('levelFill').style.width = `${complete ? 100 : (done / target) * 100}%`;
  $('levelBar').classList.toggle('full', complete);
}

function modifierSummary(g = game) {
  return g.modifiers.map((m) => `${MODIFIERS[m].icon} ${MODIFIERS[m].name}`).join(' · ');
}

/** Badge above the tray: the level's twists and countdowns to the next event. */
function updateModBadge() {
  const el = $('modBadge');
  const show = game.mode === 'levels' && game.modifiers.length > 0;
  el.hidden = !show;
  if (!show) return;
  const when = (n) => (n === 0 ? 'next round' : `in ${n + 1} rounds`);
  el.textContent = game.modifiers
    .map((m) => {
      const { icon, name, short } = MODIFIERS[m];
      return m === 'gravity' ? `${icon} ${name}` : `${icon} ${short} ${when(game.roundsUntil(m))}`;
    })
    .join('  ·  ');
}

function levelIntro() {
  const wrap = $('boardWrap').getBoundingClientRect();
  const mods = modifierSummary();
  fx.floatText(`Level ${game.level} · Goal ${game.levelTarget.toLocaleString()}`, wrap.left + wrap.width / 2, wrap.top + wrap.height / 2 - (mods ? 22 : 0), 'praise t1');
  if (mods) setTimeout(() => fx.floatText(mods, wrap.left + wrap.width / 2, wrap.top + wrap.height / 2 + 30, 'hint'), 250);
}

function updateTokens(bump = false) {
  const el = $('tokens');
  el.hidden = !game.twists.rotate;
  $('tokenCount').textContent = game.rotations;
  el.classList.toggle('empty', game.rotations === 0);
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

/** Short message floating over the tray. */
function hint(text) {
  const r = $('tray').getBoundingClientRect();
  fx.floatText(text, r.left + r.width / 2, r.top + 24, 'hint');
}

// ---------------------------------------------------------------- Twists

function onTap(pieceId) {
  if (!game.twists.rotate) return;
  const res = game.rotatePiece(pieceId);
  if (res.ok) {
    renderer.replaceTrayPiece(res.piece, fitOf);
    renderer.updateTrayFit(fitOf, game.tray);
    Sound.rotate();
    updateTokens(true);
    if (game.over) {
      Storage.clearSavedGame(game.mode);
      setTimeout(handleGameOver, 400);
    } else {
      Storage.saveGame(game.toJSON());
    }
    return;
  }
  const el = renderer.pieceEl(pieceId);
  el?.classList.remove('wiggle');
  void el?.offsetWidth;
  el?.classList.add('wiggle');
  Sound.invalid();
  if (res.reason === 'empty') hint('No rotations left — clear 3+ lines to earn one');
  else if (res.reason === 'symmetric') hint('This piece looks the same rotated');
}

const BOOM_COLORS = ['#ff7b1c', '#ffd23f', '#ff3b30', '#ffffff'];

function explode(res) {
  const m = renderer.metrics();
  res.explosions.forEach((b, i) => {
    setTimeout(() => {
      const p = renderer.cellCenter(b);
      for (const c of BOOM_COLORS) fx.burst(p.x, p.y, c, 14, 1.6);
      fx.shockwave(p.x, p.y, '#ff7b1c', m.step * 2.4, 10);
      fx.shockwave(p.x, p.y, '#ffd23f', m.step * 1.4, 6);
      fx.shake(2.5);
      fx.flash();
      Sound.boom();
      if (i === 0) {
        // Centered horizontally on the board so long text never clips at the edge.
        const wrap = $('boardWrap').getBoundingClientRect();
        const text = res.explosions.length > 1 ? `CHAIN x${res.explosions.length}!` : 'BOOM!';
        fx.floatText(text, wrap.left + wrap.width / 2, p.y - m.step, 'praise t2 boom');
      }
    }, 90 + i * 170);
  });
  if (res.blasted.length) renderer.animateClear(res.blasted, res.explosions[0], 3);
}

// ---------------------------------------------------------------- Celebrations

function celebrate(res) {
  const { lineCount, combo, boardClear } = res;
  const { bigLines, hugeLines, epicLines } = CONFIG.fx;
  let tier = lineCount >= epicLines ? 3 : lineCount >= hugeLines ? 2 : lineCount >= bigLines ? 1 : 0;
  if (combo >= 4) tier = Math.min(3, tier + 1);

  const wrap = $('boardWrap').getBoundingClientRect();
  const cx = wrap.left + wrap.width / 2;
  const cy = wrap.top + wrap.height / 2;
  const accent = theme.palette[0];

  // Particles from every cleared block.
  const perBlock = tier >= 2 ? 6 : 4;
  for (const { index, color } of res.cleared) {
    const p = renderer.cellCenter(index);
    fx.burst(p.x, p.y, colorFor(theme, color), perBlock, 0.8 + tier * 0.25);
  }

  if (tier >= 1) fx.shake(tier);
  if (tier >= 2) {
    fx.shockwave(cx, cy, accent, wrap.width * 0.8, 8);
    fx.flash();
  }
  if (tier >= 3) {
    setTimeout(() => fx.shockwave(cx, cy, theme.palette[1], wrap.width, 5), 150);
    fx.fireworks(theme.palette, 5);
    $('boardWrap').classList.remove('rainbow');
    void $('boardWrap').offsetWidth;
    $('boardWrap').classList.add('rainbow');
  }

  if (boardClear) {
    setTimeout(() => {
      fx.floatText(theme.praise.boardClear, cx, cy - 30, 'mega');
      fx.floatText(`+${CONFIG.scoring.boardClearBonus}`, cx, cy + 30, 'bonus');
      fx.fireworks(theme.palette, 8);
      fx.confetti(theme.palette, 140);
      fx.shake(3);
      Sound.boardClear();
    }, 250);
  } else if (tier >= 1) {
    const words = tier === 3 ? theme.praise.epic : tier === 2 ? theme.praise.huge : theme.praise.big;
    fx.floatText(pick(words), cx, cy - 20, `praise t${tier}`);
  }

  if (combo >= 2) {
    setTimeout(() => fx.floatText(`Combo x${combo}`, cx, cy + 40, 'combo-text'), tier >= 1 ? 180 : 0);
  }
}

// ---------------------------------------------------------------- Game flow

function onDrop(pieceId, row, col) {
  const res = game.tryPlace(pieceId, row, col);
  if (!res.ok) return;

  // The model has already resolved everything; replay it in order:
  // drop & first clear → gravity cascades → refill events → level change / game over.
  const firstGrid = res.lineCount ? res.firstGrid : res.settled.grid;
  const firstBombs = res.lineCount ? res.firstBombs : res.settled.bombs;
  renderer.renderBoard(firstGrid, firstBombs);
  renderer.animatePlace(res.placedCells.filter((i) => firstGrid[i] !== null));
  Sound.drop();

  const anchor = renderer.cellCenter(res.placedCells[0]);
  fx.floatText(`+${res.points}`, anchor.x, anchor.y, 'points');

  if (res.lineCount) {
    const intensity = res.lineCount + (res.combo >= 4 ? 1 : 0);
    renderer.flashLines(res.lines);
    renderer.animateClear(res.cleared, res.placedCells[Math.floor(res.placedCells.length / 2)], intensity);
    Sound.clear(res.lineCount, res.combo);
    celebrate(res);
    if (res.explosions.length) explode(res);
  }

  if (res.tokenEarned) {
    const t = $('tokens').getBoundingClientRect();
    setTimeout(() => {
      fx.floatText('+1 ↻', t.left + t.width / 2, t.top, 'bonus token-text');
      updateTokens(true);
    }, 300);
    Sound.token();
  } else {
    updateTokens();
  }

  animateScore();
  updateCombo();
  updateLevelHud(!!res.levelUp);
  Storage.saveGame(game.toJSON());

  // Remove the used piece from the tray right away.
  $('tray').querySelector(`[data-piece-id="${pieceId}"]`)?.remove();

  const stepMs = 480;
  const cascadeMs = res.steps.length ? 380 + res.steps.length * stepMs : 0;
  res.steps.forEach((step, i) => setTimeout(() => playCascadeStep(step), 380 + i * stepMs));

  const needsPause = cascadeMs > 0 || res.levelUp || res.roundEvents;
  if (needsPause) busy = true;
  setTimeout(() => afterSettle(res), cascadeMs);
}

/** One gravity step: blocks fall, then any lines they complete clear. */
function playCascadeStep(step) {
  renderer.renderBoard(step.grid, step.bombs);
  renderer.animateFall(step.fallen);
  Sound.thud();
  if (!step.lineCount) return;
  setTimeout(() => {
    renderer.renderBoard(step.after, step.afterBombs);
    renderer.flashLines(step.lines);
    const center = step.cleared[Math.floor(step.cleared.length / 2)].index;
    renderer.animateClear(step.cleared, center, step.lineCount + 1);
    Sound.clear(step.lineCount, step.combo);
    for (const { index, color } of step.cleared) {
      const p = renderer.cellCenter(index);
      fx.burst(p.x, p.y, colorFor(theme, color), 4, 1);
    }
    const wrap = $('boardWrap').getBoundingClientRect();
    fx.floatText(`Cascade x${step.combo}! +${step.points}`, wrap.left + wrap.width / 2, wrap.top + wrap.height / 2, 'praise t1');
    fx.shake(1);
    if (step.explosions.length) explode(step);
    updateCombo();
  }, 200);
}

/** Everything after the board has settled: level change, refill events, tray, game over. */
function afterSettle(res) {
  if (res.levelUp) {
    $('tray').querySelectorAll('.piece').forEach((el) => el.classList.add('leaving'));
    setTimeout(() => levelComplete(res), res.lineCount ? 650 : 250);
    return;
  }

  const ev = res.roundEvents;
  if (ev) {
    renderer.renderBoard(game.grid, game.bombs);
    const wrap = $('boardWrap').getBoundingClientRect();
    if (ev.rise) {
      renderer.animateRise();
      Sound.rise();
      fx.shake(1.5);
      fx.floatText(ev.rise.overflow ? 'Crushed!' : '⬆ Floor rises!', wrap.left + wrap.width / 2, wrap.top + wrap.height * 0.75, 'combo-text');
    }
    if (ev.stone !== undefined) {
      renderer.animateStone(ev.stone);
      setTimeout(() => {
        Sound.thud();
        fx.shake(0.6);
      }, 250);
    }
  }

  setTimeout(
    () => {
      if (res.newRound) {
        renderer.renderTray(game.tray, fitOf);
        Sound.newRound();
      } else {
        renderer.updateTrayFit(fitOf, game.tray);
      }
      updateModBadge();
      busy = false;
      if (res.gameOver) {
        Storage.clearSavedGame(game.mode);
        setTimeout(handleGameOver, res.lineCount ? 700 : 400);
      }
    },
    ev ? 550 : res.newRound ? 120 : 0,
  );
}

/** Level clear celebration, then reveal the next level's board. */
function levelComplete(res) {
  const wrap = $('boardWrap').getBoundingClientRect();
  const cx = wrap.left + wrap.width / 2;
  const cy = wrap.top + wrap.height / 2;
  fx.floatText(`LEVEL ${res.levelUp.level} CLEAR!`, cx, cy - 20, 'mega');
  fx.fireworks(theme.palette, 5);
  fx.confetti(theme.palette, 90);
  Sound.boardClear();
  if (res.levelUp.tokenBonus) {
    const t = $('tokens').getBoundingClientRect();
    setTimeout(() => {
      fx.floatText('+1 ↻', t.left + t.width / 2, t.top, 'bonus token-text');
      updateTokens(true);
      Sound.token();
    }, 600);
  }
  // Sweep the old blocks away.
  const old = [];
  res.levelUp.grid.forEach((color, index) => color !== null && old.push({ index, color }));
  setTimeout(() => {
    renderer.renderBoard(res.levelUp.grid.map(() => null));
    renderer.animateClear(old, Math.floor((game.size * game.size) / 2), 2);
  }, 500);
  setTimeout(() => {
    renderer.renderBoard(game.grid, game.bombs);
    renderer.animatePlace(game.grid.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0));
    renderer.renderTray(game.tray, fitOf);
    updateLevelHud();
    updateCombo();
    Sound.newRound();
    updateModBadge();
    levelIntro();
    busy = false;
    if (game.over) {
      Storage.clearSavedGame(game.mode);
      setTimeout(handleGameOver, 600);
    }
  }, 1700);
}

function handleGameOver() {
  if (gameOverHandled) return;
  gameOverHandled = true;
  Sound.gameOver();
  renderer.gameOverWave();

  const prevBest = Storage.best(mode());
  const levels = game.mode === 'levels';
  const rank = Storage.addHighscore(mode(), {
    score: game.score,
    lines: game.stats.lines,
    bestCombo: game.stats.bestCombo,
    ...(levels ? { level: game.level } : {}),
  });
  const record = rank === 0 && game.score > prevBest;

  setTimeout(() => {
    $('goScore').textContent = game.score.toLocaleString();
    $('goBadge').textContent = record ? '👑 NEW HIGH SCORE!' : rank > 0 ? `🏅 #${rank + 1} on the board` : '';
    $('goBadge').classList.toggle('show', rank >= 0);
    $('goStats').innerHTML = `
      ${levels ? `<div><b>${game.level}</b><span>level</span></div>` : ''}
      <div><b>${game.stats.lines}</b><span>lines</span></div>
      <div><b>${game.stats.bestCombo}</b><span>best combo</span></div>
      ${levels ? '' : `<div><b>${game.stats.moves}</b><span>moves</span></div>`}`;
    openModal('gameOverModal');
    if (record) {
      fx.confetti(theme.palette, 160);
      fx.fireworks(theme.palette, 6);
      Sound.highscore();
    }
  }, 1300);
}

function newGame() {
  closeAllModals();
  Storage.clearSavedGame(game.mode);
  game = new Game(gameOpts(game.mode));
  if (renderer.size !== game.size) renderer.setSize(game.size);
  bestAtStart = Storage.best(mode());
  gameOverHandled = false;
  busy = false;
  renderer.clearGameOver();
  renderAll();
  Storage.saveGame(game.toJSON());
  updateHome();
  if (game.over) setTimeout(handleGameOver, 500);
}

// ---------------------------------------------------------------- Home page

const inProgress = () => !game.over && game.stats.moves > 0;

const savedFor = (gameMode) => (game.mode === gameMode ? game : Game.fromJSON(Storage.getSavedGame(gameMode), gameOpts(gameMode)));
const modeKeyFor = (gameMode) => modeKey(settings.boardSize, settings.pieces, settings.twists, gameMode);

function updateHome() {
  const lv = savedFor('levels');
  const en = savedFor('endless');
  const lvGoing = lv && !lv.over && (lv.stats.moves > 0 || lv.level > 1);
  const enGoing = en && !en.over && en.stats.moves > 0;
  $('homeLevelsSub').textContent = lvGoing
    ? `Continue · Level ${lv.level}${lv.modifiers.length ? ` ${lv.modifiers.map((m) => MODIFIERS[m].icon).join('')}` : ''} · ${lv.levelScore.toLocaleString()} / ${lv.levelTarget.toLocaleString()}`
    : 'Hit the goal score to level up';
  $('homeEndlessSub').textContent = enGoing ? `Continue · ${en.score.toLocaleString()}` : 'Classic — play until you run out of room';

  const bestLv = Storage.getHighscores(modeKeyFor('levels'))[0];
  const bestEn = Storage.best(modeKeyFor('endless'));
  const bests = [
    bestLv && `🎯 <b>Level ${bestLv.level ?? '?'}</b>`,
    bestEn && `∞ <b>${bestEn.toLocaleString()}</b>`,
  ].filter(Boolean);
  $('homeBest').hidden = !bests.length;
  $('homeBest').innerHTML = `<span>👑 Best</span> ${bests.join(' <span>·</span> ')}`;
  $('homeMode').textContent = `⚙️ ${modeLabel(settings.boardSize, settings.pieces, settings.twists)}`;

  // Restart applies to the mode played last.
  const going = game.mode === 'levels' ? lvGoing : enGoing;
  $('homeNew').hidden = !going;
  $('homeNew').textContent = `🔄 Restart ${game.mode === 'levels' ? 'Levels' : 'Endless'}`;
}

/** Make `gameMode` the active game, keeping the other mode's progress saved. */
function switchMode(gameMode) {
  if (game.mode === gameMode) return;
  if (!game.over) Storage.saveGame(game.toJSON());
  settings.gameMode = gameMode;
  Storage.setSettings(settings);
  game = loadGame(gameMode);
  if (renderer.size !== game.size) renderer.setSize(game.size);
  bestAtStart = Storage.best(mode());
  gameOverHandled = false;
  busy = false;
  renderer.clearGameOver();
  renderAll();
}

function showHome() {
  closeAllModals();
  updateHome();
  $('home').classList.add('show');
  $('home').inert = false;
}

function hideHome() {
  $('home').classList.remove('show');
  $('home').inert = true;
}

function play(gameMode) {
  switchMode(gameMode);
  if (game.over) newGame();
  hideHome();
  renderer.renderTray(game.tray, fitOf); // tray size depends on layout; re-measure once visible
  if (game.mode === 'levels' && game.levelScore === 0) setTimeout(levelIntro, 350);
  try {
    if (!localStorage.getItem(CONFIG.storagePrefix + 'seenHelp')) {
      localStorage.setItem(CONFIG.storagePrefix + 'seenHelp', '1');
      openModal('helpModal');
    }
  } catch {
    /* storage unavailable */
  }
}

/** Slowly drifting pieces behind the menu, drawn with the theme's block style. */
function buildHomeDeco() {
  const deco = $('homeDeco');
  deco.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const el = buildPieceEl(makePiece(shape.key, -1 - i), 16 + Math.round(Math.random() * 14), 3, 'piece deco');
    el.style.left = `${(i / 9) * 100 + Math.random() * 6}%`;
    el.style.animationDuration = `${16 + Math.random() * 12}s`;
    el.style.animationDelay = `${-Math.random() * 25}s`;
    el.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120)}deg`);
    deco.appendChild(el);
  }
}

// ---------------------------------------------------------------- Modals

function openModal(id) {
  closeAllModals();
  const d = $(id);
  if (id === 'scoresModal') renderScores();
  d.showModal();
}

function closeAllModals() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}

function renderScores() {
  const list = Storage.getHighscores(mode());
  $('scoresMode').textContent = `${game.mode === 'levels' ? '🎯 Levels' : '∞ Endless'} · ${modeLabel(game.size, game.piecesPerRound, game.twists)}`;
  $('scoresList').innerHTML = list.length
    ? list
        .map(
          (s, i) =>
            `<li><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="pts">${s.score.toLocaleString()}</span><span class="meta">${s.level ? `Level ${s.level} · ` : ''}${s.lines ?? 0} lines · ${new Date(s.at).toLocaleDateString()}</span></li>`,
        )
        .join('')
    : '<li class="empty">No scores yet — go play!</li>';
}

// ---------------------------------------------------------------- Settings

const SIZE_HINTS = { 6: 'Tight — little room to recover', 7: 'Snug', 8: 'Classic', 9: 'Roomy', 10: 'Huge — long games' };
const modeLabel = (size, pieces, twists = {}) =>
  `${size}×${size} board · ${pieces} piece${pieces > 1 ? 's' : ''} per round` +
  (twists.rotate ? ' · ↻ rotate' : '') +
  (twists.bombs ? ' · 💣 bombs' : '');
const pendingChanged = () =>
  pending.boardSize !== game.size ||
  pending.pieces !== game.piecesPerRound ||
  pending.twists.rotate !== game.twists.rotate ||
  pending.twists.bombs !== game.twists.bombs;
const pending = {};

function segmented(el, values, current, label, onPick) {
  el.innerHTML = '';
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button';
    b.role = 'radio';
    b.textContent = label(v);
    b.setAttribute('aria-checked', String(v === current));
    b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      onPick(v);
    });
    el.appendChild(b);
  }
}

function updateSettingsHints() {
  $('sizeHint').textContent = SIZE_HINTS[pending.boardSize] || '';
  $('piecesHint').textContent = `${pending.pieces} new piece${pending.pieces > 1 ? 's' : ''} once the tray is empty`;
  const changed = pendingChanged();
  const inProgress = !game.over && game.stats.moves > 0;
  $('settingsWarn').style.visibility = changed && inProgress ? 'visible' : 'hidden';
  $('btnApplySettings').textContent = changed ? (inProgress ? 'Apply & restart' : 'Apply') : 'Done';
}

function openSettings() {
  pending.boardSize = game.size;
  pending.pieces = game.piecesPerRound;
  pending.twists = { ...game.twists };
  $('optRotate').checked = pending.twists.rotate;
  $('optBombs').checked = pending.twists.bombs;
  const [lo, hi] = CONFIG.piecesRange;
  const counts = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  segmented($('optSize'), CONFIG.boardSizes, pending.boardSize, (v) => `${v}×${v}`, (v) => {
    pending.boardSize = v;
    updateSettingsHints();
  });
  segmented($('optPieces'), counts, pending.pieces, String, (v) => {
    pending.pieces = v;
    updateSettingsHints();
  });
  updateSettingsHints();
  openModal('settingsModal');
}

function applySettings() {
  if (!pendingChanged()) return closeAllModals();
  settings.boardSize = pending.boardSize;
  settings.pieces = pending.pieces;
  settings.twists = { ...pending.twists };
  Storage.setSettings(settings);
  newGame();
}

// A little piece cluster (4×3) drawn with each theme's own block style.
const PREVIEW_CELLS = [0, 0, 0, null, null, 0, 1, 1, 2, 2, null, 1];

function buildThemeGrid() {
  $('themeGrid').innerHTML = '';
  for (const t of THEMES) {
    const card = document.createElement('button');
    card.className = 'theme-card';
    card.dataset.id = t.id;
    card.style.background = t.vars['--bg'];
    card.style.color = t.vars['--text'];
    card.style.fontFamily = t.vars['--font'];
    card.style.setProperty('--radius', t.vars['--radius']);
    card.innerHTML = `
      <div class="swatches">${PREVIEW_CELLS.map((c) =>
        c === null ? '<i></i>' : `<i class="block preview bs-${t.block}" style="--c:${t.palette[c]}"></i>`,
      ).join('')}</div>
      <div class="theme-name">${t.icon} ${t.name}</div>`;
    card.addEventListener('click', () => {
      settings.themeChosen = true;
      setTheme(t);
    });
    $('themeGrid').appendChild(card);
  }
}

// ---------------------------------------------------------------- Wiring

new DragController({
  trayEl: $('tray'),
  renderer,
  getGame: () => game,
  previewLines: (piece, row, col) => game.previewClear(piece, row, col),
  onDrop,
  onPick: () => {
    Sound.unlock();
    Sound.pick();
  },
  onCancel: () => Sound.invalid(),
  onTap,
  isBusy: () => busy,
});

$('btnMenu').addEventListener('click', showHome);
$('btnTheme').addEventListener('click', () => openModal('themeModal'));
$('btnSound').addEventListener('click', () => {
  setSound(!settings.sound);
  Sound.unlock();
  Sound.pick();
});
$('btnPlayAgain').addEventListener('click', newGame);
$('btnConfirmNew').addEventListener('click', () => {
  newGame();
  hideHome();
});
$('btnApplySettings').addEventListener('click', applySettings);
$('tokens').addEventListener('click', () => hint(game.rotations ? 'Tap a piece to rotate it' : 'Clear 3+ lines at once to earn a rotation'));
$('optRotate').addEventListener('change', (e) => {
  pending.twists.rotate = e.target.checked;
  updateSettingsHints();
});
$('optBombs').addEventListener('change', (e) => {
  pending.twists.bombs = e.target.checked;
  updateSettingsHints();
});
$('btnClearScores').addEventListener('click', () => {
  Storage.clearHighscores(mode());
  bestAtStart = 0;
  updateBest();
  renderScores();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action], [data-close]');
  if (!btn) return;
  if (btn.hasAttribute('data-close')) return btn.closest('dialog').close();
  const action = btn.dataset.action;
  if (action === 'play-levels') play('levels');
  else if (action === 'play-endless') play('endless');
  else if (action === 'home') showHome();
  else if (action === 'new') {
    if (inProgress()) openModal('confirmModal');
    else {
      newGame();
      hideHome();
    }
  } else if (action === 'scores') openModal('scoresModal');
  else if (action === 'themes') openModal('themeModal');
  else if (action === 'settings') openSettings();
  else if (action === 'help') openModal('helpModal');
});

// Click on the dim backdrop closes a dialog (except game over).
document.querySelectorAll('dialog').forEach((d) =>
  d.addEventListener('click', (e) => {
    if (e.target === d && d.id !== 'gameOverModal') d.close();
  }),
);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderer.renderTray(game.tray, fitOf), 150);
});

// ---------------------------------------------------------------- Boot

buildThemeGrid();
setTheme(theme);
setSound(settings.sound);
renderAll();
// Samsung Internet can force-darken pages regardless of what the page declares,
// so explain the browser setting once.
function showDarkTipOnce() {
  try {
    const samsungDark = /SamsungBrowser/i.test(navigator.userAgent) && matchMedia('(prefers-color-scheme: dark)').matches;
    if (!samsungDark || localStorage.getItem(CONFIG.storagePrefix + 'seenDarkTip')) return false;
    localStorage.setItem(CONFIG.storagePrefix + 'seenDarkTip', '1');
    openModal('darkTipModal');
    return true;
  } catch {
    return false;
  }
}

// The game always opens on the home page.
if (game.over) newGame();
buildHomeDeco();
showHome();
showDarkTipOnce();
