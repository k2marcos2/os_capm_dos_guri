import { Utils } from "../utils.js";
import { resolveSwissRounds, resolveTopCutSize } from "../config/tournament-format.js";
import { calculateStandings } from "./standings.js";
import { firstRoundPairings, swissPairings } from "./pairing-engine.js";
import { buildElimination, seedOrder, syncElimination } from "./elimination-engine.js";

function createSwissMatch(p1, p2, bestOf) {
  const isBye = !p2;
  return {
    id: Utils.id("match"),
    p1,
    p2: p2 || null,
    wins1: isBye ? Utils.winsNeeded(bestOf) : 0,
    wins2: 0,
    winnerId: isBye ? p1 : null,
    result: isBye ? "bye" : null,
    isBye,
    bestOf: Number(bestOf),
    completedAt: isBye ? new Date().toISOString() : null
  };
}

function createRound(number, pairing, bestOf) {
  const matches = pairing.pairs.map(([p1, p2]) => createSwissMatch(p1, p2, bestOf));
  if (pairing.byeId) matches.push(createSwissMatch(pairing.byeId, null, bestOf));
  return { id: Utils.id("swiss-round"), name: `Rodada suíça ${number}`, matches };
}

function activeElimination(tournament, target) {
  if (["topcut", "topcut-third"].includes(target.type)) return tournament.bracket.topCut;
  return tournament.bracket;
}

function getMatch(tournament, target) {
  const bracket = tournament.bracket;
  if (!bracket) return null;
  if (target.type === "swiss") {
    return bracket.swissRounds?.[target.round]?.matches[target.match] || null;
  }
  const elimination = activeElimination(tournament, target);
  if (!elimination) return null;
  if (["third", "topcut-third"].includes(target.type)) return elimination.thirdPlace;
  return elimination.rounds?.[target.round]?.matches[target.match] || null;
}

function currentSwissComplete(bracket) {
  return Boolean(bracket.swissRounds.at(-1)?.matches.every(match => match.completedAt));
}

function completedEliminationMatches(bracket, prefix = "") {
  const list = [];
  bracket.rounds.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
    if (match.winnerId && match.p1 && match.p2) {
      list.push({
        type: "main", roundIndex, matchIndex,
        roundName: `${prefix}${round.name}`,
        ...match
      });
    }
  }));
  if (bracket.thirdPlace?.winnerId) {
    list.push({ type: "third", roundName: `${prefix}Disputa de terceiro lugar`, ...bracket.thirdPlace });
  }
  return list;
}

