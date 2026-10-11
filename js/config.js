// Central tuning knobs. Everything gameplay-related lives here so balancing
// never requires touching logic code.
export const CONFIG = {
  boardSize: 8,
  piecesPerRound: 3,

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
