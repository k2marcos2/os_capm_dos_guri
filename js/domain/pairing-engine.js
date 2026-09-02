import { Utils } from "../utils.js";
import { opponentKey, previousPairings } from "./standings.js";

const REMATCH_PENALTY = 1_000_000;
const REPEATED_BYE_PENALTY = 2_000_000;
const POINT_DIFFERENCE_PENALTY = 10_000;
const RANK_DISTANCE_PENALTY = 10;
const MAX_EXACT_PAIRING = 12;

function pairPenalty(first, second, playedPairs, ranks) {
  const rematch = playedPairs.has(opponentKey(first.id, second.id)) ? REMATCH_PENALTY : 0;
  const pointDifference = Math.abs(first.points - second.points) * POINT_DIFFERENCE_PENALTY;
  const rankDistance = Math.abs(ranks.get(first.id) - ranks.get(second.id)) * RANK_DISTANCE_PENALTY;
  return rematch + pointDifference + rankDistance;
}

function exactPairs(entries, playedPairs, ranks) {
  if (!entries.length) return { score: 0, pairs: [] };
  const [first, ...remaining] = entries;
  let best = null;

  remaining.forEach((second, index) => {
    const rest = remaining.filter((_, restIndex) => restIndex !== index);
    const candidate = exactPairs(rest, playedPairs, ranks);
    const score = pairPenalty(first, second, playedPairs, ranks) + candidate.score;
    if (!best || score < best.score) {
      best = { score, pairs: [[first.id, second.id], ...candidate.pairs] };
    }
  });
  return best;
}

function greedyPairs(entries, playedPairs, ranks) {
  const pool = [...entries];
  const pairs = [];
  let score = 0;
  while (pool.length) {
    const first = pool.shift();
    let bestIndex = 0;
    let bestPenalty = Number.POSITIVE_INFINITY;
    pool.forEach((second, index) => {
      const penalty = pairPenalty(first, second, playedPairs, ranks);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    });
    const [second] = pool.splice(bestIndex, 1);
    pairs.push([first.id, second.id]);
    score += bestPenalty;
  }
  return { score, pairs };
}

function chooseBestPairs(entries, playedPairs, ranks) {
  return entries.length <= MAX_EXACT_PAIRING
    ? exactPairs(entries, playedPairs, ranks)
    : greedyPairs(entries, playedPairs, ranks);
}

export function firstRoundPairings(participantIds, drawMode) {
  const ordered = drawMode === "random" ? Utils.shuffle(participantIds) : [...participantIds];
  const pairs = [];
  let byeId = null;
  if (ordered.length % 2 === 1) byeId = ordered.pop();
  for (let index = 0; index < ordered.length; index += 2) {
    pairs.push([ordered[index], ordered[index + 1]]);
  }
  return { pairs, byeId, initialOrder: [...ordered, ...(byeId ? [byeId] : [])] };
}

export function swissPairings(standings, previousRounds) {
  const playedPairs = previousPairings(previousRounds);
  const ranks = new Map(standings.map((entry, index) => [entry.id, index]));
  const byeCandidates = standings.length % 2 === 1 ? standings : [null];
  let best = null;

  byeCandidates.forEach(byeCandidate => {
    const remaining = byeCandidate
      ? standings.filter(entry => entry.id !== byeCandidate.id)
      : standings;
    const pairing = chooseBestPairs(remaining, playedPairs, ranks);
    const byePenalty = byeCandidate
      ? (byeCandidate.byes ? REPEATED_BYE_PENALTY : 0) +
        byeCandidate.points * POINT_DIFFERENCE_PENALTY +
        (standings.length - ranks.get(byeCandidate.id))
      : 0;
    const candidate = { ...pairing, score: pairing.score + byePenalty, byeId: byeCandidate?.id || null };
    if (!best || candidate.score < best.score) best = candidate;
  });

  return best;
}