export const BracketEngine = {
  isPokemonSwiss(bracket) {
    return bracket?.type === "pokemon_swiss";
  },

  standings(tournament) {
    return calculateStandings(tournament);
  },

  build(tournament) {
    if (tournament.participants.length < 2) {
      throw new Error("Cadastre pelo menos 2 participantes.");
    }

    let participantIds = tournament.participants.map(item => item.id);
    if (tournament.format.drawMode === "random") participantIds = Utils.shuffle(participantIds);

    if (tournament.format.type !== "pokemon_swiss") {
      return buildElimination(participantIds, tournament.format);
    }

    const swissRoundsTarget = resolveSwissRounds(tournament);
    const topCutSize = resolveTopCutSize(tournament);
    const firstPairing = firstRoundPairings(
      tournament.participants.map(item => item.id),
      tournament.format.drawMode
    );
    const bracket = {
      id: Utils.id("bracket"),
      type: "pokemon_swiss",
      createdAt: new Date().toISOString(),
      phase: swissRoundsTarget ? "swiss" : "top_cut",
      swissRoundsTarget,
      topCutSize,
      initialOrder: firstPairing.initialOrder,
      swissRounds: [],
      topCut: null,
      championId: null
    };

    if (!swissRoundsTarget) {
      bracket.topCut = buildElimination(firstPairing.initialOrder, tournament.format);
    } else {
      bracket.swissRounds.push(createRound(1, firstPairing, tournament.format.bestOf));
    }
    return bracket;
  },

  addSwissRound(tournament) {
    const bracket = tournament.bracket;
    if (!BracketEngine.isPokemonSwiss(bracket) || bracket.phase !== "swiss") return;
    if (!currentSwissComplete(bracket)) throw new Error("Conclua todos os confrontos da rodada atual.");
    if (bracket.swissRounds.length >= bracket.swissRoundsTarget) {
      throw new Error("As rodadas suíças já foram concluídas.");
    }
    const standings = calculateStandings(tournament);
    const pairing = swissPairings(standings, bracket.swissRounds);
    bracket.swissRounds.push(
      createRound(bracket.swissRounds.length + 1, pairing, tournament.format.bestOf)
    );
  },

  buildTopCut(tournament) {
    const bracket = tournament.bracket;
    const finished = BracketEngine.isPokemonSwiss(bracket) &&
      bracket.phase === "swiss" &&
      bracket.swissRounds.length >= bracket.swissRoundsTarget &&
      currentSwissComplete(bracket);
    if (!finished) throw new Error("Conclua todas as rodadas suíças antes do Top Cut.");

    const seeds = calculateStandings(tournament)
      .slice(0, bracket.topCutSize)
      .map(entry => entry.id);
    const ordered = seedOrder(seeds.length).map(seed => seeds[seed - 1]);
    bracket.topCut = buildElimination(ordered, tournament.format);
    bracket.phase = "top_cut";
    BracketEngine.sync(tournament);
  },

  sync(tournament) {
    const bracket = tournament.bracket;
    if (!bracket) return;
    if (BracketEngine.isPokemonSwiss(bracket)) {
      if (bracket.topCut) {
        syncElimination(bracket.topCut);
        bracket.championId = bracket.topCut.championId;
        bracket.phase = bracket.championId ? "finished" : "top_cut";
      }
      return;
    }
    syncElimination(bracket);
  },

  recordWin(tournament, target, slot) {
    const match = getMatch(tournament, target);
    if (!match || match.completedAt || !match.p1 || !match.p2) return;
    const needed = Utils.winsNeeded(match.bestOf);
    if (slot === 1) {
      match.wins1 = Math.min(needed, match.wins1 + 1);
      if (match.wins1 >= needed) match.winnerId = match.p1;
    } else {
      match.wins2 = Math.min(needed, match.wins2 + 1);
      if (match.wins2 >= needed) match.winnerId = match.p2;
    }
    if (match.winnerId) {
      match.result = "win";
      match.completedAt = new Date().toISOString();
    }
    BracketEngine.sync(tournament);
  },

  recordDraw(tournament, target) {
    const match = getMatch(tournament, target);
    if (!match || match.completedAt || !match.p1 || !match.p2 || target.type !== "swiss") return;
    match.result = "draw";
    match.winnerId = null;
    match.completedAt = new Date().toISOString();
  },

  resetMatch(tournament, target) {
    const bracket = tournament.bracket;
    if (target.type === "swiss" && (
      target.round !== bracket.swissRounds.length - 1 || bracket.topCut
    )) return;
    const match = getMatch(tournament, target);
    if (!match || match.isBye) return;
    Object.assign(match, { wins1: 0, wins2: 0, winnerId: null, result: null, completedAt: null });
    BracketEngine.sync(tournament);
  },

  completedMatches(tournament) {
    const bracket = tournament.bracket;
    if (!bracket) return [];
    let list = [];
    if (BracketEngine.isPokemonSwiss(bracket)) {
      bracket.swissRounds.forEach((round, roundIndex) => {
        round.matches.forEach((match, matchIndex) => {
          if (match.completedAt && match.p1) {
            list.push({ type: "swiss", roundIndex, matchIndex, roundName: round.name, ...match });
          }
        });
      });
      if (bracket.topCut) list.push(...completedEliminationMatches(bracket.topCut, "Top Cut • "));
    } else {
      list = completedEliminationMatches(bracket);
    }
    return list.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  }
};
