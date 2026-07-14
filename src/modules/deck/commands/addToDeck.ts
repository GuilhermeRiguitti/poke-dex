import { prisma } from "@/src/lib/prisma";
import { DECK_LIMIT } from "../domain/rules";
import { getOrCreateDeck } from "../queries/readDeck";
import type { DeckCardDTO } from "../ui/types";
import { toDeckCardDTO } from "../queries/toDeckDTO";

export type AddToDeckResult =
  | { ok: true; card: DeckCardDTO }
  | { ok: false; error: "not_found" | "deck_full" };

/**
 * Coloca um pokémon da coleção no deck.
 *
 * Concorrência: o jogador clica "+ Deck" em dois cards ao mesmo tempo (ou dá
 * duplo-clique), e duas lambdas chegam aqui juntas. Duas coisas seguram isso:
 *
 *  - a contagem e o insert vão na MESMA $transaction, então o limite de 6 é
 *    checado contra o estado real, não contra um número que o cliente mandou.
 *    Sem isso, dois requests simultâneos leem "5" e ambos inserem → deck com 7.
 *  - o insert é `upsert` na constraint @unique([deckId, userCardId]), não
 *    findFirst+create: clicar duas vezes no MESMO card não cria duas linhas.
 */
export async function addToDeck(userId: string, userCardId: string): Promise<AddToDeckResult> {
  const userCard = await prisma.userCard.findUnique({
    where: { id: userCardId },
    select: { id: true, userId: true },
  });
  // Não é só "não achei": é o dono errado. Um userCardId de outro jogador tem
  // que dar a MESMA resposta que um id inexistente, senão vira um oráculo de
  // "esse id existe".
  if (!userCard || userCard.userId !== userId) return { ok: false, error: "not_found" };

  const deck = await getOrCreateDeck(userId);

  return prisma.$transaction(async (tx) => {
    const alreadyIn = await tx.deckCard.findUnique({
      where: { deckId_userCardId: { deckId: deck.id, userCardId } },
      select: { id: true },
    });

    if (!alreadyIn) {
      const count = await tx.deckCard.count({ where: { deckId: deck.id } });
      if (count >= DECK_LIMIT) return { ok: false as const, error: "deck_full" as const };
    }

    const deckCard = await tx.deckCard.upsert({
      where: { deckId_userCardId: { deckId: deck.id, userCardId } },
      update: {},
      create: { deckId: deck.id, userCardId },
      include: { userCard: { select: { pokemonId: true } } },
    });

    return { ok: true as const, card: toDeckCardDTO(deckCard) };
  });
}
