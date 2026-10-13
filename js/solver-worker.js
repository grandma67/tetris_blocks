// Runs the level solver off the main thread so the game keeps animating.
import { Game } from './game.js';
import { solveLevel } from './solver.js';

self.onmessage = (e) => {
  const { state, timeLimit } = e.data;
  const game = Game.fromJSON(state, { mode: 'levels', size: state.size, pieces: state.pieces, twists: state.twists });
  self.postMessage(solveLevel(game, { timeLimit }));
};
