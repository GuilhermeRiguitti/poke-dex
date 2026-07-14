import { prisma } from "@/src/lib/prisma";

export type RemoveFromDeckResult = { ok: true } | { ok: false; error: "not_found" };

/**
 * Tira um pokémon do deck (recebe o id do DeckCard, não o do UserCard).
 *
 * O `deck: { userId }` no where é o que impede um jogador de deletar o
 * DeckCard de outro passando um id qualquer — a checagem de dono vai no
 * próprio DELETE, e não num findUnique antes dele (que seria uma corrida, além
 * de duas idas ao banco). count === 0 cobre os dois casos de uma vez: não
 * existe, ou não é seu.
 */
export async function removeFromDeck(userId: string, deckCardId: string): Promise<RemoveFromDeckResult> {
  const { count } = await prisma.deckCard.deleteMany({
    where: { id: deckCardId, deck: { userId } },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
