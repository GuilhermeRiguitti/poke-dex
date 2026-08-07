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
  DeckCardDTO,
  DeckSummaryDTO,
  LearnsetMoveDTO,
} from "./ui/types";

// As contas do RASCUNHO (deckDraft) não entram aqui: quem usa é a UI, que
// importa de domain/deckDraft direto — o mesmo caminho que o deckBoardView faz
// com DECK_LIMIT. Rota nenhuma precisa delas; o servidor recebe o time já
// achatado em { userPokemonId, order }.
export { DECK_LIMIT, CARDS_PER_SLOT, isDeckFull } from "./domain/rules";
// A validação do time é a MESMA nos dois lados (o botão de salvar e o PUT), por
// isso ela é pública: o cliente importa de domain/validateDeckSlots direto, o
// command importa daqui.
export { validateDeckSlots, deckSlotsIssueMessage } from "./domain/validateDeckSlots";
export type { DeckSlotInput, DeckSlotsIssue } from "./domain/validateDeckSlots";
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

// A ÚNICA escrita do deck: o time inteiro de uma vez (PUT /api/deck). Substituiu
// addToDeck / removeFromDeck / reorderDeck — ver saveDeck.ts.
export { saveDeck } from "./commands/saveDeck";
export type { SaveDeckResult } from "./commands/saveDeck";
