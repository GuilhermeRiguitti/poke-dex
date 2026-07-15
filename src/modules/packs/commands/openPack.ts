import { fetchAndCachePokemon } from "@/src/lib/pokeapiCache";
import { prisma } from "@/src/lib/prisma";
import { canOpenFree, FREE_PACK_INTERVAL_MS } from "../domain/cooldown";
import { drawPack } from "../domain/rarity";
import { toPackStateDTO } from "../queries/readPackState";
import { toPackCardDTO } from "../queries/toPackDTO";
import type { OpenPackResultDTO } from "../ui/types";

export type OpenPackResult =
  | ({ ok: true; source: "free" | "extra" } & OpenPackResultDTO)
  | { ok: false; error: "on_cooldown" };

/**
 * Abre um pacote: sorteia 6 cartas ponderadas por raridade e as põe na coleção.
 * É a ÚNICA forma de obter pokémon (o "Capturar" direto morreu).
 *
 * `rng` é injetado só pra teste; em produção é Math.random.
 *
 * A ordem aqui é ditada pelo serverless (CLAUDE.md, regra 5 e 6):
 *  1. Garante a linha e lê o estado (upsert barato).
 *  2. Pré-checa elegibilidade ANTES de sortear/buscar. Sem isso, spammar o
 *     botão em cooldown dispararia 6 fetches na PokéAPI por clique.
 *  3. Sorteia e AQUECE O CACHE fora da transação — I/O de rede não segura
 *     transação aberta, e é aqui que os NormalizedPokemon da DTO são obtidos.
 *  4. Dentro da transação: CLAIM atômico primeiro. Quem perde a corrida (dois
 *     cliques, duas lambdas) sai com count 0 e NÃO escreve nenhuma carta.
 */
export async function openPack(
  userId: string,
  rng: () => number = Math.random
): Promise<OpenPackResult> {
  const now = Date.now();

  const state = await prisma.packState.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { lastFreePackAt: true, extraPacks: true },
  });

  const freeAvailable = canOpenFree(state.lastFreePackAt, now);
  if (!freeAvailable && state.extraPacks <= 0) {
    return { ok: false, error: "on_cooldown" };
  }

  // Sorteio e aquecimento de cache FORA da transação (I/O lento antes do claim).
  const drawnIds = drawPack(rng);
  const pokemons = await Promise.all(drawnIds.map((id) => fetchAndCachePokemon(id)));

  const result = await prisma.$transaction(
    async (tx) => {
      // ── CLAIM atômico ──────────────────────────────────────────────────
      // Prefere o pacote diário; só gasta um extra se o diário não estiver
      // disponível. O updateMany condicionado é a trava: só um request casa a
      // condição e escreve.
      let source: "free" | "extra" | null = null;

      if (freeAvailable) {
        const cutoff = new Date(now - FREE_PACK_INTERVAL_MS);
        const claim = await tx.packState.updateMany({
          where: { userId, OR: [{ lastFreePackAt: null }, { lastFreePackAt: { lte: cutoff } }] },
          data: { lastFreePackAt: new Date(now) },
        });
        if (claim.count > 0) source = "free";
      }

      if (!source && state.extraPacks > 0) {
        const claim = await tx.packState.updateMany({
          where: { userId, extraPacks: { gt: 0 } },
          data: { extraPacks: { decrement: 1 } },
        });
        if (claim.count > 0) source = "extra";
      }

      if (!source) return null; // perdeu a corrida — nada escrito

      // isNew: quais desses o jogador AINDA NÃO tinha, antes deste upsert.
      const owned = await tx.userCard.findMany({
        where: { userId, pokemonId: { in: drawnIds } },
        select: { pokemonId: true },
      });
      const ownedSet = new Set(owned.map((c) => c.pokemonId));

      // upsert na @unique([userId,pokemonId]): repetida é no-op, mas a carta
      // "sai" no pacote do mesmo jeito (marcada isNew:false pela UI).
      await Promise.all(
        drawnIds.map((pokemonId) =>
          tx.userCard.upsert({
            where: { userId_pokemonId: { userId, pokemonId } },
            create: { userId, pokemonId },
            update: {},
          })
        )
      );

      const updated = await tx.packState.findUniqueOrThrow({
        where: { userId },
        select: { lastFreePackAt: true, extraPacks: true, loginStreak: true },
      });

      return { source, ownedSet, updated };
    },
    { timeout: 15_000, maxWait: 5_000 }
  );

  if (!result) return { ok: false, error: "on_cooldown" };

  const cards = drawnIds.map((pokemonId, i) =>
    toPackCardDTO(pokemonId, pokemons[i], !result.ownedSet.has(pokemonId))
  );

  return { ok: true, source: result.source, cards, packState: toPackStateDTO(result.updated) };
}
