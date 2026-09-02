import { Utils } from "../utils.js";

export function recommendedStructure(participantCount) {
  if (participantCount <= 2) {
    return { swissRounds: 0, topCutSize: 2 };
  }
  if (participantCount <= 4) {
    return { swissRounds: 2, topCutSize: 2 };
  }
  if (participantCount <= 8) {
    return { swissRounds: 3, topCutSize: 4 };
  }
  if (participantCount <= 12) {
    return { swissRounds: 4, topCutSize: 4 };
  }
  if (participantCount <= 16) {
    return { swissRounds: 4, topCutSize: 8 };
  }
  if (participantCount <= 32) {
    return { swissRounds: 5, topCutSize: 8 };
  }
  return { swissRounds: 6, topCutSize: 8 };
}

export function resolveSwissRounds(tournament) {
  const configured = tournament.format.swissRounds;
  if (configured === "auto" || !configured) {
    return recommendedStructure(tournament.participants.length).swissRounds;
  }
  return Math.max(1, Number(configured));
}

export function resolveTopCutSize(tournament) {
  const participantCount = tournament.participants.length;
  const configured = tournament.format.topCutSize;
  const requested = configured === "auto" || !configured
    ? recommendedStructure(participantCount).topCutSize
    : Number(configured);
  return Math.max(2, Math.min(requested, Utils.highestPowerOfTwo(participantCount)));
}
