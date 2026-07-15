import { beforeEach, describe, expect, it, vi } from "vitest";

// O que estes testes protegem:
//  1. CONCORRÊNCIA (CLAUDE.md, regra 6): quem PERDE o claim não escreve carta.
//     Dois cliques no "Abrir" / duas lambdas não podem dar dois pacotes.
//  2. Pré-check de cooldown barato: em cooldown, NADA de sortear/buscar PokéAPI.

const prismaMock = {
  packState: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  userCard: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
};

const fetchAndCachePokemonMock = vi.fn();

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/src/lib/pokeapiCache", () => ({
  fetchAndCachePokemon: (id: number) => fetchAndCachePokemonMock(id),
}));
// A DTO de card precisa do pokedex; nos testes o visual não importa.
vi.mock("@/src/modules/pokedex", () => ({
  toPokemonCardDTO: () => ({ id: 0, name: "x", artworkUrl: null, iconUrl: null, types: [] }),
}));

const { openPack } = await import("./openPack");

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  fetchAndCachePokemonMock.mockResolvedValue({
    id: 1,
    name: "x",
    sprites: { front_default: null, back_default: null, artwork: null },
    types: [],
  });
  prismaMock.userCard.findMany.mockResolvedValue([]);
  prismaMock.userCard.upsert.mockResolvedValue({});
  prismaMock.packState.findUniqueOrThrow.mockResolvedValue({ lastFreePackAt: new Date(), extraPacks: 0, loginStreak: 0 });
  prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  );
});

describe("openPack — cooldown", () => {
  it("em cooldown e sem extras => on_cooldown, SEM sortear nem bater na PokéAPI", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastFreePackAt: new Date(), // acabou de abrir
      extraPacks: 0,
    });

    const result = await openPack("u1");

    expect(result).toEqual({ ok: false, error: "on_cooldown" });
    expect(fetchAndCachePokemonMock).not.toHaveBeenCalled(); // não amplifica na API
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("openPack — concorrência (perde o claim)", () => {
  it("claim.count 0 => NÃO escreve carta nenhuma", async () => {
    // Elegível na leitura (nunca abriu)...
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    // ...mas outra lambda resolveu o claim primeiro: os dois updateMany falham.
    prismaMock.packState.updateMany.mockResolvedValue({ count: 0 });

    const result = await openPack("u1");

    expect(result).toEqual({ ok: false, error: "on_cooldown" });
    expect(prismaMock.userCard.upsert).not.toHaveBeenCalled(); // o buraco que o teste trava
  });
});

describe("openPack — caminho feliz", () => {
  it("ganha o claim diário => 6 cartas, todas isNew quando a coleção estava vazia", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 }); // ganhou o diário
    prismaMock.packState.findUniqueOrThrow.mockResolvedValue({ lastFreePackAt: new Date(), extraPacks: 0, loginStreak: 0 });

    const result = await openPack("u1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("free");
    expect(result.cards).toHaveLength(6);
    expect(result.cards.every((c) => c.isNew)).toBe(true);
    expect(prismaMock.userCard.upsert).toHaveBeenCalledTimes(6);
  });

  it("diário indisponível mas há extra => gasta o extra", async () => {
    // Abriu o diário há 1h (indisponível), mas tem 1 pacote-bônus.
    prismaMock.packState.upsert.mockResolvedValue({
      lastFreePackAt: new Date(Date.now() - DAY / 24),
      extraPacks: 1,
    });
    // 1º updateMany (diário) nem roda porque freeAvailable=false; o de extra sim.
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.packState.findUniqueOrThrow.mockResolvedValue({
      lastFreePackAt: new Date(Date.now() - DAY / 24),
      extraPacks: 0,
      loginStreak: 0,
    });

    const result = await openPack("u1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("extra");
    // só UM updateMany chamado (o do extra) — o do diário foi pulado
    expect(prismaMock.packState.updateMany).toHaveBeenCalledTimes(1);
  });

  it("carta repetida => isNew false para a que o jogador já tinha", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.packState.findUniqueOrThrow.mockResolvedValue({ lastFreePackAt: new Date(), extraPacks: 0, loginStreak: 0 });

    const result = await openPack("u1", seededRng([0])); // rng previsível
    if (!result.ok) return;
    const drawn = result.cards.map((c) => c.pokemonId);

    // Refaz dizendo que o jogador JÁ tinha a primeira carta sorteada.
    vi.clearAllMocks();
    beforeEachReset();
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.packState.findUniqueOrThrow.mockResolvedValue({ lastFreePackAt: new Date(), extraPacks: 0, loginStreak: 0 });
    prismaMock.userCard.findMany.mockResolvedValue([{ pokemonId: drawn[0] }]);

    const again = await openPack("u1", seededRng([0]));
    if (!again.ok) return;
    const repeated = again.cards.find((c) => c.pokemonId === drawn[0]);
    expect(repeated?.isNew).toBe(false);
  });
});

// rng determinístico: devolve os valores da lista em ciclo (só pra fixar sorteio).
function seededRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

function beforeEachReset() {
  fetchAndCachePokemonMock.mockResolvedValue({
    id: 1,
    name: "x",
    sprites: { front_default: null, back_default: null, artwork: null },
    types: [],
  });
  prismaMock.userCard.upsert.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  );
}
