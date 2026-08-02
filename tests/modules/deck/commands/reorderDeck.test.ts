import { beforeEach, describe, expect, it, vi } from "vitest";

// reorderDeck grava a nova ordem do time depois do arrastar. O que só quebra em
// produção: a @@unique([deckId, order]) recusa qualquer passo em que duas linhas
// tenham a mesma posição — por isso a gravação é em DUAS passadas (negativas,
// depois finais). E a lista que o cliente manda é uma foto: se o deck mudou em
// outra aba, é pra recusar em vez de gravar um time que ninguém montou.

const tx = {
  deck: { findFirst: vi.fn() },
  deckSlot: { update: vi.fn() },
};

const prismaMock = {
  deck: { findFirst: vi.fn() },
  deckSlot: { update: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { reorderDeck } = await import("@/src/modules/deck/commands/reorderDeck");

/** As posições gravadas, na ordem em que o command as escreveu. */
const escritas = () => tx.deckSlot.update.mock.calls.map((c) => [c[0].where.id, c[0].data.order] as const);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  tx.deck.findFirst.mockResolvedValue({
    id: "deck-1",
    slots: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
  });
  tx.deckSlot.update.mockResolvedValue({});
});

describe("reorderDeck", () => {
  it("grava a posição de cada slot pelo índice na lista", async () => {
    const result = await reorderDeck("alpha", ["s3", "s1", "s2"]);

    expect(result).toEqual({ ok: true });
    // A passada final é a que vale: s3 vira a vaga 0 (começa em campo).
    expect(escritas().slice(3)).toEqual([
      ["s3", 0],
      ["s1", 1],
      ["s2", 2],
    ]);
  });

  // O CASO QUE IMPORTA: sem a passada negativa, escrever s3->0 esbarra no s1
  // que ainda ocupa o 0, e o Postgres recusa NO MEIO — deck pela metade.
  it("tira todo mundo da faixa 0..5 antes de gravar a posição final", async () => {
    await reorderDeck("alpha", ["s3", "s1", "s2"]);

    const [primeiras, finais] = [escritas().slice(0, 3), escritas().slice(3)];

    expect(primeiras.every(([, order]) => order < 0)).toBe(true);
    // Nenhuma posição negativa se repete, senão a própria passada 1 colidiria.
    expect(new Set(primeiras.map(([, order]) => order)).size).toBe(3);
    expect(finais.every(([, order]) => order >= 0)).toBe(true);
  });

  it("as duas passadas vão na MESMA transação", async () => {
    await reorderDeck("alpha", ["s3", "s1", "s2"]);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    // Nada de update fora dela: morrer no meio deixaria o time em posição
    // negativa, e não há worker pra consertar (CLAUDE.md regra 5).
    expect(prismaMock.deckSlot.update).not.toHaveBeenCalled();
  });

  // A lista é uma FOTO do que o jogador via. Se a outra aba tirou um loadout, a
  // foto tem um slot a mais — gravar mandaria pro banco um time que não existe.
  it("recusa lista que não bate com o deck e NÃO escreve nada", async () => {
    const result = await reorderDeck("alpha", ["s1", "s2", "s3", "s4"]);

    expect(result).toEqual({ ok: false, error: "stale_order" });
    expect(tx.deckSlot.update).not.toHaveBeenCalled();
  });

  it("recusa lista que esqueceu um slot (o esquecido sairia do time)", async () => {
    const result = await reorderDeck("alpha", ["s1", "s2"]);

    expect(result).toEqual({ ok: false, error: "stale_order" });
    expect(tx.deckSlot.update).not.toHaveBeenCalled();
  });

  // Id repetido "bate" no tamanho sem cobrir o deck todo: s3 nunca receberia
  // posição, e s1 receberia duas.
  it("recusa id repetido", async () => {
    const result = await reorderDeck("alpha", ["s1", "s1", "s2"]);

    expect(result).toEqual({ ok: false, error: "stale_order" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // O slot de outro dono não está no deck DESTE jogador — cai na mesma checagem
  // de conjunto, sem virar oráculo de "esse id existe".
  it("recusa slot que não é do deck do jogador", async () => {
    const result = await reorderDeck("alpha", ["s1", "s2", "de-outro"]);

    expect(result).toEqual({ ok: false, error: "stale_order" });
    expect(tx.deckSlot.update).not.toHaveBeenCalled();
  });

  it("sem deck, responde not_found sem escrever", async () => {
    tx.deck.findFirst.mockResolvedValue(null);

    const result = await reorderDeck("alpha", ["s1"]);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(tx.deckSlot.update).not.toHaveBeenCalled();
  });

  it("recusa lista vazia", async () => {
    const result = await reorderDeck("alpha", []);

    expect(result).toEqual({ ok: false, error: "stale_order" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
