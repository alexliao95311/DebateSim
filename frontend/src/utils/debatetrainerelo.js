// Debate Trainer Elo utilities

const DEFAULT_K = 24;

export function expectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function updateElo(current, opponent, score, kFactor = DEFAULT_K) {
  const expected = expectedScore(current, opponent);
  const delta = kFactor * (score - expected);
  return Math.round(current + delta);
}

export function simulateMatchOutcome(probWin) {
  return Math.random() < probWin ? 1 : 0;
}

export class EloLadder {
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
  
  recordMatch(botAId, botBId, scoreA, kFactor = DEFAULT_K) {
    const a = this.bots.get(botAId);
    const b = this.bots.get(botBId);
    if (!a || !b) throw new Error('Both bots must exist to record a match');
    const scoreB = 1 - scoreA;
    const newA = updateElo(a.rating, b.rating, scoreA, kFactor);
    const newB = updateElo(b.rating, a.rating, scoreB, kFactor);
    a.games += 1; b.games += 1;
    if (scoreA === 1) { a.wins += 1; b.losses += 1; } else { b.wins += 1; a.losses += 1; }
    this.history.push({ ts: Date.now(), a: a.id, b: b.id, scoreA, beforeA: a.rating, beforeB: b.rating, afterA: newA, afterB: newB });
    a.rating = newA; b.rating = newB;
    return { a: { ...a }, b: { ...b } };
  }
}

// Also export as default object for backward compatibility
export default {
  expectedScore,
  updateElo,
  EloLadder
};