import type { DeckCardDTO, DeckDTO, DeckSummaryDTO } from "../ui/types";

// Whitelist explícita, campo a campo. A linha do Prisma que as queries pegam
// vem com `userId` no Deck e com o `userCard` inteiro embutido em cada
// DeckCard (addedAt, userId do dono...). Nada disso é do jogador.

export interface DeckRow {
  id: string;
  name: string;
  deckCards: {
    id: string;
    userCardId: string;
    userCard: { pokemonId: number };
  }[];
}

export function toDeckCardDTO(row: DeckRow["deckCards"][number]): DeckCardDTO {
  return {
    id: row.id,
    userCardId: row.userCardId,
    pokemonId: row.userCard.pokemonId,
  };
}

export function toDeckDTO(row: DeckRow): DeckDTO {
  return {
    id: row.id,
    name: row.name,
    cards: row.deckCards.map(toDeckCardDTO),
  };
}

export function toDeckSummaryDTO(row: { id: string; name: string; pokemonCount: number }): DeckSummaryDTO {
  return {
    id: row.id,
    name: row.name,
    pokemonCount: row.pokemonCount,
  };
}
