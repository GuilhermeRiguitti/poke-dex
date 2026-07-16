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

export type { DeckDTO, DeckSlotDTO, DeckSlotCardDTO, DeckSummaryDTO, LearnsetMoveDTO } from "./ui/types";

export { DECK_LIMIT, CARDS_PER_SLOT, isDeckFull, canToggleIntoDeck } from "./domain/rules";

export { readLearnset } from "./queries/readLearnset";

// readDeck / countDeckSlots / readDeckSlots só LEEM — podem ser chamadas do
// render de uma page. getOrCreateDeck e getDeckSummary ESCREVEM (criam o deck
// vazio no primeiro acesso) — ver o aviso em getDeckSummary.ts.
export { readDeck, countDeckSlots, readDeckSlots, getOrCreateDeck } from "./queries/readDeck";
export type { DeckLoadoutSlot, DeckLoadoutCard } from "./queries/readDeck";
export { getDeckSummary } from "./queries/getDeckSummary";

export { addToDeck } from "./commands/addToDeck";
export type { AddToDeckInput, AddToDeckResult } from "./commands/addToDeck";
export { removeFromDeck } from "./commands/removeFromDeck";
export type { RemoveFromDeckResult } from "./commands/removeFromDeck";
