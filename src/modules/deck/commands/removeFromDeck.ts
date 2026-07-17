import { prisma } from "@/src/lib/prisma";

export type RemoveFromDeckResult = { ok: true } | { ok: false; error: "not_found" };

/**
 * Tira um loadout do deck (recebe o id do DeckSlot). As DeckSlotCard caem junto
 * por onDelete: Cascade no schema.
 *
 * O `deck: { userId }` no where impede um jogador de apagar o slot de outro
 * passando um id qualquer — a checagem de dono vai no próprio DELETE (não num
 * findUnique antes, que seria corrida + ida extra ao banco). count === 0 cobre
 * "não existe" e "não é seu" de uma vez.
 */
export async function removeFromDeck(userId: string, deckSlotId: string): Promise<RemoveFromDeckResult> {
  const { count } = await prisma.deckSlot.deleteMany({
    where: { id: deckSlotId, deck: { userId } },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
