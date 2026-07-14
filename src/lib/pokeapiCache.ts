import { prisma } from "./prisma";
import {
  fetchMove,
  fetchPokemon,
  fetchType,
  type NormalizedMove,
  type NormalizedPokemon,
  type NormalizedType,
} from "./pokeapi";

// Cache PERSISTENTE de respostas da PokéAPI, na tabela PokeApiCache.
//
// Por que existir, se lib/pokeapi.ts já cacheia no fetch do Next: o cache do
// fetch morre a cada deploy e vive por deployment. Este sobrevive. A fair use
// policy da PokéAPI pede "locally cache resources whenever you request them" —
// e um cache que se esvazia a cada push não é bem isso. Pokémon/move/type de
// uma geração já lançada são imutáveis: cachear pra sempre é seguro.
//
// ┌─ A DIVISÃO QUE IMPORTA ────────────────────────────────────────────────┐
// │ readCached*  → SÓ LÊ. Devolve null/vazio no miss. Seguro em render.    │
// │ fetchAndCache* → lê, e no miss busca na rede e GRAVA. SÓ EM COMMAND.   │
// └────────────────────────────────────────────────────────────────────────┘
//
// A regra "nunca escreva durante o render de uma page" (CLAUDE.md) é o motivo
// dessa divisão existir. Um upsert de cache parece inofensivo, mas render de
// page pode ser disparado por prefetch/prerender, e um throw ali entrega tela
// de erro no lugar da página — não há estado de "carregando" pra segurar.
//
// Na prática o miss quase não acontece na coleção: capturar um pokémon é um
// command (pokedex/commands/addCard), ele JÁ busca o pokémon na PokéAPI pra
// validar, e agora grava o resultado aqui. Ou seja, tudo que o usuário tem na
// coleção foi escrito no cache no momento da captura. A leitura da coleção é
// hit por construção.

type CacheKey = `pokemon:${number}` | `move:${number}` | `type:${string}`;

/** Lê uma chave do cache. Nunca escreve, nunca vai na rede. */
async function readCached<T>(key: CacheKey): Promise<T | null> {
  const row = await prisma.pokeApiCache.findUnique({ where: { key } });
  return row ? (row.payload as T) : null;
}

/** Lê; no miss, busca na rede e GRAVA. Só pode ser chamada de um command. */
async function fetchAndCache<T>(key: CacheKey, fetcher: () => Promise<T | null>): Promise<T | null> {
  const hit = await readCached<T>(key);
  if (hit) return hit;

  const data = await fetcher();
  if (data) {
    await prisma.pokeApiCache.upsert({
      where: { key },
      update: { payload: data as object, fetchedAt: new Date() },
      create: { key, payload: data as object },
    });
  }
  return data;
}

// ─── leitura pura (segura em render de page) ──────────────────────────────

/**
 * Lê vários pokémon do cache de uma vez. Uma query, zero rede, zero escrita.
 * Chaves que não estão no cache simplesmente não aparecem no Map — quem chama
 * decide o que fazer com o miss (a coleção cai no fetchPokemon, que é leitura).
 */
export async function readCachedPokemons(ids: number[]): Promise<Map<number, NormalizedPokemon>> {
  if (ids.length === 0) return new Map();

  const rows = await prisma.pokeApiCache.findMany({
    where: { key: { in: ids.map((id) => `pokemon:${id}`) } },
  });

  const byId = new Map<number, NormalizedPokemon>();
  for (const row of rows) {
    // payload é Json no Prisma (pode ser array, número, null...). Nós é que
    // escrevemos essas linhas, então sabemos o que tem lá — mas o `?.id` fica
    // como rede: uma linha corrompida vira miss, não um crash na coleção.
    const pokemon = row.payload as unknown as NormalizedPokemon | null;
    if (pokemon?.id) byId.set(pokemon.id, pokemon);
  }
  return byId;
}

// ─── lê-ou-busca-e-grava (SÓ em command) ──────────────────────────────────

export function fetchAndCachePokemon(id: number): Promise<NormalizedPokemon | null> {
  return fetchAndCache<NormalizedPokemon>(`pokemon:${id}`, () => fetchPokemon(id));
}

export function fetchAndCacheMove(id: number): Promise<NormalizedMove | null> {
  return fetchAndCache<NormalizedMove>(`move:${id}`, () => fetchMove(id));
}

export function fetchAndCacheType(name: string): Promise<NormalizedType | null> {
  return fetchAndCache<NormalizedType>(`type:${name}`, () => fetchType(name));
}
