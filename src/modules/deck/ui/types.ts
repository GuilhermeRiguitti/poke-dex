// Contrato de dados entre o servidor e a UI, pro deck.
//
// Espelho ESTREITO das linhas do Prisma: nada daqui pode ser a linha crua.
// A linha de Deck carrega userId; a de DeckCard carrega deckId e userCardId
// cruzados — nada disso é do jogador, e nada disso precisa chegar no browser.

/** Uma vaga preenchida do deck. `userCardId` é o que a UI manda pra remover. */
export interface DeckCardDTO {
  /** id do DeckCard (é o que o DELETE /api/deck/[id] recebe) */
  id: string;
  userCardId: string;
  pokemonId: number;
}

export interface DeckDTO {
  id: string;
  name: string;
  cards: DeckCardDTO[];
}

/** O deck como a tela da fila precisa dele: só o tamanho, sem os membros. */
export interface DeckSummaryDTO {
  id: string;
  name: string;
  pokemonCount: number;
}
