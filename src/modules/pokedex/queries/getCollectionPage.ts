import { prisma } from "@/src/lib/prisma";
import { readDeck } from "@/src/modules/deck";
import {
  COLLECTION_PAGE_SIZE,
  hasActiveFilter,
  type CollectionFilters,
} from "../domain/collectionFilters";
import type { CollectionPageDTO } from "../ui/types";
import { buildCollectionWhere, orderByFor } from "./collectionWhere";
import { COLLECTION_CARD_SELECT, toCollectionCardDTO } from "./toCollectionPageDTO";

/**
 * Uma PÁGINA da coleção, já filtrada e ordenada pelo banco.
 *
 * Substituiu o antigo `getCollection`, que carregava a coleção INTEIRA e
 * filtrava/ordenava em JS. Aqui nenhuma carta fora da página sai do Postgres.
 *
 * Só LÊ, e não faz I/O de rede (tudo vem do espelho local) — pode ser chamada
 * do render de uma page (CLAUDE.md, regra 2).
 *
 * Sem `$transaction`: são leituras, e uma divergência de milissegundos entre o
 * `count` e o `findMany` não corrompe nada — no pior caso a última página conta
 * uma carta a mais por um instante.
 */
export async function getCollectionPage(
  userId: string,
  filters: CollectionFilters
): Promise<CollectionPageDTO> {
  const where = buildCollectionWhere(userId, filters);
  const filtrando = hasActiveFilter(filters);

  const [rows, totalCards, deck, totalFiltradoFora] = await Promise.all([
    prisma.userPokemon.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      skip: (filters.page - 1) * COLLECTION_PAGE_SIZE,
      take: COLLECTION_PAGE_SIZE,
      select: COLLECTION_CARD_SELECT,
    }),
    prisma.userPokemon.count({ where }),
    readDeck(userId),
    // Só quando há filtro: sem filtro os dois totais são o mesmo número, e
    // mandar a query duas vezes seria uma invocação a mais por page load sem
    // nada em troca (CLAUDE.md §5 — cota).
    filtrando ? prisma.userPokemon.count({ where: { userId } }) : Promise.resolve(null),
  ]);

  return {
    cards: rows.map(toCollectionCardDTO),
    deck: deck
      ? {
          id: deck.id,
          slots: deck.slots.map((s) => ({ id: s.id, userPokemonId: s.userPokemonId })),
        }
      : null,
    page: filters.page,
    totalPages: Math.max(1, Math.ceil(totalCards / COLLECTION_PAGE_SIZE)),
    totalCards,
    totalInCollection: totalFiltradoFora ?? totalCards,
    filters,
  };
}
