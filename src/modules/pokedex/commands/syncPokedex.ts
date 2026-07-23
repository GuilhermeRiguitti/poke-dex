import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import {
  extractIdFromUrl,
  fetchEvolutionChain,
  fetchMove,
  fetchPokemon,
  fetchSpeciesEvolutionChainId,
  type NormalizedPokemon,
} from "@/src/lib/pokeapi";
import type { BaseStats } from "../domain/leveling";
import { pickLearnEntry, pickVersionGroup, type LearnsetEntry } from "../domain/learnset";
import { parseLevelUpEvolutions, type EvolutionEdge } from "../domain/evolution";

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

/**
 * A evolução POR NÍVEL desta espécie (ou null). A cadeia é buscada uma vez por
 * `chainId` e memoizada: muitas espécies compartilham a mesma cadeia (Bulbasaur,
 * Ivysaur e Venusaur têm uma só), então sem o cache o seed refaria o mesmo fetch
 * três vezes. Falha de rede não aborta o seed — a espécie fica sem evolução.
 */
async function resolveEvolutionEdge(
  speciesApiId: number,
  chainCache: Map<number, Promise<Map<number, EvolutionEdge>>>,
): Promise<EvolutionEdge | null> {
  const chainId = await fetchSpeciesEvolutionChainId(speciesApiId);
  if (chainId == null) return null;

  let edgesP = chainCache.get(chainId);
  if (!edgesP) {
    edgesP = fetchEvolutionChain(chainId).then((root) =>
      root ? parseLevelUpEvolutions(root) : new Map<number, EvolutionEdge>(),
    );
    chainCache.set(chainId, edgesP);
  }
  const edges = await edgesP;
  return edges.get(speciesApiId) ?? null;
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

/** O que sobra de uma espécie sincronizada: a linha e o learnset já decidido. */
interface SyncedSpecies {
  pokemonId: string;
  /** moveApiId → nível/método/jogo em que ESTA espécie aprende o move. */
  learnset: Map<number, LearnsetEntry>;
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
 * moves do learnset (deduplicados entre espécies) e dos vínculos n:n — estes
 * já com o nível/método de aprendizado do version group escolhido pra espécie.
 * Idempotente: re-rodar com os mesmos ids converge no mesmo estado.
 */
export async function syncPokedex(
  pokemonApiIds: number[],
  { concurrency = 8 }: SyncPokedexOptions = {},
): Promise<SyncPokedexSummary> {
  const failedPokemon: number[] = [];
  // Cadeia de evolução → arestas por nível, memoizada por chainId (espécies da
  // mesma linha compartilham a cadeia). Ver resolveEvolutionEdge.
  const chainCache = new Map<number, Promise<Map<number, EvolutionEdge>>>();

  // 1) espécies: fetch + upsert, guardando o id do banco e os moveApiIds de cada.
  const fetched = await mapLimit(pokemonApiIds, concurrency, async (apiId) => {
    const p = await fetchPokemon(apiId);
    if (!p) {
      failedPokemon.push(apiId);
      return null;
    }

    // Evolução por nível desta espécie (fiel: só level-up com min_level). O alvo
    // é gravado por pokemonApiId — o awardBattleXp resolve pra Pokemon.id na hora.
    const evolution = await resolveEvolutionEdge(p.id, chainCache);
    // Prisma exige InputJsonValue (com index signature) pra colunas Json; o
    // BaseStats/`string[]` tipados não casam sozinhos, daí o cast no ponto de
    // escrita. Hoisted pra não repetir a whitelist em create/update.
    const data = {
      name: p.name,
      types: toTypeNames(p) as Prisma.InputJsonValue,
      baseStats: toBaseStats(p) as unknown as Prisma.InputJsonObject,
      baseExperience: p.baseExperience,
      spriteUrl: p.sprites.artwork ?? p.sprites.front_default,
      evolvesToApiId: evolution?.toApiId ?? null,
      evolvesToLevel: evolution?.minLevel ?? null,
    };
    const row = await prisma.pokemon.upsert({
      where: { pokemonApiId: p.id },
      create: { pokemonApiId: p.id, ...data },
      update: { ...data, fetchedAt: new Date() },
    });

    // Learnset FIEL: a espécie aprende cada move num nível e por um método, e
    // isso varia por jogo. Escolhemos UM version group pra ela (o mais recente
    // que tiver level-up) e guardamos a entrada daquele jogo. Ver domain/learnset.
    const allDetails = p.moves.flatMap((m) => m.learnDetails);
    const versionGroup = pickVersionGroup(allDetails);

    const learnset = new Map<number, LearnsetEntry>();
    if (versionGroup) {
      for (const m of p.moves) {
        const moveApiId = extractIdFromUrl(m.move.url);
        if (!Number.isFinite(moveApiId)) continue;
        const entry = pickLearnEntry(m.learnDetails, versionGroup);
        if (entry) learnset.set(moveApiId, entry);
      }
    }

    return { pokemonId: row.id, learnset };
  });

  const synced = fetched.filter((x): x is SyncedSpecies => x !== null);

  // 2) moves: união deduplicada de todos os learnsets, fetch + upsert.
  const uniqueMoveApiIds = [...new Set(synced.flatMap((s) => [...s.learnset.keys()]))];
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

  // 3) learnset n:n: um vínculo por par, agora CARREGANDO nível/método/jogo.
  //
  // deleteMany + createMany (e não createMany + skipDuplicates como antes): o
  // vínculo deixou de ser um booleano "sabe/não sabe" e passou a ter DADO
  // (levelLearnedAt/learnMethod/versionGroup). skipDuplicates ignoraria a linha
  // já existente e o refresh nunca corrigiria um nível errado — o espelho
  // congelaria na primeira versão semeada. Como é por espécie e re-rodável, uma
  // passada interrompida no meio se conserta na próxima (não há invariante
  // multi-passo aqui; ver o bloco sobre $transaction no topo).
  let linksSynced = 0;
  for (const { pokemonId, learnset } of synced) {
    const rows = [...learnset.entries()]
      .map(([apiId, entry]) => ({ moveId: moveIdByApiId.get(apiId), entry }))
      .filter((r): r is { moveId: string; entry: LearnsetEntry } => Boolean(r.moveId));
    if (rows.length === 0) continue;

    await prisma.pokemonMove.deleteMany({ where: { pokemonId } });
    await prisma.pokemonMove.createMany({
      data: rows.map(({ moveId, entry }) => ({
        pokemonId,
        moveId,
        levelLearnedAt: entry.levelLearnedAt,
        learnMethod: entry.learnMethod,
        versionGroup: entry.versionGroup,
      })),
      skipDuplicates: true,
    });
    linksSynced += rows.length;
  }

  return {
    pokemonSynced: synced.length,
    movesSynced: moveIdByApiId.size,
    linksSynced,
    failedPokemon,
  };
}
