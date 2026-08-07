import type { DeckSummaryDTO } from "../ui/types";

// Whitelist explícita, campo a campo. A linha do Prisma vem com userId no Deck e
// com deckId cruzado em cada DeckSlot — nada disso é do jogador.
//
// As `cards` sumiram daqui junto com o DeckSlotCard: a barra de skills não mora
// mais no deck, é escolhida na batalha ao pôr o pokémon em campo.
//
// O `toDeckSlotDTO` saiu com o addToDeck: nenhuma escrita devolve UMA vaga mais
// — o save grava o time inteiro e responde com o board (toDeckBoardDTO).

export function toDeckSummaryDTO(row: { id: string; name: string; slotCount: number }): DeckSummaryDTO {
  return { id: row.id, name: row.name, slotCount: row.slotCount };
}
