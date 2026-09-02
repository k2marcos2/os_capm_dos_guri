import { Utils } from "../utils.js";

function participantSource(id) {
  return { type: "participant", id };
}

function winnerSource(round, match) {
  return { type: "winner", round, match };
}

function loserSource(round, match) {
  return { type: "loser", round, match };
}

function createMatch(source1, source2, bestOf) {
  return {
    id: Utils.id("match"), source1, source2,
    p1: null, p2: null, wins1: 0, wins2: 0,
    winnerId: null, result: null, bestOf: Number(bestOf), completedAt: null
  };
}

function roundName(matchCount) {
  return ({ 1: "Final", 2: "Semifinais", 4: "Quartas de final", 8: "Oitavas de final" })[matchCount]
    || `Rodada com ${matchCount} confrontos`;
}

function resolveSource(bracket, source) {
  if (!source) return null;
  if (source.type === "participant") return source.id;
  const sourceMatch = bracket.rounds[source.round]?.matches[source.match];
  if (!sourceMatch) return null;
  if (source.type === "winner") return sourceMatch.winnerId || null;
  if (source.type === "loser" && sourceMatch.winnerId && sourceMatch.p1 && sourceMatch.p2) {
    return sourceMatch.winnerId === sourceMatch.p1 ? sourceMatch.p2 : sourceMatch.p1;
  }
  return null;
}

export function seedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const nextSize = order.length * 2;
    order = order.flatMap(seed => [seed, nextSize + 1 - seed]);
  }
  return order;
}

export function buildElimination(ids, format) {
  const mainSize = Utils.highestPowerOfTwo(ids.length);
  const preliminaryCount = ids.length - mainSize;
  const preliminaryPlayerCount = preliminaryCount * 2;
  const rounds = [];
  let sources;

  if (preliminaryCount) {
    const preliminaryPlayers = ids.slice(0, preliminaryPlayerCount);
    const directPlayers = ids.slice(preliminaryPlayerCount);
    const matches = Array.from({ length: preliminaryCount }, (_, index) =>
      createMatch(
        participantSource(preliminaryPlayers[index * 2]),
        participantSource(preliminaryPlayers[index * 2 + 1]),
        format.bestOf
      )
    );
    rounds.push({ id: Utils.id("round"), name: "Rodada preliminar", matches });
    sources = [
      ...matches.map((_, index) => winnerSource(0, index)),
      ...directPlayers.map(participantSource)
    ];
  } else {
    sources = ids.map(participantSource);
  }

  while (sources.length >= 2) {
    const matchCount = sources.length / 2;
    const currentRound = rounds.length;
    const matches = Array.from({ length: matchCount }, (_, index) =>
      createMatch(
        sources[index * 2],
        sources[index * 2 + 1],
        matchCount === 1 ? format.finalBestOf : format.bestOf
      )
    );
    rounds.push({ id: Utils.id("round"), name: roundName(matchCount), matches });
    sources = matches.map((_, index) => winnerSource(currentRound, index));
    if (matchCount === 1) break;
  }

  const semifinalIndex = rounds.findIndex(round => round.matches.length === 2);
  const thirdPlace = format.thirdPlace && semifinalIndex >= 0
    ? createMatch(loserSource(semifinalIndex, 0), loserSource(semifinalIndex, 1), format.bestOf)
    : null;
  const bracket = {
    id: Utils.id("elimination"), type: "single_elimination",
    createdAt: new Date().toISOString(), rounds, thirdPlace, championId: null
  };
  syncElimination(bracket);
  return bracket;
}

export function syncElimination(bracket) {
  bracket.rounds.forEach(round => round.matches.forEach(match => {
    const p1 = resolveSource(bracket, match.source1);
    const p2 = resolveSource(bracket, match.source2);
    if (match.p1 !== p1 || match.p2 !== p2) {
      Object.assign(match, { p1, p2, wins1: 0, wins2: 0, winnerId: null, result: null, completedAt: null });
    }
  }));
  if (bracket.thirdPlace) {
    const p1 = resolveSource(bracket, bracket.thirdPlace.source1);
    const p2 = resolveSource(bracket, bracket.thirdPlace.source2);
    if (bracket.thirdPlace.p1 !== p1 || bracket.thirdPlace.p2 !== p2) {
      Object.assign(bracket.thirdPlace, { p1, p2, wins1: 0, wins2: 0, winnerId: null, result: null, completedAt: null });
    }
  }
  bracket.championId = bracket.rounds.at(-1)?.matches?.[0]?.winnerId || null;
}
