import type { DeckSlotDTO, DeckSummaryDTO } from "../ui/types";

// Whitelist explícita, campo a campo. A linha do Prisma vem com userId no Deck e
// com deckId/ids cruzados em cada DeckSlot/DeckSlotCard — nada disso é do jogador.

interface DeckSlotRow {
  id: string;
  userPokemonId: string;
  order: number;
  cards: { moveId: string; order: number }[];
}

export function toDeckSlotDTO(row: DeckSlotRow): DeckSlotDTO {
  return {
    id: row.id,
    userPokemonId: row.userPokemonId,
    order: row.order,
    cards: row.cards
      .map((c) => ({ moveId: c.moveId, order: c.order }))
      .sort((a, b) => a.order - b.order),
  };
}

export function toDeckSummaryDTO(row: { id: string; name: string; slotCount: number }): DeckSummaryDTO {
  return { id: row.id, name: row.name, slotCount: row.slotCount };
}
