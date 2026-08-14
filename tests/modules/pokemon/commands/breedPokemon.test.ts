import { beforeEach, describe, expect, it, vi } from "vitest";

// O cruzamento cria uma carta do nada — então o que só quebra em produção é o
// limite diário sob concorrência: dois cliques no "Cruzar" não podem dar dois
// filhotes (CLAUDE.md regra 6).

const tx = {
  packState: { updateMany: vi.fn() },
  userPokemon: { create: vi.fn() },
  userPokemonMove: { create: vi.fn() },
};

const prismaMock = {
  userPokemon: { findMany: vi.fn() },
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { breedPokemon } = await import("@/src/modules/pokemon/commands/breedPokemon");

const NOW = new Date("2026-08-14T12:00:00.000Z");
const input = { parentAId: "up-a", parentBId: "up-b" };

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.userPokemon.findMany.mockResolvedValue([
    { id: "up-a", pokemonId: "sp-a", level: 20 },
    { id: "up-b", pokemonId: "sp-b", level: 20 },
  ]);

  // getUnlockedMoveIds (level-up ≤ nível) e readEggMoveIds saem do mesmo
  // pokemonMove.findMany — o `where.learnMethod` distingue as chamadas.
  prismaMock.pokemonMove.findMany.mockImplementation(
    async ({ where }: { where: { pokemonId: string; learnMethod?: string } }) => {
      if (where.learnMethod === "egg") {
        // Só a espécie B aprende algo por ovo, e é justo o que A sabe.
        return where.pokemonId === "sp-b" ? [{ moveId: "mv-wish" }] : [];
      }
      return where.pokemonId === "sp-a" ? [{ moveId: "mv-wish" }] : [{ moveId: "mv-tackle" }];
    },
  );
  prismaMock.userPokemonMove.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.packState.updateMany.mockResolvedValue({ count: 1 }); // ainda não cruzou hoje
  tx.userPokemon.create.mockResolvedValue({ id: "up-filhote" });
  tx.userPokemonMove.create.mockResolvedValue({ id: "grant-1" });
});

describe("breedPokemon", () => {
  it("cria o filhote da espécie certa e já concede o egg move", async () => {
    const result = await breedPokemon("alpha", input, NOW);

    expect(result).toEqual({
      ok: true,
      userPokemonId: "up-filhote",
      pokemonId: "sp-b",
      moveId: "mv-wish",
    });
    expect(tx.userPokemonMove.create).toHaveBeenCalledWith({
      data: { userPokemonId: "up-filhote", moveId: "mv-wish", source: "egg" },
    });
  });

  it("grava xp e level SEMPRE juntos, pelo helper (regra 3.1)", async () => {
    await breedPokemon("alpha", input, NOW);

    const data = tx.userPokemon.create.mock.calls[0][0].data;
    expect(data).toHaveProperty("level");
    expect(data).toHaveProperty("xp");
    // Gravar um sem o outro cria estado que ninguém repara depois — não há
    // worker pra consertar.
    expect(data.xp).toBeGreaterThan(0);
  });

  it("quem PERDE o claim do dia não cria nada", async () => {
    tx.packState.updateMany.mockResolvedValue({ count: 0 }); // já cruzou hoje

    const result = await breedPokemon("alpha", input, NOW);

    expect(result).toEqual({ ok: false, error: "already_bred_today" });
    expect(tx.userPokemon.create).not.toHaveBeenCalled();
    expect(tx.userPokemonMove.create).not.toHaveBeenCalled();
  });

  it("o claim é a PRIMEIRA operação da transação", async () => {
    const ordem: string[] = [];
    tx.packState.updateMany.mockImplementation(async () => {
      ordem.push("claim");
      return { count: 1 };
    });
    tx.userPokemon.create.mockImplementation(async () => {
      ordem.push("create");
      return { id: "up-filhote" };
    });

    await breedPokemon("alpha", input, NOW);

    expect(ordem[0]).toBe("claim");
  });

  it("recusa a mesma carta como os dois pais sem tocar no banco", async () => {
    const result = await breedPokemon("alpha", { parentAId: "up-a", parentBId: "up-a" }, NOW);

    expect(result).toEqual({ ok: false, error: "same_card" });
    expect(prismaMock.userPokemon.findMany).not.toHaveBeenCalled();
  });

  it("carta de outro dono derruba tudo com not_found, sem virar oráculo", async () => {
    // O `userId` vai no PRÓPRIO where; a contagem não bate.
    prismaMock.userPokemon.findMany.mockResolvedValue([{ id: "up-a", pokemonId: "sp-a", level: 20 }]);

    const result = await breedPokemon("alpha", input, NOW);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("sem egg move em comum não gasta o dia", async () => {
    prismaMock.pokemonMove.findMany.mockImplementation(
      async ({ where }: { where: { pokemonId: string; learnMethod?: string } }) => {
        if (where.learnMethod === "egg") return [{ moveId: "mv-outro" }];
        return [{ moveId: "mv-tackle" }];
      },
    );

    const result = await breedPokemon("alpha", input, NOW);

    expect(result).toEqual({ ok: false, error: "no_egg_move" });
    // Importa: o claim NÃO pode rodar antes de saber que há cruzamento, senão
    // uma tentativa incompatível queimaria a tentativa do dia.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
