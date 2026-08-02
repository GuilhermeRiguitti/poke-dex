import { prisma } from "@/src/lib/prisma";
import { COLLECTION_PAGE_SIZE, type CollectionFilters } from "../domain/collectionFilters";
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
export async function getCollectionQuery(
  userId: string,
  filters: CollectionFilters
): Promise<CollectionPageDTO> {
  const where = buildCollectionWhere(userId, filters);

  const [rows, totalCards, totalInCollection] = await Promise.all([
    prisma.userPokemon.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      skip: (filters.page - 1) * COLLECTION_PAGE_SIZE,
      take: COLLECTION_PAGE_SIZE,
      select: COLLECTION_CARD_SELECT,
    }),
    prisma.userPokemon.count({ where }),
    // SEMPRE roda, sem filtro nenhum: `where` já exclui quem está no deck
    // (buildCollectionWhere), então "sem filtro os dois totais batem" não vale
    // mais. Um jogador com a coleção inteira no deck tem totalCards=0 mas
    // continua tendo coleção — sem este total puro, a tela diria "coleção
    // vazia, abra um pacote" pra quem já tem tudo montado.
    prisma.userPokemon.count({ where: { userId } }),
  ]);

  return {
    cards: rows.map(toCollectionCardDTO),
    page: filters.page,
    totalPages: Math.max(1, Math.ceil(totalCards / COLLECTION_PAGE_SIZE)),
    totalCards,
    totalInCollection,
    filters,
  };
}
