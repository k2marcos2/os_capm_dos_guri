import { Utils } from "../utils.js";

const STORAGE_KEY = "genericTournamentManagerV3";
const LEGACY_STORAGE_KEY = "genericTournamentManagerV2";

function defaultTournament() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    id: Utils.id("tournament"),
    name: "Novo Campeonato",
    subtitle: "",
    description: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    labels: {
      participants: "Participantes",
      bracket: "Chaveamento",
      rules: "Regulamento",
      awards: "Premiação",
      champion: "Campeão"
    },
    format: {
      type: "pokemon_swiss",
      drawMode: "random",
      bestOf: 3,
      finalBestOf: 3,
      thirdPlace: false,
      swissRounds: "auto",
      topCutSize: "auto"
    },
    rules: [],
    awards: [],
    participants: [],
    bracket: null
  };
}

function normalizeTournament(input = {}) {
  const base = defaultTournament();
  return {
    ...base,
    ...input,
    schemaVersion: 3,
    id: input.id || base.id,
    createdAt: input.createdAt || base.createdAt,
    labels: { ...base.labels, ...(input.labels || {}) },
    format: { ...base.format, ...(input.format || {}) },
    rules: Array.isArray(input.rules) ? input.rules : [],
    awards: Array.isArray(input.awards) ? input.awards : [],
    participants: Array.isArray(input.participants) ? input.participants : [],
    bracket: input.bracket || null
  };
}

function readRawData() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return { tournaments: [] };
  try {
    const data = JSON.parse(raw);
    return {
      tournaments: Array.isArray(data?.tournaments)
        ? data.tournaments.map(normalizeTournament)
        : []
    };
  } catch (error) {
    console.error("Erro ao carregar campeonatos:", error);
    return { tournaments: [] };
  }
}

export const Storage = {
  defaultTournament,
  normalizeTournament,

  loadAll() {
    return readRawData();
  },

  saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  list() {
    return readRawData().tournaments.sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  },

  get(id) {
    return readRawData().tournaments.find(tournament => tournament.id === id) || null;
  },

  save(tournament) {
    const data = readRawData();
    const normalized = normalizeTournament(tournament);
    normalized.updatedAt = new Date().toISOString();
    const index = data.tournaments.findIndex(item => item.id === normalized.id);
    if (index >= 0) data.tournaments[index] = normalized;
    else data.tournaments.push(normalized);
    Storage.saveAll(data);
    return normalized;
  },

  create() {
    return Storage.save(defaultTournament());
  },

  remove(id) {
    const data = readRawData();
    data.tournaments = data.tournaments.filter(item => item.id !== id);
    Storage.saveAll(data);
  },

  duplicate(id) {
    const original = Storage.get(id);
    if (!original) return null;
    const copy = structuredClone(original);
    copy.id = Utils.id("tournament");
    copy.name = `${original.name} — Cópia`;
    copy.status = "draft";
    copy.bracket = null;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    return Storage.save(copy);
  }
};
