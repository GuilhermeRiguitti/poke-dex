// Mapper da linha crua -> DTO da vaga do deck. Whitelist EXPLÍCITA, campo a
// campo: linha de Prisma não vai crua pro browser (CLAUDE.md, regra 3).
//
// O id do DeckSlot NÃO sai daqui. Ele existia pro DELETE /api/deck/[id], que
// morreu com o rascunho de cliente; e como o save apaga e reinsere as linhas, o
// id muda a cada gravação — mandá-lo seria dar pro browser um identificador que
// não identifica nada. Quem identifica a carta é o `userPokemonId`, que a tela
// precisa de verdade (é a chave do rascunho e o que marca a carta na coleção).

import type { RarityTier } from "@/src/modules/pokemon";
import type { BaseStats } from "@/src/modules/pokemon";
import type { DeckBoardSlotDTO } from "../ui/types";

/** O recorte que a query pede — e tudo que o mapper tem direito de ver. */
export const DECK_BOARD_SLOT_SELECT = {
  order: true,
  userPokemon: {
    select: {
      id: true,
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
  order: number;
  userPokemon: {
    id: string;
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
    order: row.order,
    userPokemonId: row.userPokemon.id,
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
