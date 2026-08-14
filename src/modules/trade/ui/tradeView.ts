// Regra de APRESENTAÇÃO da troca: DTO → o que a tela desenha. Função pura, com
// teste (CLAUDE.md regra 4). Componente é costura, não é onde regra mora.

import type { TradeOfferDTO } from "./types";

export interface TradeOfferView {
  id: string;
  /** Código já quebrado em dois blocos de 4: "A2B4-C6D8". Só visual. */
  displayCode: string;
  /** O código cru, que é o que vai pro clipboard (com hífen daria erro de forma). */
  rawCode: string;
  name: string;
  level: number;
  spriteUrl: string | null;
  /** "expira em 3 h", "expira em 12 min", "expirando". */
  expiryLabel: string;
  /** Menos de 1h: a tela destaca, senão o jogador perde o prazo sem perceber. */
  expiringSoon: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/**
 * Quebra em blocos de 4 SÓ na exibição. O que vai pro banco e pro clipboard é o
 * código cru — o hífen é ajuda de leitura pra quem copia da tela na mão, e a
 * `normalizeTradeCode` do domínio o remove de volta quando alguém digita com ele.
 */
export function formatTradeCode(code: string): string {
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function expiryLabel(expiresInMs: number): string {
  if (expiresInMs <= 0) return "expirando";
  if (expiresInMs >= HOUR_MS) {
    const hours = Math.floor(expiresInMs / HOUR_MS);
    return `expira em ${hours} h`;
  }
  const mins = Math.max(1, Math.floor(expiresInMs / MIN_MS));
  return `expira em ${mins} min`;
}

export function toTradeOfferView(offer: TradeOfferDTO): TradeOfferView {
  return {
    id: offer.id,
    displayCode: formatTradeCode(offer.code),
    rawCode: offer.code,
    name: offer.card.pokemon?.name ?? "?",
    level: offer.card.level,
    spriteUrl: offer.card.pokemon?.artworkUrl ?? null,
    expiryLabel: expiryLabel(offer.expiresInMs),
    expiringSoon: offer.expiresInMs < HOUR_MS,
  };
}

/** Mensagem por erro do servidor. Fica aqui pra a tela não montar texto na mão. */
export function tradeErrorLabel(error: string): string {
  switch (error) {
    case "not_found":
      return "Essa carta não é sua ou não existe mais.";
    case "in_deck":
      return "Tire a carta do time antes de oferecer.";
    case "in_battle":
      return "Essa carta está numa partida em andamento.";
    case "already_offered":
      return "Já existe uma oferta aberta pra essa carta.";
    case "own_offer":
      return "Esse código é da sua própria oferta.";
    case "rate_limited":
      return "Muitas tentativas. Espere um pouco.";
    // `invalid_code` cobre inexistente, vencido E já aceito de propósito — o
    // servidor não distingue, pra não virar oráculo de códigos. O texto tem que
    // ser igualmente vago, senão a UI desfaz no cliente o que o servidor
    // escondeu.
    case "invalid_code":
    default:
      return "Código inválido ou expirado.";
  }
}
