import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveIfDue é a ponte entre o motor PURO do duelo (duelEngine) e o banco. O
// engine já tem teste (domain/duelEngine.test.ts); o que só quebra em produção é
// a atomicidade do turno sob concorrência: os dois jogadores fazem polling a
// cada 2s, então DUAS lambdas chegam aqui ao mesmo tempo o tempo todo.
//
// No SIMULTÂNEO isso fica mais disputado, não menos: além do polling, o request
// de quem submete a 2ª carta também tenta resolver. O claim guarda por (round,
// status) — quem perde não escreve NADA.

const tx = {
  battle: { updateMany: vi.fn() },
  battlePokemon: { updateMany: vi.fn() },
  battleParticipant: { update: vi.fn() },
  battleTurnLog: { create: vi.fn() },
  battleAction: { deleteMany: vi.fn() },
  userPokemon: { findMany: vi.fn(), update: vi.fn() },
};

const prismaMock = {
  battle: { findUnique: vi.fn() },
  pokemon: { findMany: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));
// buildTypeChart bate na PokéAPI num cache miss — fora do teste.
vi.mock("@/src/modules/battle/commands/buildDuelSnapshot", () => ({
  buildTypeChart: vi.fn(async () => ({})),
}));

const { tryResolveTurn, TURN_TIMEOUT_MS, expiredTurnWindows } = await import(
  "@/src/modules/battle/commands/resolveTurn"
);

function pokemonRow(currentHp = 100, userPokemonId = "up-1") {
  return {
    slot: 1,
    userPokemonId,
    pokemonId: 25,
    name: "pikachu",
    types: ["electric"],
    level: 20,
    stats: { hp: 100, attack: 120, defense: 40, specialAttack: 120, specialDefense: 40, speed: 100 },
    maxHp: 100,
    currentHp,
    fainted: currentHp <= 0,
    moves: [
      {
        id: 85,
        name: "thunderbolt",
        type: "electric",
        power: 90,
        accuracy: 100,
        damageClass: "special",
        priority: 0,
        maxPp: 15,
        currentPp: 15,
      },
    ],
  };
}

// Round 3, os DOIS já escolheram => pronta pra resolver. (No simultâneo é isso
// que destrava a resolução: as duas cartas na mesa.)
function battleReadyToResolve(oppHp = 100) {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    round: 3,
    turnStartedAt: new Date(),
    winnerId: null,
    participants: [
      { id: "pa", userId: "alpha", activeSlot: 1, missedTurns: 0, pokemons: [pokemonRow(100, "up-alpha")] },
      { id: "pb", userId: "zeta", activeSlot: 1, missedTurns: 0, pokemons: [pokemonRow(oppHp, "up-zeta")] },
    ],
    actions: [
      { battleId: "b1", userId: "alpha", round: 3, cardSlot: 0 },
      { battleId: "b1", userId: "zeta", round: 3, cardSlot: 0 },
    ],
    turnLogs: [],
  };
}

function writeCallCount() {
  return (
    tx.battlePokemon.updateMany.mock.calls.length +
    tx.battleParticipant.update.mock.calls.length +
    tx.battleTurnLog.create.mock.calls.length +
    tx.battleAction.deleteMany.mock.calls.length
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // resolveIfDue injeta Math.random no engine. Sem fixar, este arquivo fica
  // INSTÁVEL: com dois pikachus iguais, o desempate de Speed é sorteio e um
  // crítico (1/16) nocauteia antes do segundo agir — o teste do PP falhava uma
  // vez a cada ~16 rodadas. 0.5 = acerta, não critica, e o desempate é estável.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
  prismaMock.battle.findUnique.mockResolvedValue(battleReadyToResolve());
  prismaMock.pokemon.findMany.mockResolvedValue([{ pokemonApiId: 25, baseExperience: 112 }]);
  tx.battle.updateMany.mockResolvedValue({ count: 1 });
  tx.battlePokemon.updateMany.mockResolvedValue({ count: 1 });
  tx.battleParticipant.update.mockResolvedValue({});
  tx.battleTurnLog.create.mockResolvedValue({});
  tx.battleAction.deleteMany.mockResolvedValue({ count: 2 });
  tx.userPokemon.findMany.mockResolvedValue([
    { id: "up-alpha", xp: 8000 },
    { id: "up-zeta", xp: 8000 },
  ]);
  tx.userPokemon.update.mockResolvedValue({});
});

