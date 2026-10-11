// App controller: wires the pure game model to rendering, input, sound & fx.
import { CONFIG } from './config.js';
import { Game } from './game.js';
import { previewLines } from './board.js';
import { Renderer } from './renderer.js';
import { DragController } from './input.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { Storage } from './storage.js';
import { THEMES, themeById, applyTheme, colorFor } from './themes.js';

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const settings = Storage.getSettings();
let theme = themeById(settings.theme);
let game = Game.fromJSON(Storage.getSavedGame()) || new Game();
let bestAtStart = Storage.best();
let shownScore = game.score;
let gameOverHandled = false;

const renderer = new Renderer({ boardEl: $('board'), boardFxEl: $('boardFx'), trayEl: $('tray'), size: CONFIG.boardSize });
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
  renderer.renderBoard(game.grid);
  renderer.renderTray(game.tray, (p) => game.fits(p));
  $('score').textContent = game.score.toLocaleString();
  shownScore = game.score;
  updateBest();
  updateCombo();
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

  renderer.renderBoard(game.grid);
  const survivors = res.placedCells.filter((i) => game.grid[i] !== null);
  renderer.animatePlace(survivors);
  Sound.drop();

  // Floating score near the dropped piece.
  const anchor = renderer.cellCenter(res.placedCells[0]);
  fx.floatText(`+${res.points}`, anchor.x, anchor.y, 'points');

  if (res.lineCount) {
    const intensity = res.lineCount + (res.combo >= 4 ? 1 : 0);
    renderer.flashLines(res.lines);
    renderer.animateClear(res.cleared, res.placedCells[Math.floor(res.placedCells.length / 2)], intensity);
    Sound.clear(res.lineCount, res.combo);
    celebrate(res);
  }

  animateScore();
  updateCombo();

  if (res.newRound) {
    setTimeout(() => {
      renderer.renderTray(game.tray, (p) => game.fits(p));
      Sound.newRound();
    }, 120);
  } else {
    const slot = $('tray').querySelector(`[data-piece-id="${pieceId}"]`);
    slot?.remove();
    renderer.updateTrayFit((p) => game.fits(p), game.tray);
  }

  if (res.gameOver) {
    Storage.clearSavedGame();
    setTimeout(handleGameOver, res.lineCount ? 900 : 500);
  } else {
    Storage.saveGame(game.toJSON());
  }
}

function handleGameOver() {
  if (gameOverHandled) return;
  gameOverHandled = true;
  Sound.gameOver();
  renderer.gameOverWave();

  const prevBest = Storage.best();
  const rank = Storage.addHighscore({ score: game.score, lines: game.stats.lines, bestCombo: game.stats.bestCombo });
  const record = rank === 0 && game.score > prevBest;

  setTimeout(() => {
    $('goScore').textContent = game.score.toLocaleString();
    $('goBadge').textContent = record ? '👑 NEW HIGH SCORE!' : rank > 0 ? `🏅 #${rank + 1} on the board` : '';
    $('goBadge').classList.toggle('show', rank >= 0);
    $('goStats').innerHTML = `
      <div><b>${game.stats.lines}</b><span>lines</span></div>
      <div><b>${game.stats.bestCombo}</b><span>best combo</span></div>
      <div><b>${game.stats.moves}</b><span>moves</span></div>`;
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
  Storage.clearSavedGame();
  game = new Game();
  bestAtStart = Storage.best();
  gameOverHandled = false;
  renderer.clearGameOver();
  renderAll();
  Storage.saveGame(game.toJSON());
  if (game.over) setTimeout(handleGameOver, 500);
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
  const list = Storage.getHighscores();
  $('scoresList').innerHTML = list.length
    ? list
        .map(
          (s, i) =>
            `<li><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="pts">${s.score.toLocaleString()}</span><span class="meta">${s.lines ?? 0} lines · ${new Date(s.at).toLocaleDateString()}</span></li>`,
        )
        .join('')
    : '<li class="empty">No scores yet — go play!</li>';
}

function buildThemeGrid() {
  $('themeGrid').innerHTML = '';
  for (const t of THEMES) {
    const card = document.createElement('button');
    card.className = 'theme-card';
    card.dataset.id = t.id;
    card.style.background = t.vars['--bg'];
    card.style.color = t.vars['--text'];
    card.style.fontFamily = t.vars['--font'];
    card.innerHTML = `
      <div class="swatches">${t.palette
        .slice(0, 6)
        .map((c) => `<i class="swatch" style="--c:${c}"></i>`)
        .join('')}</div>
      <div class="theme-name">${t.icon} ${t.name}</div>`;
    card.addEventListener('click', () => setTheme(t));
    $('themeGrid').appendChild(card);
  }
}

// ---------------------------------------------------------------- Wiring

new DragController({
  trayEl: $('tray'),
  renderer,
  getGame: () => game,
  previewLines: (piece, row, col) => previewLines(game.grid, game.size, piece.shape, row, col),
  onDrop,
  onPick: () => {
    Sound.unlock();
    Sound.pick();
  },
  onCancel: () => Sound.invalid(),
});

$('btnMenu').addEventListener('click', () => openModal('menuModal'));
$('btnTheme').addEventListener('click', () => openModal('themeModal'));
$('btnSound').addEventListener('click', () => {
  setSound(!settings.sound);
  Sound.unlock();
  Sound.pick();
});
$('btnPlayAgain').addEventListener('click', newGame);
$('btnConfirmNew').addEventListener('click', newGame);
$('btnClearScores').addEventListener('click', () => {
  Storage.clearHighscores();
  bestAtStart = 0;
  updateBest();
  renderScores();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action], [data-close]');
  if (!btn) return;
  if (btn.hasAttribute('data-close')) return btn.closest('dialog').close();
  const action = btn.dataset.action;
  if (action === 'new') {
    if (game.over || game.stats.moves === 0) newGame();
    else openModal('confirmModal');
  } else if (action === 'scores') openModal('scoresModal');
  else if (action === 'themes') openModal('themeModal');
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
  resizeTimer = setTimeout(() => renderer.renderTray(game.tray, (p) => game.fits(p)), 150);
});

// ---------------------------------------------------------------- Boot

buildThemeGrid();
setTheme(theme);
setSound(settings.sound);
renderAll();
if (game.over) handleGameOver();
else if (!Storage.getSavedGame()) {
  Storage.saveGame(game.toJSON());
  try {
    if (!localStorage.getItem(CONFIG.storagePrefix + 'seenHelp')) {
      localStorage.setItem(CONFIG.storagePrefix + 'seenHelp', '1');
      openModal('helpModal');
    }
  } catch {
    /* storage unavailable */
  }
}
