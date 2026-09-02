function opponentKey(firstId, secondId) {
  return [firstId, secondId].sort().join("::");
}

export function previousPairings(rounds = []) {
  const pairings = new Set();
  rounds.forEach(round => {
    round.matches.forEach(match => {
      if (match.p1 && match.p2) pairings.add(opponentKey(match.p1, match.p2));
    });
  });
  return pairings;
}

export function calculateStandings(tournament) {
  const initialOrder = tournament.bracket?.initialOrder || tournament.participants.map(item => item.id);
  const initialSeed = new Map(initialOrder.map((id, index) => [id, index]));
  const entries = tournament.participants.map(participant => ({
    id: participant.id,
    seedIndex: initialSeed.get(participant.id) ?? Number.MAX_SAFE_INTEGER,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    byes: 0,
    points: 0,
    gamesWon: 0,
    gamesLost: 0,
    gameWinRate: 0,
    opponents: [],
    omw: 0
  }));
  const byId = new Map(entries.map(entry => [entry.id, entry]));

  (tournament.bracket?.swissRounds || []).forEach(round => {
    round.matches.forEach(match => {
      if (!match.completedAt || !match.p1) return;
      const first = byId.get(match.p1);
      const second = match.p2 ? byId.get(match.p2) : null;
      if (!first) return;

      first.gamesWon += Number(match.wins1 || 0);
      first.gamesLost += Number(match.wins2 || 0);

      if (match.isBye) {
        first.played += 1;
        first.wins += 1;
        first.byes += 1;
        first.points += 3;
        return;
      }
      if (!second) return;

      second.gamesWon += Number(match.wins2 || 0);
      second.gamesLost += Number(match.wins1 || 0);
      first.played += 1;
      second.played += 1;
      first.opponents.push(second.id);
      second.opponents.push(first.id);

      if (match.result === "draw") {
        first.draws += 1;
        second.draws += 1;
        first.points += 1;
        second.points += 1;
      } else if (match.winnerId === first.id) {
        first.wins += 1;
        first.points += 3;
        second.losses += 1;
      } else if (match.winnerId === second.id) {
        second.wins += 1;
        second.points += 3;
        first.losses += 1;
      }
    });
  });

  const matchWinRate = entry => {
    if (!entry?.played) return 0.25;
    return Math.max(0.25, Math.min(1, (entry.wins + entry.draws * 0.5) / entry.played));
  };

  entries.forEach(entry => {
    const totalGames = entry.gamesWon + entry.gamesLost;
    entry.gameWinRate = totalGames ? entry.gamesWon / totalGames : 0;
    entry.omw = entry.opponents.length
      ? entry.opponents.reduce((sum, id) => sum + matchWinRate(byId.get(id)), 0) / entry.opponents.length
      : 0.25;
  });

  return entries.sort((first, second) =>
    second.points - first.points ||
    second.omw - first.omw ||
    second.gameWinRate - first.gameWinRate ||
    second.gamesWon - first.gamesWon ||
    first.seedIndex - second.seedIndex
  );
}

export { opponentKey };
