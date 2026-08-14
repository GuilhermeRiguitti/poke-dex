// Mapper da linha crua → DTO da oferta. Whitelist EXPLÍCITA (CLAUDE.md regra 3).
//
// Aqui a whitelist não é formalidade: a linha de `TradeOffer` carrega
// `fromUserId`, e o jogo inteiro é construído em cima de o outro jogador ser
// ANÔNIMO (nem na batalha o nome do oponente aparece). Deixar o id do dono
// escapar num DTO seria o primeiro furo nisso — e viria de graça se o mapper
// fosse um spread.

import { COLLECTION_CARD_SELECT, toCollectionCardDTO } from "@/src/modules/pokedex";
import type { TradeOfferDTO } from "../ui/types";

/** O recorte que a query pede — e tudo que o mapper tem direito de ver. */
export const TRADE_OFFER_SELECT = {
  id: true,
  code: true,
  expiresAt: true,
  userPokemon: { select: COLLECTION_CARD_SELECT },
} as const;

interface TradeOfferRow {
  id: string;
  code: string;
  expiresAt: Date;
  userPokemon: Parameters<typeof toCollectionCardDTO>[0];
}

export function toTradeOfferDTO(row: TradeOfferRow, now: Date): TradeOfferDTO {
  return {
    id: row.id,
    code: row.code,
    // `Math.max(0, …)`: uma oferta vencida entre a query e o mapper daria número
    // negativo, e a tela desenharia "-3s". Zero é a leitura honesta.
    expiresInMs: Math.max(0, row.expiresAt.getTime() - now.getTime()),
    card: toCollectionCardDTO(row.userPokemon),
  };
}
