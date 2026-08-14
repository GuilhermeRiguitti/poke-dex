// Contrato servidor → UI da troca. São `interface`, não pesam no bundle.

import type { CollectionCardDTO } from "@/src/modules/pokedex";

/**
 * Uma oferta VIVA do próprio jogador.
 *
 * O que NÃO está aqui é a parte importante: nem `fromUserId`, nem `toUserId`,
 * nem nome ou email de ninguém. A troca por código foi escolhida justamente pra
 * não precisar expor identidade — se um desses campos entrasse no DTO "porque
 * era prático", a decisão de desenho morreria calada. O teste do mapper trava
 * isso.
 */
export interface TradeOfferDTO {
  id: string;
  /** O código, que é o produto: o dono copia e passa adiante. */
  code: string;
  /**
   * Quanto falta pra vencer, em ms. RELATIVO e não a data absoluta, pela mesma
   * razão do `turnEndsInMs` da batalha: o relógio do browser não é confiável, e
   * fuso/atraso fariam a tela mentir sobre o prazo.
   */
  expiresInMs: number;
  /** A carta ofertada, no MESMO contrato da coleção (não há segunda whitelist). */
  card: CollectionCardDTO;
}

/** O que a página de troca recebe pronto do servidor. */
export interface TradePageDTO {
  offers: TradeOfferDTO[];
}
