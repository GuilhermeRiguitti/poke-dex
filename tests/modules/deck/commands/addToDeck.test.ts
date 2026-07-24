import { beforeEach, describe, expect, it, vi } from "vitest";

// addToDeck monta um loadout (1 UserPokemon + cartas do learnset). A regra pura
// do limite (máx. 6 slots) já tem teste em domain/rules.test.ts; o que só quebra
// em produção é a concorrência: dois requests juntos (duas abas/duplo-clique)
// não podem estourar o deck pra 7 nem montar carta fora do learnset.

const tx = {
  deckSlot: { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn(), findUniqueOrThrow: vi.fn() },
  deckSlotCard: { createMany: vi.fn() },
};

const prismaMock = {
  userPokemon: { findUnique: vi.fn() },
  // getUnlockedMoveIds (pokedex) lê estas duas: level-up destravado ∪ concedidas.
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
  deck: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { addToDeck } = await import("@/src/modules/deck/commands/addToDeck");
const { DECK_LIMIT } = await import("@/src/modules/deck/domain/rules");

const MOVES = ["m0", "m1", "m2", "m3", "m4", "m5"];
const input = { userPokemonId: "up-1", moveIds: MOVES };

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.userPokemon.findUnique.mockResolvedValue({
    id: "up-1",
    userId: "alpha",
    pokemonId: "species-1",
    level: 12,
  });
  // todas destravadas por level-up; nenhuma concedida por fora
  prismaMock.pokemonMove.findMany.mockResolvedValue(MOVES.map((moveId) => ({ moveId })));
  prismaMock.userPokemonMove.findMany.mockResolvedValue([]);
  prismaMock.deck.findFirst.mockResolvedValue({ id: "deck-1" });
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.deckSlot.findUnique.mockResolvedValue(null); // ainda não está no deck
  tx.deckSlot.count.mockResolvedValue(0);
  tx.deckSlot.upsert.mockResolvedValue({ id: "slot-1" });
  tx.deckSlotCard.createMany.mockResolvedValue({ count: MOVES.length });
  tx.deckSlot.findUniqueOrThrow.mockResolvedValue({
    id: "slot-1",
    userPokemonId: "up-1",
    order: 0,
    cards: MOVES.map((moveId, i) => ({ moveId, order: i })),
  });
});

describe("addToDeck", () => {
  it("monta o loadout quando há vaga", async () => {
    const result = await addToDeck("alpha", input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot.userPokemonId).toBe("up-1");
    expect(result.slot.cards).toHaveLength(6);
    expect(tx.deckSlot.upsert).toHaveBeenCalledOnce();
    expect(tx.deckSlotCard.createMany).toHaveBeenCalledOnce();
  });

  // O CASO QUE IMPORTA: deck cheio. Não basta devolver erro — não pode SOBRAR
  // escrita. Se o upsert rodasse "mesmo assim", o deck iria a 7.
  it("com o deck cheio, recusa e NÃO escreve nada", async () => {
    tx.deckSlot.count.mockResolvedValue(DECK_LIMIT);

    const result = await addToDeck("alpha", input);

    expect(result).toEqual({ ok: false, error: "deck_full" });
    expect(tx.deckSlot.upsert).not.toHaveBeenCalled();
    expect(tx.deckSlotCard.createMany).not.toHaveBeenCalled();
  });

  // Contagem e insert na MESMA transação: se a contagem rodasse fora, duas
  // lambdas leriam "5" ao mesmo tempo e as duas inseririam — deck com 7.
  it("checa o limite e insere dentro da MESMA transação", async () => {
    await addToDeck("alpha", input);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(tx.deckSlot.count).toHaveBeenCalled();
    expect(tx.deckSlot.upsert).toHaveBeenCalled();
  });

  // Remontar um pokémon que JÁ está no deck não esbarra no limite (está só
  // trocando as cartas do slot existente).
  it("um pokémon que já está no deck não esbarra no limite", async () => {
    tx.deckSlot.findUnique.mockResolvedValue({ id: "slot-1", order: 2 });
    tx.deckSlot.count.mockResolvedValue(DECK_LIMIT);

    const result = await addToDeck("alpha", input);

    expect(result.ok).toBe(true);
    expect(tx.deckSlot.count).not.toHaveBeenCalled();
  });

  it("recusa o pokémon de outro dono sem escrever nada", async () => {
    prismaMock.userPokemon.findUnique.mockResolvedValue({ id: "up-1", userId: "beta", pokemonId: "species-1" });

    const result = await addToDeck("alpha", input);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("recusa carta que NÃO está desbloqueada (nem level-up, nem concedida)", async () => {
    // uma das 6 não aparece em nenhuma das fontes
    prismaMock.pokemonMove.findMany.mockResolvedValue(MOVES.slice(0, 5).map((moveId) => ({ moveId })));
    prismaMock.userPokemonMove.findMany.mockResolvedValue([]);

    const result = await addToDeck("alpha", input);

    expect(result).toEqual({ ok: false, error: "invalid_cards" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // A abertura desta fatia: carta de TM (não vem por nível) ensinada pelo jogador
  // já pode ir pro deck. Aqui o level-up cobre 5 e a concedida cobre a 6ª.
  it("aceita carta concedida por TM (fora do level-up)", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue(MOVES.slice(0, 5).map((moveId) => ({ moveId })));
    prismaMock.userPokemonMove.findMany.mockResolvedValue([{ moveId: MOVES[5] }]);

    const result = await addToDeck("alpha", input);

    expect(result.ok).toBe(true);
  });

  // O modal já esconde as travadas, mas o POST é público: sem este filtro, um
  // `curl` montaria hyper-beam num pokémon nível 5.
  it("só conta como aprendível por nível o que o NÍVEL já destravou (level-up <= nível)", async () => {
    await addToDeck("alpha", input);

    expect(prismaMock.pokemonMove.findMany).toHaveBeenCalledWith({
      where: {
        pokemonId: "species-1",
        learnMethod: "level-up",
        levelLearnedAt: { lte: 12 },
      },
      select: { moveId: true },
    });
  });

  it("recusa loadout sem carta nenhuma", async () => {
    const result = await addToDeck("alpha", { userPokemonId: "up-1", moveIds: [] });

    expect(result).toEqual({ ok: false, error: "invalid_cards" });
    expect(prismaMock.userPokemon.findUnique).not.toHaveBeenCalled();
  });
});
