import { prisma } from "@/src/lib/prisma";
import type { DeckSummaryDTO } from "../ui/types";
import { getOrCreateDeck } from "./readDeck";
import { toDeckSummaryDTO } from "./toDeckDTO";

/**
 * O deck do usuário pra tela da fila: id (o matchmaking precisa dele), nome e
 * quantos pokémon tem. Cria o deck vazio se ainda não existir.
 *
 * ATENÇÃO: isto **escreve** no primeiro acesso (o create), e hoje é chamado do
 * render da página da fila — o que contraria a regra 2 do CLAUDE.md. É o
 * comportamento que já existia em battle/queries/getQueueDeck e foi preservado
 * de propósito nesta refatoração, pra não mexer no fluxo do battle junto. A
 * saída limpa é a página da fila usar só leitura e o POST /api/battle/queue
 * resolver o deck do usuário no servidor, em vez de receber um deckId do
 * cliente. Ver o resumo/TODO.
 */
export async function getDeckSummary(userId: string): Promise<DeckSummaryDTO> {
  const { id } = await getOrCreateDeck(userId);

  const deck = await prisma.deck.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, _count: { select: { deckCards: true } } },
  });

  return toDeckSummaryDTO({
    id: deck.id,
    name: deck.name,
    pokemonCount: deck._count.deckCards,
  });
}
