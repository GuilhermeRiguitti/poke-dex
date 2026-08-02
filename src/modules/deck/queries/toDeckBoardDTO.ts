// Mapper da linha crua -> DTO da vaga do deck. Whitelist EXPLÍCITA, campo a
// campo: linha de Prisma não vai crua pro browser (CLAUDE.md, regra 3).

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";
import type { DeckBoardSlotDTO } from "../ui/types";

/** O recorte que a query pede — e tudo que o mapper tem direito de ver. */
export const DECK_BOARD_SLOT_SELECT = {
  id: true,
  order: true,
  userPokemon: {
    select: {
      level: true,
      pokemon: {
        select: {
          pokemonApiId: true,
          name: true,
          spriteUrl: true,
          types: true,
          baseStats: true,
          rarity: true,
        },
      },
    },
  },
} as const;

interface DeckBoardSlotRow {
  id: string;
  order: number;
  userPokemon: {
    level: number;
    pokemon: {
      pokemonApiId: number;
      name: string;
      spriteUrl: string | null;
      types: unknown;
      baseStats: unknown;
      rarity: string;
    };
  };
}

export function toDeckBoardSlotDTO(row: DeckBoardSlotRow): DeckBoardSlotDTO {
  const { pokemon } = row.userPokemon;
  return {
    id: row.id,
    order: row.order,
    pokemonId: pokemon.pokemonApiId,
    name: pokemon.name,
    iconUrl: pokemon.spriteUrl,
    level: row.userPokemon.level,
    // `types`/`baseStats` são colunas Json e `rarity` é String (não há enum no
    // schema): os casts são a leitura do contrato que o syncPokedex escreveu.
    types: pokemon.types as string[],
    rarity: pokemon.rarity as RarityTier,
    baseStats: pokemon.baseStats as unknown as BaseStats,
  };
}
