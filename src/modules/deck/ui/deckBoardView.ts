// Mapear DTO -> o que a tela desenha é função pura, mora aqui e tem teste.
// Componente é costura. (CLAUDE.md, regra 4 — ver battle/ui/battleView.ts.)

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";
// Do ui/ do pokedex, não do barrel: `dexNumber` é uma formatação pura da
// identidade do pokémon, e ela é do pokedex. Duplicar aqui seria duas verdades
// pro mesmo "#0025".
import { dexNumber } from "@/src/modules/pokedex/ui/pokedexView";

import { DECK_LIMIT } from "../domain/rules";
import type { DeckBoardDTO } from "./types";

/** Uma vaga do deck. Preenchida, é uma carta mini; vazia, é a moldura tracejada. */
export interface DeckSlotView {
  /** id do DeckSlot, pro X de tirar do deck. null quando a vaga está vazia. */
  id: string | null;
  /** null = vaga vazia (e aí todo o resto também é null) */
  pokemonId: number | null;
  dexNumber: string | null;
  name: string | null;
  iconUrl: string | null;
  level: number | null;
  types: string[];
  rarity: RarityTier | null;
  baseStats: BaseStats | null;
}

export interface DeckBoardView {
  /** sempre DECK_LIMIT vagas, na ordem — as vazias vêm com pokemonId null */
  slots: DeckSlotView[];
  /** quantas vagas estão ocupadas */
  count: number;
  limit: number;
}

const VAGA_VAZIA: DeckSlotView = {
  id: null,
  pokemonId: null,
  dexNumber: null,
  name: null,
  iconUrl: null,
  level: null,
  types: [],
  rarity: null,
  baseStats: null,
};

/**
 * O tabuleiro do deck: sempre DECK_LIMIT vagas, na ordem, com as vazias no fim.
 *
 * Completar até o limite é decisão de APRESENTAÇÃO (a fileira precisa ter
 * sempre o mesmo tamanho, senão ela dança de largura conforme o time cresce) —
 * por isso mora aqui, e não na query.
 */
export function deckBoardView(board: DeckBoardDTO): DeckBoardView {
  const slots = Array.from({ length: DECK_LIMIT }, (_, i) => {
    const slot = board.slots[i];
    if (!slot) return VAGA_VAZIA;

    return {
      id: slot.id,
      pokemonId: slot.pokemonId,
      dexNumber: dexNumber(slot.pokemonId),
      name: slot.name,
      iconUrl: slot.iconUrl,
      level: slot.level,
      types: slot.types,
      rarity: slot.rarity,
      baseStats: slot.baseStats,
    };
  });

  return { slots, count: board.slots.length, limit: DECK_LIMIT };
}
