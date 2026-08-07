import { beforeEach, describe, expect, it, vi } from "vitest";

// getUnlockedMoveIds junta as duas fontes de carta jogável: level-up destravado
// pelo nível + concedidas por fora (UserPokemonMove). É a query que addToDeck e
// a poda de evolução usam — o teste trava que as concedidas ENTRAM.

const prismaMock = {
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { getUnlockedMoveIds } = await import("@/src/modules/pokedex/queries/getUnlockedMoveIds");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUnlockedMoveIds", () => {
  it("une level-up destravado com as concedidas", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([{ moveId: "lvl-a" }, { moveId: "lvl-b" }]);
    prismaMock.userPokemonMove.findMany.mockResolvedValue([{ moveId: "tm-c" }]);

    const set = await getUnlockedMoveIds({ userPokemonId: "up-1", pokemonId: "sp-1", level: 20 });

    expect(set).toEqual(new Set(["lvl-a", "lvl-b", "tm-c"]));
  });

  it("filtra o level-up pelo NÍVEL (só o que já destravou) e escopa a concessão ao pokémon", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([]);
    prismaMock.userPokemonMove.findMany.mockResolvedValue([]);

    await getUnlockedMoveIds({ userPokemonId: "up-1", pokemonId: "sp-1", level: 12 });

    expect(prismaMock.pokemonMove.findMany).toHaveBeenCalledWith({
      where: { pokemonId: "sp-1", learnMethod: "level-up", levelLearnedAt: { lte: 12 } },
      select: { moveId: true },
    });
    expect(prismaMock.userPokemonMove.findMany).toHaveBeenCalledWith({
      where: { userPokemonId: "up-1" },
      select: { moveId: true },
    });
  });

  it("uma carta só concedida (sem level-up nenhum) entra", async () => {
    prismaMock.pokemonMove.findMany.mockResolvedValue([]);
    prismaMock.userPokemonMove.findMany.mockResolvedValue([{ moveId: "tm-only" }]);

    const set = await getUnlockedMoveIds({ userPokemonId: "up-1", pokemonId: "sp-1", level: 1 });

    expect(set.has("tm-only")).toBe(true);
  });
});
