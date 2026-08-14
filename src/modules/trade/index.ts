import "server-only";

// API pública do módulo `trade` — a troca de cartas entre jogadores, por CÓDIGO.
//
// A escolha de desenho que explica o módulo inteiro: **não há descoberta de
// jogador**. Nem busca por email, nem perfil, nem lista de amigos. Quem oferece
// gera um código e o passa por fora do jogo; quem tem o código aceita. O jogo
// nunca mostrou o nome de outro jogador — nem na batalha, onde o oponente é
// anônimo — e a troca não é o lugar de estrear isso.
//
// Só código de SERVIDOR. Componentes ficam em ui/ e são importados pelas pages
// por caminho direto.

// ─── regra pura ────────────────────────────────────────────────────────────
// O formato do código é do domínio: a rota valida a FORMA antes de ir ao banco.
export { normalizeTradeCode, isValidCodeShape, TRADE_CODE_LENGTH } from "./domain/tradeCode";

// ─── leitura ───────────────────────────────────────────────────────────────
// SÓ LÊ — pode ser chamada do render de uma page.
export { readMyTradeOffers } from "./queries/readMyTradeOffers";

// ─── escrita ───────────────────────────────────────────────────────────────
// ESCREVEM — só rota de API (CLAUDE.md regra 2).
export { createTradeOffer } from "./commands/createTradeOffer";
export type { CreateTradeOfferInput } from "./commands/createTradeOffer";
export { acceptTradeOffer } from "./commands/acceptTradeOffer";
export type { AcceptTradeOfferInput } from "./commands/acceptTradeOffer";
export { cancelTradeOffer } from "./commands/cancelTradeOffer";
