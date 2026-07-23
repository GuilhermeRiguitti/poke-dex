import { prisma } from "@/src/lib/prisma";
import { STARTING_LEVEL, xpForLevel, type PokemonCardDTO } from "@/src/modules/pokedex";
import { canOpenFree, FREE_PACK_INTERVAL_MS } from "../domain/cooldown";
import { drawPack } from "../domain/rarity";
import { toPackStateDTO } from "../queries/readPackState";
import { toPackCardDTO } from "../queries/toPackDTO";
import type { OpenPackResultDTO } from "../ui/types";

export type OpenPackResult =
  | ({ ok: true; source: "free" | "extra" } & OpenPackResultDTO)
  | { ok: false; error: "on_cooldown" | "empty_pokedex" };

/** Uma espécie do espelho como o pacote precisa dela. */
type MirrorSpecies = { id: string; pokemonApiId: number; card: PokemonCardDTO };

/**
 * Abre um pacote: sorteia PACK_SIZE cartas ponderadas por raridade e cria os
 * UserPokemon (em STARTING_LEVEL) na coleção. É a ÚNICA forma de obter pokémon.
 *
 * O pool do sorteio é o ESPELHO LOCAL (Pokemon), não a dex inteira: só dá pra
 * ganhar espécie que existe no nosso banco (o UserPokemon tem FK pro Pokemon).
 * Conforme mais gerações são semeadas, o pool cresce sozinho. bstOf/rarity ainda
 * cobrem 1..1025 (tabela estática), então o peso do sorteio segue correto.
 *
 * Ordem ditada pelo serverless (CLAUDE.md regras 5 e 6):
 *  1. Garante a linha e lê o estado (upsert barato).
 *  2. Pré-checa elegibilidade ANTES de sortear.
 *  3. Lê o pool do espelho e sorteia FORA da transação.
 *  4. Dentro da transação: CLAIM atômico primeiro; quem perde a corrida sai com
 *     count 0 e NÃO cria nenhum UserPokemon.
 */
export async function openPack(userId: string, rng: () => number = Math.random): Promise<OpenPackResult> {
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

  // Pool do espelho + sorteio FORA da transação. O card já sai daqui montado.
  const species = await prisma.pokemon.findMany({
    select: { id: true, pokemonApiId: true, name: true, spriteUrl: true, types: true },
  });
  if (species.length === 0) return { ok: false, error: "empty_pokedex" };

  const byApiId = new Map<number, MirrorSpecies>();
  for (const s of species) {
    byApiId.set(s.pokemonApiId, {
      id: s.id,
      pokemonApiId: s.pokemonApiId,
      card: {
        id: s.pokemonApiId,
        name: s.name,
        artworkUrl: s.spriteUrl,
        iconUrl: s.spriteUrl,
        types: s.types as string[],
      },
    });
  }

  const drawnIds = drawPack(rng, undefined, Array.from(byApiId.keys()));

  const result = await prisma.$transaction(
    async (tx) => {
      // ── CLAIM atômico ──────────────────────────────────────────────────
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

      const speciesIds = drawnIds.map((apiId) => byApiId.get(apiId)!.id);

      // isNew: quais espécies o jogador AINDA NÃO tinha antes deste upsert.
      const owned = await tx.userPokemon.findMany({
        where: { userId, pokemonId: { in: speciesIds } },
        select: { pokemonId: true },
      });
      const ownedSet = new Set(owned.map((c) => c.pokemonId));

      // upsert na @@unique([userId, pokemonId]): repetida é no-op (não reseta
      // nível/XP), mas a carta "sai" no pacote igual (marcada isNew:false).
      await Promise.all(
        speciesIds.map((pokemonId) =>
          tx.userPokemon.upsert({
            where: { userId_pokemonId: { userId, pokemonId } },
            // Nível/XP explícitos (e não só o default do banco) porque os dois
            // têm que casar: `level` é função de `xp` (levelFromXp). Escrever um
            // sem o outro criaria o único estado inválido possível aqui.
            create: { userId, pokemonId, level: STARTING_LEVEL, xp: xpForLevel(STARTING_LEVEL) },
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

  const cards = drawnIds.map((apiId) => {
    const s = byApiId.get(apiId)!;
    return toPackCardDTO(apiId, s.card, !result.ownedSet.has(s.id));
  });

  return { ok: true, source: result.source, cards, packState: toPackStateDTO(result.updated) };
}
