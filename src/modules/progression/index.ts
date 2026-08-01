// API pública do módulo progression — as regras PURAS de progressão de um
// Pokémon (nível/stats, XP, evolução, learnset), compartilhadas por pokedex,
// battle, deck e packs. Só domain/ puro: sem Prisma, sem fetch, sem React.
// Módulo-a-módulo importa SÓ daqui, nunca de domain/ direto.

// Nível incremental + stats derivados 100% da API (PLANO_JOGO.md §6).
export {
  MIN_LEVEL,
  MAX_LEVEL,
  STARTING_LEVEL,
  LOSER_XP_SHARE,
  FALLBACK_BASE_EXPERIENCE,
  deriveStats,
  calcHp,
  calcStat,
  applyXp,
  xpForLevel,
  levelFromXp,
  xpToNextLevel,
  xpFromDefeat,
  sumBaseStats,
  progressionFromXp,
  progressionFromLevel,
} from "./domain/leveling";
export type { BaseStats, DerivedStats, Progress } from "./domain/leveling";

// Learnset fiel à série: qual move a espécie aprende, por método e nível.
export {
  VERSION_GROUP_PREFERENCE,
  PLAYABLE_LEARN_METHOD,
  pickVersionGroup,
  pickLearnEntry,
  isUnlockedAt,
  mergePlayableMoveIds,
} from "./domain/learnset";
export type { LearnDetail, LearnsetEntry } from "./domain/learnset";

// Evolução por nível: decisão de quando evoluir e o que podar do loadout.
export {
  parseLevelUpEvolutions,
  evolutionTargetFor,
  pruneLoadout,
  refillLoadout,
  birthLevelForSpecies,
} from "./domain/evolution";
export type {
  EvolutionEdge,
  EvolutionDetail,
  EvolutionChainNode,
  LoadoutCandidate,
} from "./domain/evolution";
