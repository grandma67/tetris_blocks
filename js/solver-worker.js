// Runs the level solver off the main thread so the game keeps animating.
import { solveLevel } from './solver.js';

self.onmessage = (e) => {
  const { state, timeLimit } = e.data;
  self.postMessage(solveLevel(state, { timeLimit }));
};
