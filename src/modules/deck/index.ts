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

// Os DTOs do deck NÃO saem daqui: quem os usa é a UI, e ela importa de
// ui/types por caminho relativo. Nenhuma rota precisa anotar o tipo.

// As contas do RASCUNHO (deckDraft) e a validação do time também não entram:
// quem usa é a UI e o command, e os dois importam de domain/ direto — o mesmo
// caminho que o deckBoardView faz com DECK_LIMIT. A validação é a MESMA função
// nos dois lados (o botão de salvar e o PUT); o que a torna compartilhada é ela
// ser pura em domain/, não passar por este barrel.
export { DECK_LIMIT, CARDS_PER_SLOT } from "./domain/rules";
// A barra com que o pokémon ENTRA quando o jogador não escolhe a tempo. Vive no
// deck (é regra de "qual barra montar"), mas quem usa hoje é a batalha.
export { defaultLoadout } from "./domain/defaultLoadout";

// O deck pronto pra desenhar (vagas com o pokémon resolvido). Só lê, e é
// independente da coleção — nenhum filtro, nenhuma paginação.
export { getDeckBoardQuery } from "./queries/getDeckBoard";

// readDeckSlots só LÊ — pode ser chamada do render de uma page. getDeckSummary
// ESCREVE (cria o deck vazio no primeiro acesso) — ver o aviso em
// getDeckSummary.ts.
export { readDeckSlots } from "./queries/readDeck";
export type { DeckLoadoutSlot } from "./queries/readDeck";
export { getDeckSummary } from "./queries/getDeckSummary";

// A ÚNICA escrita do deck: o time inteiro de uma vez (PUT /api/deck). Substituiu
// addToDeck / removeFromDeck / reorderDeck — ver saveDeck.ts.
export { saveDeck } from "./commands/saveDeck";
