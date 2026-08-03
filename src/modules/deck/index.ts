// API pública do módulo deck.
//
// O deck é o ponto de encontro de duas features: a PokéDex MONTA o deck, e o
// battle BATALHA com ele. Por isso ele é um módulo próprio, e não uma pasta
// dentro de um dos dois — se morasse dentro de `pokedex`, o `battle` teria que
// importar de `pokedex` pra descobrir o time do jogador, o que é uma
// dependência torta entre features irmãs.
//
// Só código de SERVIDOR aqui. Componentes ficam em ui/ e são importados pelas
// pages por caminho direto (ver o mesmo comentário em battle/index.ts).

export type {
  DeckBoardDTO,
  DeckBoardSlotDTO,
  DeckSlotDTO,
  DeckSummaryDTO,
  LearnsetMoveDTO,
} from "./ui/types";

// moveSlot NÃO entra aqui: é a conta do arrastar, e quem usa é a UI, que importa
// de domain/rules direto (o mesmo caminho que deckBoardView faz com DECK_LIMIT).
// Rota nenhuma precisa dela.
export { DECK_LIMIT, CARDS_PER_SLOT, isDeckFull } from "./domain/rules";
// A barra com que o pokémon ENTRA quando o jogador não escolhe a tempo. Vive no
// deck (é regra de "qual barra montar"), mas quem usa hoje é a batalha.
export { defaultLoadout } from "./domain/defaultLoadout";

export { readLearnset } from "./queries/readLearnset";

// O deck pronto pra desenhar (vagas com o pokémon resolvido). Só lê, e é
// independente da coleção — nenhum filtro, nenhuma paginação.
export { getDeckBoardQuery } from "./queries/getDeckBoard";

// readDeckSlots só LÊ — pode ser chamada do render de uma page. getOrCreateDeck
// e getDeckSummary ESCREVEM (criam o deck vazio no primeiro acesso) — ver o
// aviso em getDeckSummary.ts.
export { readDeckSlots, getOrCreateDeck } from "./queries/readDeck";
export type { DeckLoadoutSlot } from "./queries/readDeck";
export { getDeckSummary } from "./queries/getDeckSummary";

export { addToDeck } from "./commands/addToDeck";
export type { AddToDeckInput, AddToDeckResult } from "./commands/addToDeck";
export { removeFromDeck } from "./commands/removeFromDeck";
export type { RemoveFromDeckResult } from "./commands/removeFromDeck";
export { reorderDeck } from "./commands/reorderDeck";
export type { ReorderDeckResult } from "./commands/reorderDeck";
