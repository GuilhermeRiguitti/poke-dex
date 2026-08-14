import { prisma } from "@/src/lib/prisma";

// Retira uma oferta de circulação. ESCREVE — só rota de API.
//
// O dono vai no PRÓPRIO where do delete (padrão anti-IDOR do repo): ninguém
// cancela oferta alheia, e id de outro dono responde igual a inexistente.
// `deleteMany` em vez de `delete` porque `delete` lança quando não acha — aqui
// "não achou" é uma resposta, não uma exceção.

export type CancelTradeOfferResult = { ok: true } | { ok: false; error: "not_found" };

export async function cancelTradeOffer(
  userId: string,
  offerId: string,
): Promise<CancelTradeOfferResult> {
  const { count } = await prisma.tradeOffer.deleteMany({
    where: { id: offerId, fromUserId: userId },
  });
  // count 0 = não existe, é de outro dono, ou alguém já aceitou no meio do
  // caminho. Os três dão o mesmo resultado prático: não há mais o que cancelar.
  return count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
