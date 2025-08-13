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

 addBot(id, name, rating = 1500) {
      if (this.bots.has(id)) return this.bots.get(id);
      const bot = { id, name, rating, games: 0, wins: 0, losses: 0 };
      this.bots.set(id, bot);
      return bot;
    }

    listBots() {
      return Array.from(this.bots.values()).sort((a, b) => b.rating - a.rating);
    }
  }

  global.DebateElo = { expectedScore, updateElo, EloLadder };
})(window);