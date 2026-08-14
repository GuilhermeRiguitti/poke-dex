import { prisma } from "@/src/lib/prisma";
import { TRADE_OFFER_SELECT, toTradeOfferDTO } from "./toTradeOfferDTO";
import type { TradePageDTO } from "../ui/types";

// SÓ LÊ — pode ser chamada do render de uma page (CLAUDE.md regra 2).
//
// A faxina das ofertas vencidas NÃO acontece aqui, e é de propósito: esta query
// roda no render, e render não escreve. As vencidas são filtradas na leitura
// (`expiresAt > now`) e morrem sozinhas quando alguém tenta usá-las — o
// `deleteMany` do aceite tem `expiresAt: { gt: now }` no where, então uma oferta
// vencida simplesmente não é aceitável. Linha velha na tabela é lixo barato;
// não vale um cron (que no Hobby roda 1×/dia) nem uma escrita no render.

export async function readMyTradeOffers(
  userId: string,
  now: Date = new Date(),
): Promise<TradePageDTO> {
  const rows = await prisma.tradeOffer.findMany({
    where: { fromUserId: userId, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: TRADE_OFFER_SELECT,
  });

  return { offers: rows.map((row) => toTradeOfferDTO(row, now)) };
}
