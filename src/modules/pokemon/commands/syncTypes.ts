import { prisma } from "@/src/lib/prisma";
import { fetchType } from "@/src/lib/pokeapi";

// Espelha o endpoint /type na tabela `Type` — as 18 relações de dano do jogo.
// Irmão pequeno do syncPokedex: mesma natureza (copiar dado cru da API pro
// espelho), mesma disciplina (idempotente por chave única, sem $transaction —
// re-rodar converge). ESCREVE → só command/seed, nunca render (regra 2).
//
// POR QUE ISTO EXISTE (2026-08-15): a matriz de tipos morava no `PokeApiCache`,
// e era a última coisa capaz de puxar rede DENTRO de uma partida — cache miss no
// `buildTypeChart` mandava a batalha na PokéAPI. Cache é pra vitrine (catálogo e
// tela de detalhe, que usam o cache de `fetch` do Next); o que o JOGO consulta
// vem do espelho. Com a tabela semeada, a batalha é rede zero por construção.

/**
 * Os 18 tipos do jogo. Lista fixa de propósito, e não o índice `/type` da API:
 * o índice traz também `unknown` e `stellar`, que nenhuma carta do espelho usa.
 * Este é o universo FECHADO que o espelho pode produzir — todo `Pokemon.types` e
 * todo `Move.type` cai aqui, então com as 18 na tabela o chart nunca fica sem
 * linha.
 */
export const GAME_TYPE_NAMES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export interface SyncTypesSummary {
  synced: number;
  /** nomes que a API não devolveu — re-rodar completa (nada fica pela metade). */
  failed: string[];
}

/**
 * Busca os 18 e faz upsert por `name`. Sequencial: são 18 requests uma vez na
 * vida (seed, ou ambiente novo), não vale gastar concorrência com a API.
 *
 * Sempre re-busca, mesmo quem já está na tabela — diferente do cache antigo, que
 * só ia na rede quando a linha NÃO existia e por isso nunca corrigia uma linha
 * velha. Aqui rodar o seed de novo é o caminho de atualização.
 */
export async function syncTypes(): Promise<SyncTypesSummary> {
  let synced = 0;
  const failed: string[] = [];

  for (const name of GAME_TYPE_NAMES) {
    const type = await fetchType(name);
    if (!type) {
      failed.push(name);
      continue;
    }

    const data = {
      typeApiId: type.id,
      name: type.name,
      doubleDamageTo: type.doubleDamageTo,
      halfDamageTo: type.halfDamageTo,
      noDamageTo: type.noDamageTo,
      fetchedAt: new Date(),
    };

    await prisma.type.upsert({ where: { name: type.name }, update: data, create: data });
    synced++;
  }

  return { synced, failed };
}
