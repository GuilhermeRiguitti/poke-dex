import type { BattleMoveDef, BattlePokemonState, BattleStats } from "./types";

interface BattlePokemonRow {
  slot: number;
  userPokemonId?: string | null;
  pokemonId: number;
  name: string;
  types: unknown;
  level: number;
  stats: unknown;
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: unknown;
}

// Converte o formato persistido (colunas JSON do Prisma) pro tipo forte
// usado pelo motor puro (engine.ts).
export function rowToBattlePokemonState(row: BattlePokemonRow): BattlePokemonState {
  return {
    slot: row.slot,
    userPokemonId: row.userPokemonId ?? null,
    pokemonId: row.pokemonId,
    name: row.name,
    types: row.types as string[],
    level: row.level,
    stats: row.stats as BattleStats,
    maxHp: row.maxHp,
    currentHp: row.currentHp,
    fainted: row.fainted,
    moves: row.moves as BattleMoveDef[],
  };
}
