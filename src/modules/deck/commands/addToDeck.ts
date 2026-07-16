import { prisma } from "@/src/lib/prisma";
import { CARDS_PER_SLOT, DECK_LIMIT } from "../domain/rules";
import { getOrCreateDeck } from "../queries/readDeck";
import type { DeckSlotDTO } from "../ui/types";
import { toDeckSlotDTO } from "../queries/toDeckDTO";

export type AddToDeckInput = {
  userPokemonId: string;
  /** Move.ids escolhidos do learnset, na ordem da barra (0..5). Até CARDS_PER_SLOT. */
  moveIds: string[];
};

export type AddToDeckResult =
  | { ok: true; slot: DeckSlotDTO }
  | { ok: false; error: "not_found" | "deck_full" | "invalid_cards" };

/**
 * Monta um loadout no deck: 1 UserPokemon + suas cartas (skills do learnset).
 *
 * Concorrência (CLAUDE.md regra 6): o jogador pode disparar dois requests juntos
 * (duas abas / duplo-clique). A contagem de slots e o insert vão na MESMA
 * $transaction, então o limite de 6 é checado contra o estado real; e o slot é
 * `upsert` na @@unique([deckId, userPokemonId]), não findFirst+create — montar o
 * mesmo pokémon duas vezes não cria dois slots (o segundo ATUALIZA as cartas).
 */
export async function addToDeck(userId: string, input: AddToDeckInput): Promise<AddToDeckResult> {
  const moveIds = [...new Set(input.moveIds)];
  if (moveIds.length === 0 || moveIds.length > CARDS_PER_SLOT) {
    return { ok: false, error: "invalid_cards" };
  }

  // O pokémon é do jogador? (id de outro dono responde igual a inexistente — não
  // vira oráculo de "esse id existe".)
  const userPokemon = await prisma.userPokemon.findUnique({
    where: { id: input.userPokemonId },
    select: { id: true, userId: true, pokemonId: true },
  });
  if (!userPokemon || userPokemon.userId !== userId) return { ok: false, error: "not_found" };

  // Toda carta escolhida tem que estar no learnset DA ESPÉCIE (PokemonMove). Sem
  // isso o jogador poderia montar qualquer Move em qualquer pokémon pela rota.
  const learnable = await prisma.pokemonMove.count({
    where: { pokemonId: userPokemon.pokemonId, moveId: { in: moveIds } },
  });
  if (learnable !== moveIds.length) return { ok: false, error: "invalid_cards" };

  const deck = await getOrCreateDeck(userId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.deckSlot.findUnique({
      where: { deckId_userPokemonId: { deckId: deck.id, userPokemonId: input.userPokemonId } },
      select: { id: true, order: true },
    });

    let order = existing?.order;
    if (existing == null) {
      const count = await tx.deckSlot.count({ where: { deckId: deck.id } });
      if (count >= DECK_LIMIT) return { ok: false as const, error: "deck_full" as const };
      order = count; // próxima posição livre (0-based)
    }

    const slot = await tx.deckSlot.upsert({
      where: { deckId_userPokemonId: { deckId: deck.id, userPokemonId: input.userPokemonId } },
      update: { cards: { deleteMany: {} } }, // remonta a barra de cartas
      create: { deckId: deck.id, userPokemonId: input.userPokemonId, order: order! },
      select: { id: true },
    });

    await tx.deckSlotCard.createMany({
      data: moveIds.map((moveId, i) => ({ deckSlotId: slot.id, moveId, order: i })),
    });

    const full = await tx.deckSlot.findUniqueOrThrow({
      where: { id: slot.id },
      select: { id: true, userPokemonId: true, order: true, cards: { select: { moveId: true, order: true } } },
    });

    return { ok: true as const, slot: toDeckSlotDTO(full) };
  });
}
