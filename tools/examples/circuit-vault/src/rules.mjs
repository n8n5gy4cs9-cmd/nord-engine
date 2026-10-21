// Pure server rules. The browser never submits an arbitrary score.
export function newRun(random = Math.random, now = Date.now()) {
  return { sequence: Array.from({ length: 6 }, () => Math.floor(random() * 4)),
    round: 1, cursor: 0, lives: 3, score: 0, done: false, won: false, deadline: now + 15000 };
}
export function publicRun(run) { return { ...run, sequence: run.sequence.slice(0, run.round) }; }
export function step(run, tile, now = Date.now()) {
  if (run.done) return publicRun(run);
  if (now > run.deadline || tile !== run.sequence[run.cursor]) {
    run.lives--; run.cursor = 0; run.deadline = now + 15000;
    if (run.lives === 0) run.done = true;
    return publicRun(run);
  }
  run.cursor++;
  if (run.cursor === run.round) {
    run.score += run.round * 100 + Math.max(0, Math.floor((run.deadline - now) / 100));
    run.cursor = 0;
    if (run.round === 6) { run.done = true; run.won = true; }
    else run.round++;
  }
  run.deadline = now + 15000;
  return publicRun(run);
}
