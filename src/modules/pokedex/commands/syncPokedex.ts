import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import {
  extractIdFromUrl,
  fetchMove,
  fetchPokemon,
  type NormalizedPokemon,
} from "@/src/lib/pokeapi";
import type { BaseStats } from "../domain/leveling";

// Sincroniza o espelho da PokéAPI (Pokemon/Move/PokemonMove) — o motor único
// da seed inicial (Fase 0) E do cron de refresh (PLANO_JOGO.md §7). Escreve →
// é command, nunca render de page (CLAUDE.md regra 2).
//
// POR QUE NÃO $transaction (contraste com resolveTurn):
// aqui não há claim disputado nem invariante multi-passo que precise ser
// atômica. É um bulk idempotente por chave única (`pokemonApiId`/`moveApiId` e
// a PK do par no learnset): se a função morrer no meio, RE-RODAR conserta —
// cada upsert converge pro mesmo estado. Uma transação só de 151 pokémon + ~350
// moves + milhares de links estouraria o timeout e seguraria conexão do pool
// (CLAUDE.md consequência #2 é sobre escrita que NÃO pode re-rodar; esta pode).

/** Mapeia os stats crus da PokéAPI (nomes com hífen) pras nossas 6 chaves. */
function toBaseStats(p: NormalizedPokemon): BaseStats {
  const by = (name: string) => p.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
  return {
    hp: by("hp"),
    atk: by("attack"),
    def: by("defense"),
    spa: by("special-attack"),
    spd: by("special-defense"),
    spe: by("speed"),
  };
}

/** tipos ordenados por slot → ["grass","poison"] (slot 1 primeiro). */
function toTypeNames(p: NormalizedPokemon): string[] {
  return [...p.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
}

/** Roda `task` sobre `items` com no máx. `limit` em voo — gentil com a PokéAPI. */
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await task(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface SyncPokedexSummary {
  pokemonSynced: number;
  movesSynced: number;
  linksSynced: number;
  /** apiIds que a PokéAPI não devolveu (rede/404) — não abortam o resto. */
  failedPokemon: number[];
}

export interface SyncPokedexOptions {
  /** quantos fetches simultâneos na PokéAPI. Default modesto (fair use). */
  concurrency?: number;
}

/**
 * Sincroniza os `pokemonApiIds` dados: faz upsert de cada espécie, de todos os
 * moves do learnset (deduplicados entre espécies) e dos vínculos n:n.
 * Idempotente: re-rodar com os mesmos ids só atualiza `fetchedAt`.
 */
export async function syncPokedex(
  pokemonApiIds: number[],
  { concurrency = 8 }: SyncPokedexOptions = {},
): Promise<SyncPokedexSummary> {
  const failedPokemon: number[] = [];

  // 1) espécies: fetch + upsert, guardando o id do banco e os moveApiIds de cada.
  const fetched = await mapLimit(pokemonApiIds, concurrency, async (apiId) => {
    const p = await fetchPokemon(apiId);
    if (!p) {
      failedPokemon.push(apiId);
      return null;
    }
    // Prisma exige InputJsonValue (com index signature) pra colunas Json; o
    // BaseStats/`string[]` tipados não casam sozinhos, daí o cast no ponto de
    // escrita. Hoisted pra não repetir a whitelist em create/update.
    const data = {
      name: p.name,
      types: toTypeNames(p) as Prisma.InputJsonValue,
      baseStats: toBaseStats(p) as unknown as Prisma.InputJsonObject,
      spriteUrl: p.sprites.artwork ?? p.sprites.front_default,
    };
    const row = await prisma.pokemon.upsert({
      where: { pokemonApiId: p.id },
      create: { pokemonApiId: p.id, ...data },
      update: { ...data, fetchedAt: new Date() },
    });
    const moveApiIds = p.moves.map((m) => extractIdFromUrl(m.move.url)).filter((n) => Number.isFinite(n));
    return { pokemonId: row.id, moveApiIds };
  });

  const synced = fetched.filter((x): x is { pokemonId: string; moveApiIds: number[] } => x !== null);

  // 2) moves: união deduplicada de todos os learnsets, fetch + upsert.
  const uniqueMoveApiIds = [...new Set(synced.flatMap((s) => s.moveApiIds))];
  const moveIdByApiId = new Map<number, string>();
  await mapLimit(uniqueMoveApiIds, concurrency, async (apiId) => {
    const m = await fetchMove(apiId);
    if (!m) return;
    const data = {
      name: m.name,
      type: m.type,
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
      damageClass: m.damageClass,
    };
    const row = await prisma.move.upsert({
      where: { moveApiId: m.id },
      create: { moveApiId: m.id, ...data },
      update: { ...data, fetchedAt: new Date() },
    });
    moveIdByApiId.set(m.id, row.id);
  });

  // 3) learnset n:n: um vínculo por par (só pros moves que resolveram).
  // createMany + skipDuplicates (ON CONFLICT DO NOTHING na PK composta) em vez
  // de upsert por linha: são milhares de vínculos, e um round-trip por linha
  // estouraria o timeout da lambda no cron de refresh (§7). Idempotente igual.
  let linksSynced = 0;
  for (const { pokemonId, moveApiIds } of synced) {
    const moveIds = [...new Set(moveApiIds.map((apiId) => moveIdByApiId.get(apiId)))].filter(
      (moveId): moveId is string => Boolean(moveId),
    );
    if (moveIds.length === 0) continue;
    await prisma.pokemonMove.createMany({
      data: moveIds.map((moveId) => ({ pokemonId, moveId })),
      skipDuplicates: true,
    });
    linksSynced += moveIds.length;
  }

  return {
    pokemonSynced: synced.length,
    movesSynced: moveIdByApiId.size,
    linksSynced,
    failedPokemon,
  };
}
