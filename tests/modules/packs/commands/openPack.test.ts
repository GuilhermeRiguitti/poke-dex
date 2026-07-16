import { beforeEach, describe, expect, it, vi } from "vitest";

// O que estes testes protegem:
//  1. CONCORRÊNCIA (CLAUDE.md regra 6): quem PERDE o claim não cria UserPokemon.
//     Dois cliques no "Abrir" / duas lambdas não podem dar dois pacotes.
//  2. Pré-check de cooldown barato: em cooldown, NADA de ler pool nem sortear.
//  3. A coleção nova é UserPokemon (não mais UserCard), sorteada do ESPELHO.

const prismaMock = {
  packState: { upsert: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  pokemon: { findMany: vi.fn() },
  userPokemon: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { openPack } = await import("@/src/modules/packs/commands/openPack");

const DAY = 24 * 60 * 60 * 1000;

// Espelho fake: 8 espécies (apiId 1..8), id "sp-<apiId>". Pool suficiente pras 6 cartas.
function mirrorSpecies() {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `sp-${i + 1}`,
    pokemonApiId: i + 1,
    name: `mon-${i + 1}`,
    spriteUrl: null,
    types: ["normal"],
  }));
}

function resetDefaults() {
  prismaMock.pokemon.findMany.mockResolvedValue(mirrorSpecies());
  prismaMock.userPokemon.findMany.mockResolvedValue([]);
  prismaMock.userPokemon.upsert.mockResolvedValue({});
  prismaMock.packState.findUniqueOrThrow.mockResolvedValue({ lastFreePackAt: new Date(), extraPacks: 0, loginStreak: 0 });
  prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) => fn(prismaMock));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDefaults();
});

describe("openPack — cooldown", () => {
  it("em cooldown e sem extras => on_cooldown, SEM ler pool nem sortear", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: new Date(), extraPacks: 0 });

    const result = await openPack("u1");

    expect(result).toEqual({ ok: false, error: "on_cooldown" });
    expect(prismaMock.pokemon.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("openPack — concorrência (perde o claim)", () => {
  it("claim.count 0 => NÃO cria UserPokemon nenhum", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 0 }); // outra lambda ganhou

    const result = await openPack("u1");

    expect(result).toEqual({ ok: false, error: "on_cooldown" });
    expect(prismaMock.userPokemon.upsert).not.toHaveBeenCalled(); // o buraco que o teste trava
  });
});

describe("openPack — caminho feliz", () => {
  it("ganha o claim diário => 6 cartas, todas isNew quando a coleção estava vazia", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });

    const result = await openPack("u1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("free");
    expect(result.cards).toHaveLength(6);
    expect(result.cards.every((c) => c.isNew)).toBe(true);
    expect(prismaMock.userPokemon.upsert).toHaveBeenCalledTimes(6);
  });

  it("diário indisponível mas há extra => gasta o extra", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastFreePackAt: new Date(Date.now() - DAY / 24),
      extraPacks: 1,
    });
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
    expect(prismaMock.packState.updateMany).toHaveBeenCalledTimes(1); // só o do extra
  });

  it("carta repetida => isNew false para a espécie que o jogador já tinha", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });

    const first = await openPack("u1", seededRng([0]));
    if (!first.ok) return;
    const drawn = first.cards.map((c) => c.pokemonId); // apiIds

    vi.clearAllMocks();
    resetDefaults();
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });
    // O jogador JÁ tinha a espécie da primeira carta (id "sp-<apiId>").
    prismaMock.userPokemon.findMany.mockResolvedValue([{ pokemonId: `sp-${drawn[0]}` }]);

    const again = await openPack("u1", seededRng([0]));
    if (!again.ok) return;
    const repeated = again.cards.find((c) => c.pokemonId === drawn[0]);
    expect(repeated?.isNew).toBe(false);
  });

  it("espelho vazio => empty_pokedex (não dá pra sortear do nada)", async () => {
    prismaMock.packState.upsert.mockResolvedValue({ lastFreePackAt: null, extraPacks: 0 });
    prismaMock.pokemon.findMany.mockResolvedValue([]);

    const result = await openPack("u1");

    expect(result).toEqual({ ok: false, error: "empty_pokedex" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

// rng determinístico: devolve os valores da lista em ciclo (só pra fixar sorteio).
function seededRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}
