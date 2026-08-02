import { prisma } from "@/src/lib/prisma";

export type ReorderDeckResult = { ok: true } | { ok: false; error: "not_found" | "stale_order" };

/**
 * Grava a nova ordem do time. Recebe os ids dos DeckSlot na ordem que o jogador
 * deixou na tela; a posição de cada um vira o índice na lista.
 *
 * ── Por que a gravação é em DUAS PASSADAS ──────────────────────────────────
 * `DeckSlot` tem @@unique([deckId, order]). Reordenar linha por linha passa por
 * estados em que duas linhas têm a MESMA posição — trocar o 0 com o 1 já
 * começa escrevendo 1 numa linha onde a outra ainda é 1 — e o banco recusa no
 * meio do caminho. Postgres checa índice único por comando, não no fim da
 * transação, então não adianta agrupar.
 *
 * Por isso: primeiro todo mundo vai pra posição NEGATIVA (-1, -2, …), que nunca
 * colide com as posições reais (0..5); depois a passada final grava 0..N-1 em
 * cima de um espaço já vazio. A alternativa seria um índice DEFERRABLE, que o
 * `schema.prisma` não sabe descrever — dependeria de SQL escrito à mão numa
 * migration de schema, contra o fluxo do projeto (CLAUDE.md).
 *
 * As duas passadas vão na MESMA $transaction (CLAUDE.md regra 5): morrer entre
 * elas deixaria o time inteiro em posição negativa, e não há worker pra
 * consertar depois.
 *
 * ── Concorrência (regra 6) ─────────────────────────────────────────────────
 * A lista que o cliente manda é uma FOTO do que ele estava vendo. Se nesse meio
 * tempo a outra aba tirou ou montou um loadout, a foto não bate mais com o
 * deck — e aí a resposta é `stale_order`, não uma gravação parcial. O cliente
 * recarrega e o jogador arrasta de novo, que é melhor do que gravar um time que
 * ele não montou.
 */
export async function reorderDeck(userId: string, slotIds: string[]): Promise<ReorderDeckResult> {
  // Id repetido faria a lista "bater" no tamanho sem cobrir o deck todo, e a
  // segunda passada gravaria duas posições na mesma linha.
  if (slotIds.length === 0 || new Set(slotIds).size !== slotIds.length) {
    return { ok: false, error: "stale_order" };
  }

  return prisma.$transaction(async (tx) => {
    // O deck do jogador, do mesmo jeito que todo mundo que lê (a dívida do
    // Deck.userId sem @unique — ver readDeck.ts).
    const deck = await tx.deck.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, slots: { select: { id: true } } },
    });
    if (!deck) return { ok: false as const, error: "not_found" as const };

    // A lista tem que ser exatamente o deck: mesmo tamanho e mesmos ids. Isso
    // cobre de uma vez o slot de outro dono, o slot que já foi removido e a
    // lista que esqueceu alguém (que sairia do time sem ninguém pedir).
    const noDeck = new Set(deck.slots.map((s) => s.id));
    if (slotIds.length !== noDeck.size || !slotIds.every((id) => noDeck.has(id))) {
      return { ok: false as const, error: "stale_order" as const };
    }

    // Passada 1: sai da faixa 0..5 pra liberar o índice único.
    for (const [i, id] of slotIds.entries()) {
      await tx.deckSlot.update({ where: { id }, data: { order: -(i + 1) } });
    }
    // Passada 2: a posição final.
    for (const [i, id] of slotIds.entries()) {
      await tx.deckSlot.update({ where: { id }, data: { order: i } });
    }

    return { ok: true as const };
  });
}
