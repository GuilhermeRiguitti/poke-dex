// Mapper da linha crua -> DTO da carta da coleção. Whitelist EXPLÍCITA, campo a
// campo: linha de Prisma não vai crua pro browser (CLAUDE.md, regra 3).

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression";
import type { CollectionCardDTO } from "../ui/types";

/** O recorte que a query pede — e tudo que o mapper tem direito de ver. */
export const COLLECTION_CARD_SELECT = {
  id: true,
  level: true,
  xp: true,
  pokemon: {
    select: {
      pokemonApiId: true,
      name: true,
      spriteUrl: true,
      types: true,
      baseStats: true,
      bst: true,
      rarity: true,
    },
  },
} as const;

interface CollectionCardRow {
  id: string;
  level: number;
  xp: number;
  pokemon: {
    pokemonApiId: number;
    name: string;
    spriteUrl: string | null;
    types: unknown;
    baseStats: unknown;
    bst: number;
    rarity: string;
  };
}

export function toCollectionCardDTO(row: CollectionCardRow): CollectionCardDTO {
  return {
    userPokemonId: row.id,
    pokemonId: row.pokemon.pokemonApiId,
    level: row.level,
    xp: row.xp,
    // Da COLUNA, não do bstOf: é o que garante que a raridade desenhada é a
    // mesma que o filtro do banco usou pra achar esta carta.
    bst: row.pokemon.bst,
    // `rarity` é String no Prisma (não há enum no schema). O cast é a leitura
    // do contrato que o syncPokedex escreveu — mesmo padrão do baseStats Json.
    rarity: row.pokemon.rarity as RarityTier,
    baseStats: row.pokemon.baseStats as unknown as BaseStats,
    pokemon: {
      id: row.pokemon.pokemonApiId,
      name: row.pokemon.name,
      artworkUrl: row.pokemon.spriteUrl,
      iconUrl: row.pokemon.spriteUrl,
      types: row.pokemon.types as string[],
    },
  };
}
