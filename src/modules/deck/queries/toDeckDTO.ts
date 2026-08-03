import type { DeckSlotDTO, DeckSummaryDTO } from "../ui/types";

// Whitelist explícita, campo a campo. A linha do Prisma vem com userId no Deck e
// com deckId cruzado em cada DeckSlot — nada disso é do jogador.
//
// As `cards` sumiram daqui junto com o DeckSlotCard: a barra de skills não mora
// mais no deck, é escolhida na batalha ao pôr o pokémon em campo.

interface DeckSlotRow {
  id: string;
  userPokemonId: string;
  order: number;
}

export function toDeckSlotDTO(row: DeckSlotRow): DeckSlotDTO {
  return {
    id: row.id,
    userPokemonId: row.userPokemonId,
    order: row.order,
  };
}

export function toDeckSummaryDTO(row: { id: string; name: string; slotCount: number }): DeckSummaryDTO {
  return { id: row.id, name: row.name, slotCount: row.slotCount };
}
