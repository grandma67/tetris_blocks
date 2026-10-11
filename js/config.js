// Central tuning knobs. Everything gameplay-related lives here so balancing
// never requires touching logic code.
export const CONFIG = {
  // Defaults; players can change both in Settings.
  boardSize: 8,
  piecesPerRound: 3,
  boardSizes: [6, 7, 8, 9, 10],
  piecesRange: [1, 6],

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
  },

  highscoreSlots: 10,
  storagePrefix: 'blockfit.',
};
