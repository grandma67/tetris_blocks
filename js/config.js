// Central tuning knobs. Everything gameplay-related lives here so balancing
// never requires touching logic code.
export const CONFIG = {
  // Defaults; players can change both in Settings.
  boardSize: 8,
  piecesPerRound: 3,
  boardSizes: [6, 7, 8, 9, 10],
  piecesRange: [1, 6],

  // Levels mode: reach a point target per level; each new level starts with
  // a fresh board seeded with stone blocks.
  levels: {
    // Gentle curve: ~+15 a level early on, reaching ~1500 around level 60.
    target: (n) => Math.round((100 + 15 * (n - 1) + 0.15 * (n - 1) ** 2) / 5) * 5,  // 100, 115, 130… 245 (L10), 440 (L20), 1505 (L60)
    stones: (n, size) => Math.min(Math.floor((n - 1) * 1.5), Math.floor(size * size * 0.3)),
    difficultyPerLevel: 350,    // levels ramp piece sizes like this many endless points
    modifiers: {
      from: 2,                  // level 1 always plays normally
      originalChance: 0.35,     // chance a level has no twist
      doubleFrom: 8,            // from here a level can get two twists
      doubleChance: 0.35,
      stoneEvery: 2,            // rounds between stone drops
      floorEvery: 3,            // rounds between stone-floor rows
    },
  },

  // Optional twists, each toggled in Settings.
  defaultTwists: { rotate: true, bombs: true },
  rotate: {
    start: 3,                   // tokens at the start of a game
    max: 9,
    earnLines: 3,               // clearing this many lines at once earns a token (so does a board clear)
  },
  bombs: {
    chance: 0.1,                // per dealt piece
    perBlastCell: 3,            // points for each extra block a blast destroys
  },

  scoring: {
    perCell: 1,                 // points per block placed
    lineBase: 10,               // lines L cleared at once => lineBase * L*(L+1)/2
    comboStep: 0.5,             // multiplier grows by this per consecutive clearing move
    comboGrace: 3,              // moves without a clear before the streak breaks
    boardClearBonus: 300,       // emptying the whole board
  },

  // Thresholds for the "big clear" celebration tiers.
  fx: {
    bigLines: 2,
    hugeLines: 3,
    epicLines: 4,
  },

  // Piece generator: tries to deal at least one placeable piece.
  generator: {
    fairnessAttempts: 25,
    levelStartAttempts: 40,     // draws per slot for a level's opening tray, which must fit in full
  },

  // 🤖 Level solver: search time cap and playback pacing.
  solver: {
    timeLimit: 10000,           // ms; give up and say so after this
    stepPause: 300,             // ms between solution steps once the board settles
  },

  highscoreSlots: 10,
  storagePrefix: 'blockfit.',
};
