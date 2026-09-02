globalThis.window = { crypto: globalThis.crypto };

const { BracketEngine } = await import("../js/domain/bracket-engine.js");

function createTournament(participantCount) {
  return {
    format: {
      type: "pokemon_swiss",
      drawMode: "registration",
      bestOf: 3,
      finalBestOf: 3,
      thirdPlace: true,
      swissRounds: "auto",
      topCutSize: "auto"
    },
    participants: Array.from({ length: participantCount }, (_, index) => ({
      id: `p${index + 1}`,
      name: `Jogador ${index + 1}`
    })),
    bracket: null
  };
}

function finishCurrentSwissRound(tournament) {
  const roundIndex = tournament.bracket.swissRounds.length - 1;
  const round = tournament.bracket.swissRounds[roundIndex];
  round.matches.forEach((match, matchIndex) => {
    if (match.completedAt) return;
    const winnerSlot = matchIndex % 2 ? 2 : 1;
    BracketEngine.recordWin(tournament, { type: "swiss", round: roundIndex, match: matchIndex }, winnerSlot);
    BracketEngine.recordWin(tournament, { type: "swiss", round: roundIndex, match: matchIndex }, winnerSlot);
  });
}

function validateSwissRounds(tournament, participantCount) {
  const seen = new Set();
  const byePlayers = [];
  tournament.bracket.swissRounds.forEach(round => round.matches.forEach(match => {
    if (match.isBye) {
      byePlayers.push(match.p1);
      return;
    }
    const key = [match.p1, match.p2].sort().join(":");
    if (seen.has(key)) throw new Error(`Revanche desnecessária com ${participantCount} jogadores: ${key}`);
    seen.add(key);
  }));
  if (participantCount === 7 && new Set(byePlayers).size !== 3) {
    throw new Error("O mesmo jogador recebeu BYE mais de uma vez.");
  }
  return { matchCount: seen.size, byePlayers };
}

function validateTopCut(tournament, standings) {
  BracketEngine.buildTopCut(tournament);
  const matches = tournament.bracket.topCut.rounds[0].matches;
  if (matches[0].p1 !== standings[0].id || matches[0].p2 !== standings[3].id) {
    throw new Error("O confronto 1º × 4º está incorreto.");
  }
  if (matches[1].p1 !== standings[1].id || matches[1].p2 !== standings[2].id) {
    throw new Error("O confronto 2º × 3º está incorreto.");
  }
}

for (const participantCount of [7, 8]) {
  const tournament = createTournament(participantCount);
  tournament.bracket = BracketEngine.build(tournament);
  if (tournament.bracket.swissRoundsTarget !== 3 || tournament.bracket.topCutSize !== 4) {
    throw new Error(`Estrutura automática incorreta para ${participantCount} jogadores.`);
  }

  while (true) {
    finishCurrentSwissRound(tournament);
    if (tournament.bracket.swissRounds.length === tournament.bracket.swissRoundsTarget) break;
    BracketEngine.addSwissRound(tournament);
  }

  const validation = validateSwissRounds(tournament, participantCount);
  const standings = BracketEngine.standings(tournament);
  validateTopCut(tournament, standings);

  tournament.bracket.topCut.rounds.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => {
      BracketEngine.recordWin(tournament, { type: "topcut", round: roundIndex, match: matchIndex }, 1);
      BracketEngine.recordWin(tournament, { type: "topcut", round: roundIndex, match: matchIndex }, 1);
    });
  });
  if (!tournament.bracket.championId) throw new Error("O campeão não foi definido.");

  console.log(
    `${participantCount} jogadores: ${validation.matchCount} confrontos únicos, ` +
    `${validation.byePlayers.length} BYEs, Top 4 e campeão validados.`
  );
}
