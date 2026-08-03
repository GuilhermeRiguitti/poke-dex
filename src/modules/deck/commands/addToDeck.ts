import { prisma } from "@/src/lib/prisma";
import { firstFreeOrder, isDeckFull } from "../domain/rules";
import { readLearnset } from "../queries/readLearnset";
import { getOrCreateDeck } from "../queries/readDeck";
import type { DeckSlotDTO } from "../ui/types";
import { toDeckSlotDTO } from "../queries/toDeckDTO";

export type AddToDeckInput = {
  userPokemonId: string;
};

export type AddToDeckResult =
  | { ok: true; slot: DeckSlotDTO }
  | { ok: false; error: "not_found" | "deck_full" | "invalid_cards" };

/**
 * Põe um pokémon no time. Só isso — o deck é o TIME, não a barra de golpes.
 *
 * As skills saíram daqui (2026-08-02): são escolhidas na BATALHA, no momento em
 * que o pokémon entra em campo. Por isso não há mais `moveIds`, nem modal, nem
 * `DeckSlotCard` — soltar a carta na coluna do deck é um gesto só.
 *
 * O que sobrou de trava: o pokémon precisa ter ao menos UMA skill liberada. Sem
 * nenhuma ele entraria em campo sem ação possível, e `buildDuelSnapshot` lança —
 * longe daqui, no meio do matchmaking, sem pista do porquê.
 *
 * Concorrência (CLAUDE.md regra 6): o jogador pode disparar dois requests juntos
 * (duas abas / duplo-clique). A leitura dos slots e o insert vão na MESMA
 * $transaction, então o limite de 6 é checado contra o estado real; e o slot é
 * `upsert` na @@unique([deckId, userPokemonId]), não findFirst+create — pôr o
 * mesmo pokémon duas vezes não cria dois slots.
 */
export async function addToDeck(userId: string, input: AddToDeckInput): Promise<AddToDeckResult> {
  // O pokémon é do jogador? (id de outro dono responde igual a inexistente — não
  // vira oráculo de "esse id existe".)
  const userPokemon = await prisma.userPokemon.findUnique({
    where: { id: input.userPokemonId },
    select: { id: true, userId: true },
  });
  if (!userPokemon || userPokemon.userId !== userId) return { ok: false, error: "not_found" };

  const learnset = await readLearnset(userId, userPokemon.id);
  if (!learnset?.some((c) => c.unlocked)) return { ok: false, error: "invalid_cards" };

  const deck = await getOrCreateDeck(userId);

  return prisma.$transaction(async (tx) => {
    // As posições ocupadas, não só quantas são: `removeFromDeck` deixa buraco na
    // sequência (tirar o slot do meio não renumera o resto), então a posição da
    // vaga nova sai de firstFreeOrder — contar daria uma posição já ocupada e o
    // insert morreria na @@unique([deckId, order]).
    const slots = await tx.deckSlot.findMany({
      where: { deckId: deck.id },
      select: { userPokemonId: true, order: true },
    });
    const existing = slots.find((s) => s.userPokemonId === input.userPokemonId);

    let order = existing?.order;
    if (existing == null) {
      if (isDeckFull(slots.length)) return { ok: false as const, error: "deck_full" as const };
      const free = firstFreeOrder(slots.map((s) => s.order));
      // Sem vaga mesmo com menos de 6 slots só acontece se alguma linha tiver
      // order fora de 0..5 — dado torto. Recusa em vez de escrever por cima.
      if (free == null) return { ok: false as const, error: "deck_full" as const };
      order = free;
    }

    const slot = await tx.deckSlot.upsert({
      where: { deckId_userPokemonId: { deckId: deck.id, userPokemonId: input.userPokemonId } },
      update: {}, // já está no time: pôr de novo não muda nada
      create: { deckId: deck.id, userPokemonId: input.userPokemonId, order: order! },
      select: { id: true, userPokemonId: true, order: true },
    });

    return { ok: true as const, slot: toDeckSlotDTO(slot) };
  });
}
