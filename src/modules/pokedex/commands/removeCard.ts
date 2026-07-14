import { prisma } from "@/src/lib/prisma";

export type RemoveCardResult = { ok: true } | { ok: false; error: "not_found" };

/**
 * Solta um pokémon (tira da coleção).
 *
 * O DeckCard correspondente cai junto por `onDelete: Cascade` no schema — soltar
 * um pokémon que está no deck tira ele do deck também, que é o que o jogador
 * espera. É por isso que não há um delete de DeckCard aqui.
 *
 * O `userId` vai no próprio where do delete (e não num findUnique antes): é o
 * que impede alguém de soltar a carta de outro jogador mandando um id qualquer,
 * sem uma segunda ida ao banco e sem janela de corrida entre a checagem e o
 * delete. count === 0 já cobre "não existe" e "não é seu".
 */
export async function removeCard(userId: string, userCardId: string): Promise<RemoveCardResult> {
  const { count } = await prisma.userCard.deleteMany({
    where: { id: userCardId, userId },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
