import { prisma } from "./prisma";
import { fetchType, type NormalizedType } from "./pokeapi";

// Cache PERSISTENTE de respostas da PokéAPI, na tabela PokeApiCache.
//
// Por que existir, se lib/pokeapi.ts já cacheia no fetch do Next: o cache do
// fetch morre a cada deploy e vive por deployment. Este sobrevive. A fair use
// policy da PokéAPI pede "locally cache resources whenever you request them" —
// e um cache que se esvazia a cada push não é bem isso. Pokémon/move/type de
// uma geração já lançada são imutáveis: cachear pra sempre é seguro.
//
// **Hoje só o TYPE passa por aqui.** Pokémon e move viraram ESPELHO em tabela
// (`Pokemon`/`Move`, escritos pelo `syncPokedex`), que é consultável — dá pra
// filtrar e ordenar, coisa que este key-value não faz. O type continua no cache
// porque é usado só pra calcular efetividade no `buildDuelSnapshot`: ninguém
// filtra por ele, então uma linha de Json basta.
//
// `fetchAndCacheType` **GRAVA** no miss — é command-only. Chamar do render de
// uma page quebra a regra 2 do CLAUDE.md: prefetch/prerender disparam o render,
// e um throw ali entrega tela de erro no lugar da página, sem estado de
// "carregando" pra segurar.

type CacheKey = `type:${string}`;

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

// ─── lê-ou-busca-e-grava (SÓ em command) ──────────────────────────────────

export function fetchAndCacheType(name: string): Promise<NormalizedType | null> {
  return fetchAndCache<NormalizedType>(`type:${name}`, () => fetchType(name));
}
