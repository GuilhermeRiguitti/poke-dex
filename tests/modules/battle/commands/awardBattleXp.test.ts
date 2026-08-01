import { beforeEach, describe, expect, it, vi } from "vitest";

// O bug que este arquivo tranca: a evolução era checada SÓ quando a batalha
// fazia subir de nível. Um pokémon que cruzou o gatilho numa hora em que a
// espécie-alvo ainda não estava no espelho ficava preso na forma antiga PRA
// SEMPRE — no nível 100 nunca mais ganha nível, então a checagem nunca voltava.
// Aqui não há worker pra reparar depois (CLAUDE.md §5), então a checagem tem
// que ser RETROATIVA: roda em toda aplicação de XP, igual ao timeout de turno.

const tx = {
  userPokemon: { findMany: vi.fn(), update: vi.fn() },
  pokemon: { findUnique: vi.fn() },
  deckSlot: { findMany: vi.fn() },
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
  deckSlotCard: { deleteMany: vi.fn(), createMany: vi.fn() },
};

vi.mock("@/src/lib/prisma", () => ({ prisma: { pokemon: { findMany: vi.fn() } } }));

const { awardBattleXp } = await import("@/src/modules/battle/commands/awardBattleXp");

// Charmander já no nível 20 (gatilho da evolução é 16) — ou seja, ele JÁ
// deveria ter evoluído. Ganha XP de migalha, que não sobe nível.
const CHARMANDER_LV20 = {
  id: "up-1",
  xp: 8000, // levelFromXp(8000) = 20
  pokemon: { evolvesToApiId: 5, evolvesToLevel: 16 },
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.userPokemon.findMany.mockResolvedValue([CHARMANDER_LV20]);
  tx.userPokemon.update.mockResolvedValue({});
  tx.pokemon.findUnique.mockResolvedValue({
    id: "species-charmeleon",
    evolvesToApiId: 6,
    evolvesToLevel: 36, // longe: a cadeia para aqui
  });
  tx.deckSlot.findMany.mockResolvedValue([]);
});

const contexto = (gainedXp: number) => ({
  winner: { userPokemonId: "up-1", gainedXp },
  loser: null,
});

describe("awardBattleXp — evolução retroativa", () => {
  it("evolui quem já passou do gatilho MESMO sem subir de nível nesta batalha", async () => {
    // 1 de XP: levelFromXp(8001) continua 20. gained === 0.
    await awardBattleXp(tx as never, contexto(1));

    expect(tx.pokemon.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pokemonApiId: 5 } })
    );
    expect(tx.userPokemon.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pokemonId: "species-charmeleon" } })
    );
  });

  it("não vai ao banco quando o nível ainda não bate o gatilho", async () => {
    tx.userPokemon.findMany.mockResolvedValue([
      { id: "up-1", xp: 1000, pokemon: { evolvesToApiId: 5, evolvesToLevel: 16 } }, // nível 10
    ]);

    await awardBattleXp(tx as never, contexto(1));

    // `evolutionTargetFor` é puro e corta antes: custo zero no caso saudável.
    expect(tx.pokemon.findUnique).not.toHaveBeenCalled();
  });

  it("não escreve evolução quando a espécie-alvo está fora do espelho", async () => {
    tx.pokemon.findUnique.mockResolvedValue(null);

    await awardBattleXp(tx as never, contexto(1));

    // O XP é gravado; a evolução, não. E nada lança.
    const updates = tx.userPokemon.update.mock.calls.map((c) => c[0].data);
    expect(updates.some((d: Record<string, unknown>) => "pokemonId" in d)).toBe(false);
  });
});