describe("tryResolveTurn — atomicidade do turno", () => {
  it("perdeu a corrida do claim => NÃO escreve nada", async () => {
    tx.battle.updateMany.mockResolvedValue({ count: 0 });

    await tryResolveTurn("b1");

    expect(tx.battle.updateMany).toHaveBeenCalledTimes(1);
    expect(writeCallCount()).toBe(0);
    expect(tx.userPokemon.update).not.toHaveBeenCalled();
  });

  it("ganhou o claim => aplica, grava o log do round e apaga AS DUAS cartas", async () => {
    await tryResolveTurn("b1");

    // Um log por RODADA no simultâneo (o alternado tinha dois por rodada).
    expect(tx.battleTurnLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ battleId: "b1", turnNumber: 3 }) })
    );
    // Sem `userId` no where: o round inteiro é consumido de uma vez.
    expect(tx.battleAction.deleteMany).toHaveBeenCalledWith({ where: { battleId: "b1", round: 3 } });
    expect(tx.battlePokemon.updateMany).toHaveBeenCalled();
  });

  it("o claim guarda por (round, status) e é a PRIMEIRA escrita", async () => {
    const order: string[] = [];
    tx.battle.updateMany.mockImplementation(async () => {
      order.push("claim");
      return { count: 1 };
    });
    tx.battlePokemon.updateMany.mockImplementation(async () => {
      order.push("write");
      return { count: 1 };
    });

    await tryResolveTurn("b1");

    expect(order[0]).toBe("claim");
    const claimArg = tx.battle.updateMany.mock.calls[0][0];
    expect(claimArg.where).toMatchObject({ id: "b1", status: "IN_PROGRESS", round: 3 });
    expect(claimArg.where).not.toHaveProperty("activeUserId"); // não existe mais
    expect(claimArg.data).toMatchObject({ round: 4 });
  });

  it("SÓ UM jogador escolheu e ainda dá tempo => nem abre transação (é a escolha às cegas)", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [{ battleId: "b1", userId: "alpha", round: 3, cardSlot: 0 }];
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("ignora carta de round velho (chegou atrasada) e segue esperando", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [
      { battleId: "b1", userId: "alpha", round: 2, cardSlot: 0 },
      { battleId: "b1", userId: "zeta", round: 2, cardSlot: 0 },
    ];
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("tryResolveTurn — timeout e abandono", () => {
  it("timeout com uma carta só => o ausente hesita e leva falta; quem jogou ABAIXA a dele", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [{ battleId: "b1", userId: "alpha", round: 3, cardSlot: 0 }];
    battle.participants[1].missedTurns = 2; // zeta já tinha 2 faltas
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS - 1000);
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).toHaveBeenCalled();
    // zeta não escolheu → 3ª falta → abandono (e vitória de alpha).
    expect(tx.battle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABANDONED", winnerId: "alpha" }),
      })
    );
  });

  it("partida zumbi (os DOIS sumiram há muito) => ABANDONED sem vencedor", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [];
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS * 40); // ~1h
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(tx.battle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABANDONED", winnerId: null }),
      })
    );
    // Sem vencedor não há XP a pagar.
    expect(tx.userPokemon.update).not.toHaveBeenCalled();
  });

  it("conta uma janela de timeout por período vencido, não uma só", () => {
    const now = Date.now();
    expect(expiredTurnWindows(new Date(now), now)).toBe(0);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS - 1), now)).toBe(1);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS * 3), now)).toBe(3);
    expect(expiredTurnWindows(new Date(now + 10_000), now)).toBe(0); // relógio torto
  });
});

describe("tryResolveTurn — fim por faint, PP e XP", () => {
  it("derrubou o oponente => FINISHED na data do claim, com vencedor", async () => {
    prismaMock.battle.findUnique.mockResolvedValue(battleReadyToResolve(1)); // zeta com 1 HP

    await tryResolveTurn("b1");

    const claim = tx.battle.updateMany.mock.calls[0][0];
    expect(claim.data).toMatchObject({ status: "FINISHED" });
    expect(claim.data.winnerId).toBeTruthy();
  });

  it("paga XP aos DOIS lados na mesma transação do claim (perdedor leva a fatia menor)", async () => {
    prismaMock.battle.findUnique.mockResolvedValue(battleReadyToResolve(1));

    await tryResolveTurn("b1");

    expect(tx.userPokemon.update).toHaveBeenCalledTimes(2);
    const gains = tx.userPokemon.update.mock.calls.map((c) => c[0].data.xp - 8000);
    // xpFromDefeat(112, 20) = 320 pro vencedor; 25% disso (80) pro perdedor.
    expect(gains.sort((a, b) => a - b)).toEqual([80, 320]);
  });

  it("grava a coluna `moves` de volta (senão o PP recarrega sozinho)", async () => {
    await tryResolveTurn("b1");

    const call = tx.battlePokemon.updateMany.mock.calls.find((c) => c[0].where.participantId === "pa");
    expect(call).toBeDefined();
    expect(call![0].data).toHaveProperty("moves");
    const moves = call![0].data.moves as { name: string; currentPp: number }[];
    expect(moves[0]).toMatchObject({ name: "thunderbolt", currentPp: 14 });
  });
});
