import { prisma } from "@/src/lib/prisma";
import type { DeckBoardDTO } from "../ui/types";
import { DECK_BOARD_SLOT_SELECT, toDeckBoardSlotDTO } from "./toDeckBoardDTO";

/**
 * O deck do jogador pronto pra desenhar: as vagas com o pokémon já resolvido
 * (nome, sprite, nível, raridade, base stats).
 *
 * Só LÊ, e não faz I/O de rede (tudo vem do espelho local) — pode ser chamada
 * do render de uma page (CLAUDE.md, regra 2). NÃO cria o deck: quem cria é o
 * command (saveDeck), no primeiro save; sem deck, `id` vem null e as vagas
 * vazias.
 *
 * Independente da coleção de propósito: nenhum filtro, nenhuma paginação. É o
 * que garante que a carta montada aparece na vaga mesmo que a listagem da
 * coleção nunca a mostre.
 *
 * `Deck.userId` não é @unique — daí o `orderBy: createdAt asc`, que faz todo
 * mundo convergir no deck mais antigo. Ver a dívida em readDeck.ts.
 */
export async function getDeckBoardQuery(userId: string): Promise<DeckBoardDTO> {
  const deck = await prisma.deck.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slots: { orderBy: { order: "asc" }, select: DECK_BOARD_SLOT_SELECT },
    },
  });

  if (!deck) return { id: null, slots: [] };

  return { id: deck.id, slots: deck.slots.map(toDeckBoardSlotDTO) };
}
