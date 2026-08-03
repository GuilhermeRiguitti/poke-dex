import { beforeEach, describe, expect, it, vi } from "vitest";

// addToDeck põe um pokémon no TIME. Desde 2026-08-02 ele não guarda mais skill
// nenhuma — a barra é escolhida na batalha, ao pôr o pokémon em campo.
//
// O que só quebra em produção: a concorrência (dois requests juntos não podem
// estourar o deck pra 7) e o buraco de posição deixado por quem saiu do meio.

const tx = {
  deckSlot: { findMany: vi.fn(), upsert: vi.fn() },
};

const prismaMock = {
  userPokemon: { findUnique: vi.fn() },
  // readLearnset lê estas duas: o learnset da espécie + as concedidas por fora.
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
  deck: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { addToDeck } = await import("@/src/modules/deck/commands/addToDeck");
const { DECK_LIMIT } = await import("@/src/modules/deck/domain/rules");

const input = { userPokemonId: "up-1" };

/**
 * Slots de OUTROS pokémon já no time. Os ids são `outro-N` de propósito: `up-1`
 * é quem está entrando, e se aparecesse aqui o command acharia que já está no
 * time.
 */
const slotsAt = (orders: number[]) => orders.map((order) => ({ userPokemonId: `outro-${order}`, order }));

/** Uma linha de learnset como o readLearnset lê do banco. */
const golpe = (id: string, levelLearnedAt: number, power: number | null = 60) => ({
  levelLearnedAt,
  learnMethod: "level-up",
  move: { id, name: id, type: "normal", power, damageClass: "physical" },
});

beforeEach(() => {
  vi.clearAllMocks();

  // Serve os DOIS leitores: o addToDeck (dono) e o readLearnset (espécie+nível).
  prismaMock.userPokemon.findUnique.mockResolvedValue({
    id: "up-1",
    userId: "alpha",
    pokemonId: "species-1",
    level: 12,
  });
  // readLearnset: um golpe já liberado no nível 12.
  prismaMock.pokemonMove.findMany.mockResolvedValue([golpe("tackle", 1)]);
  prismaMock.userPokemonMove.findMany.mockResolvedValue([]);
  prismaMock.deck.findFirst.mockResolvedValue({ id: "deck-1" });
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.deckSlot.findMany.mockResolvedValue([]); // time vazio
  tx.deckSlot.upsert.mockResolvedValue({ id: "slot-1", userPokemonId: "up-1", order: 0 });
});

describe("addToDeck", () => {
  it("põe o pokémon no time quando há vaga", async () => {
    const result = await addToDeck("alpha", input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot.userPokemonId).toBe("up-1");
    expect(tx.deckSlot.upsert).toHaveBeenCalledOnce();
  });

  // O DTO não leva mais cartas — a barra de skills não é do deck.
  it("o slot devolvido NÃO carrega barra de skills", async () => {
    const result = await addToDeck("alpha", input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.slot)).not.toContain("cards");
    expect(JSON.stringify(result.slot)).not.toContain("moveId");
  });

  // Não basta devolver erro: não pode SOBRAR escrita, senão o deck vai a 7.
  it("com o time cheio, recusa e NÃO escreve nada", async () => {
    tx.deckSlot.findMany.mockResolvedValue(slotsAt([...Array(DECK_LIMIT).keys()]));

    const result = await addToDeck("alpha", input);

    expect(result).toEqual({ ok: false, error: "deck_full" });
    expect(tx.deckSlot.upsert).not.toHaveBeenCalled();
  });

  // Leitura e insert na MESMA transação: se a leitura rodasse fora, duas lambdas
  // leriam "5" ao mesmo tempo e as duas inseririam — time com 7.
  it("checa o limite e insere dentro da MESMA transação", async () => {
    await addToDeck("alpha", input);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.deckSlot.findMany).toHaveBeenCalled();
    expect(tx.deckSlot.upsert).toHaveBeenCalled();
  });

  // O BUG DO BURACO: tirar o pokémon do MEIO não renumera os outros. Se a
  // posição do novo fosse a CONTAGEM (5 aqui), o insert cairia em cima do slot
  // que já ocupa o 5 — @@unique([deckId, order]), P2002, 500 no POST.
  it("ocupa o buraco deixado por quem saiu do MEIO do time", async () => {
    tx.deckSlot.findMany.mockResolvedValue(slotsAt([0, 1, 3, 4, 5])); // saiu o 2

    await addToDeck("alpha", input);

    expect(tx.deckSlot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ order: 2 }) })
    );
  });

  it("sem buraco, o novo entra no fim do time", async () => {
    tx.deckSlot.findMany.mockResolvedValue(slotsAt([0, 1, 2]));

    await addToDeck("alpha", input);

    expect(tx.deckSlot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ order: 3 }) })
    );
  });

  it("quem já está no time não esbarra no limite e não muda de posição", async () => {
    tx.deckSlot.findMany.mockResolvedValue([
      ...slotsAt([0, 1, 3, 4, 5]),
      { userPokemonId: "up-1", order: 2 },
    ]);

    const result = await addToDeck("alpha", input);

    expect(result.ok).toBe(true);
    expect(tx.deckSlot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ order: 2 }) })
    );
  });

  it("recusa o pokémon de outro dono sem escrever nada", async () => {
    prismaMock.userPokemon.findUnique.mockResolvedValue({ id: "up-1", userId: "beta" });

    const result = await addToDeck("alpha", input);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // A trava que sobrou: sem NENHUMA skill liberada o pokémon entraria em campo
  // sem ação possível, e o buildDuelSnapshot lança — longe daqui, no meio do
  // matchmaking, sem pista do porquê.
  it("recusa pokémon sem nenhuma skill liberada", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([]);

    const result = await addToDeck("alpha", input);

    expect(result).toEqual({ ok: false, error: "invalid_cards" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
