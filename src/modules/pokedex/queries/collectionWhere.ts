// O WHERE e o ORDER BY da coleção, separados da query pra serem PUROS e
// testáveis sem banco. Só tipos do Prisma entram aqui — nenhum acesso.

import type { Prisma } from "@prisma/client";
import type { CollectionFilters, CollectionSort } from "../domain/collectionFilters";

/**
 * O recorte da coleção. Os filtros vivem na espécie (`Pokemon`), o dono vive no
 * `UserPokemon` — o Prisma junta as duas tabelas.
 *
 * `types` é coluna Json (`string[]`): `array_contains` vira o operador `@>` do
 * jsonb, e `'["fire","flying"]' @> '["fire"]'` é true. Por isso o valor vai
 * dentro de um array, não solto.
 */
export function buildCollectionWhere(
  userId: string,
  f: CollectionFilters
): Prisma.UserPokemonWhereInput {
  return {
    userId,
    pokemon: {
      ...(f.q ? { name: { contains: f.q, mode: "insensitive" as const } } : {}),
      ...(f.type ? { types: { array_contains: [f.type] } } : {}),
      ...(f.rarity ? { rarity: f.rarity } : {}),
    },
  };
}

/**
 * A ordem, SEMPRE terminando em `id`.
 *
 * O `openPack` cria as 6 cartas de um pacote num `createMany` dentro de uma
 * transação, e o `now()` do Postgres é o mesmo pra todas — as 6 nascem com
 * `capturedAt` IDÊNTICO. Nível empata mais ainda (todo mundo começa igual).
 *
 * Enquanto a coleção vinha inteira numa query só, empate não fazia diferença.
 * Com LIMIT/OFFSET faz: em ordenação empatada o Postgres não garante a mesma
 * ordem entre duas consultas, então a mesma carta pode sair na página 1 E na 2,
 * e outra sumir das duas. `id` é cuid, único — é o desempate final, e vale
 * inclusive pra ordenação padrão.
 */
export function orderByFor(sort: CollectionSort): Prisma.UserPokemonOrderByWithRelationInput[] {
  const head: Prisma.UserPokemonOrderByWithRelationInput[] =
    sort === "level_desc" ? [{ level: "desc" }] : sort === "level_asc" ? [{ level: "asc" }] : [];

  return [...head, { capturedAt: "asc" }, { id: "asc" }];
}
