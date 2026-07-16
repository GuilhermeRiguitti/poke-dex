import type { DeckDTO, DeckSlotDTO, DeckSummaryDTO } from "../ui/types";

// Whitelist explícita, campo a campo. A linha do Prisma vem com userId no Deck e
// com deckId/ids cruzados em cada DeckSlot/DeckSlotCard — nada disso é do jogador.

export interface DeckRow {
  id: string;
  name: string;
  slots: {
    id: string;
    userPokemonId: string;
    order: number;
    cards: { moveId: string; order: number }[];
  }[];
}

export function toDeckSlotDTO(row: DeckRow["slots"][number]): DeckSlotDTO {
  return {
    id: row.id,
    userPokemonId: row.userPokemonId,
    order: row.order,
    cards: row.cards
      .map((c) => ({ moveId: c.moveId, order: c.order }))
      .sort((a, b) => a.order - b.order),
  };
}

export function toDeckDTO(row: DeckRow): DeckDTO {
  return {
    id: row.id,
    name: row.name,
    slots: [...row.slots].sort((a, b) => a.order - b.order).map(toDeckSlotDTO),
  };
}

export function toDeckSummaryDTO(row: { id: string; name: string; slotCount: number }): DeckSummaryDTO {
  return { id: row.id, name: row.name, slotCount: row.slotCount };
}
