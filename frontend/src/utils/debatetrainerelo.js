// Debate Trainer Elo utilities

(function(global){
  const DEFAULT_K = 24;

  function expectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  function updateElo(current, opponent, score, kFactor = DEFAULT_K) {
    const expected = expectedScore(current, opponent);
    const delta = kFactor * (score - expected);
    return Math.round(current + delta);
  }

  function simulateMatchOutcome(probWin) {
    return Math.random() < probWin ? 1 : 0;
  }

  class EloLadder {
    constructor(initialBots = []) {
      this.bots = new Map();
      initialBots.forEach(b => this.addBot(b.id, b.name, b.rating));
      this.history = [];
    }
  }

  global.DebateElo = { expectedScore, updateElo, EloLadder };
})(window);