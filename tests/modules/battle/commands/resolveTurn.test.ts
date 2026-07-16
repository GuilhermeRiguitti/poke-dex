import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveIfDue é a ponte entre o motor PURO do duelo (duelEngine) e o banco. O
// engine já tem teste (domain/duelEngine.test.ts); o que só quebra em produção é
// a atomicidade do turno sob concorrência: os dois jogadores fazem polling a
// cada 2s, então DUAS lambdas chegam aqui ao mesmo tempo o tempo todo.
//
// Diferença pro modelo antigo: o claim guarda por (activeUserId, round, status)
// e o fim de jogo é FOLDED na própria data do claim (updateMany), não numa
// escrita separada.

const tx = {
  battle: { updateMany: vi.fn() },
  battlePokemon: { updateMany: vi.fn() },
  battleParticipant: { update: vi.fn() },
  battleTurnLog: { create: vi.fn() },
  battleAction: { deleteMany: vi.fn() },
};

const prismaMock = {
  battle: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));
// buildTypeChart bate na PokéAPI num cache miss — fora do teste.
vi.mock("@/src/modules/battle/commands/buildDuelSnapshot", () => ({
  buildTypeChart: vi.fn(async () => ({})),
}));

const { tryResolveTurn, TURN_TIMEOUT_MS, MAX_MISSES, expiredTurnWindows } = await import(
  "@/src/modules/battle/commands/resolveTurn"
);

function pokemonRow(currentHp = 100) {
  return {
    slot: 1,
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

// Round 3, é a vez de "alpha" (order = [alpha, zeta] por desempate de userId,
// Speed empatado), e ele JÁ escolheu a carta => pronta pra resolver.
function battleReadyToResolve(oppHp = 100) {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    round: 3,
    activeUserId: "alpha",
    turnStartedAt: new Date(),
    winnerId: null,
    participants: [
      { id: "pa", userId: "alpha", activeSlot: 1, missedTurns: 0, pokemons: [pokemonRow()] },
      { id: "pb", userId: "zeta", activeSlot: 1, missedTurns: 0, pokemons: [pokemonRow(oppHp)] },
    ],
    actions: [{ battleId: "b1", userId: "alpha", round: 3, cardSlot: 0 }],
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
  prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
  prismaMock.battle.findUnique.mockResolvedValue(battleReadyToResolve());
  tx.battle.updateMany.mockResolvedValue({ count: 1 });
  tx.battlePokemon.updateMany.mockResolvedValue({ count: 1 });
  tx.battleParticipant.update.mockResolvedValue({});
  tx.battleTurnLog.create.mockResolvedValue({});
  tx.battleAction.deleteMany.mockResolvedValue({ count: 1 });
});

describe("tryResolveTurn — atomicidade do turno", () => {
  it("perdeu a corrida do claim => NÃO escreve nada", async () => {
    tx.battle.updateMany.mockResolvedValue({ count: 0 });

    await tryResolveTurn("b1");

    expect(tx.battle.updateMany).toHaveBeenCalledTimes(1);
    expect(writeCallCount()).toBe(0);
  });

  it("ganhou o claim => aplica, grava o log e apaga a carta do round", async () => {
    await tryResolveTurn("b1");

    // turnNumber é o contador monotônico por ação: (round-1)*2 + actedThisRound.
    expect(tx.battleTurnLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ battleId: "b1", turnNumber: 4 }) })
    );
    expect(tx.battleAction.deleteMany).toHaveBeenCalledWith({
      where: { battleId: "b1", round: 3, userId: "alpha" },
    });
    expect(tx.battlePokemon.updateMany).toHaveBeenCalled();
  });

  it("o claim guarda por (activeUserId, round, status) e é a PRIMEIRA escrita", async () => {
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
    expect(claimArg.where).toMatchObject({ id: "b1", status: "IN_PROGRESS", activeUserId: "alpha", round: 3 });
    // Não encerrou: a vez passa pro oponente (order[1]), round segue 3.
    expect(claimArg.data).toMatchObject({ activeUserId: "zeta", round: 3 });
  });

  it("ainda é a vez dele e dá tempo (sem carta, sem timeout) => nem abre transação", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [];
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("tryResolveTurn — timeout e abandono", () => {
  it("timeout sem carta => hesitação; só o ativo leva falta", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [];
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS - 1000);
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).toHaveBeenCalled();
    // alpha (ativo) hesitou → +1 falta. zeta (oponente) não muda → sem update.
    expect(tx.battleParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pa" }, data: expect.objectContaining({ missedTurns: 1 }) })
    );
    expect(tx.battleParticipant.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pb" } })
    );
  });

  it("3ª falta do ativo => ABANDONED na DATA do claim, vitória do oponente", async () => {
    const battle = battleReadyToResolve();
    battle.actions = [];
    battle.participants[0].missedTurns = 2; // alpha já tinha 2
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS - 1000);
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(tx.battle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABANDONED", winnerId: "zeta" }),
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
  });

  it("conta uma janela de timeout por período vencido, não uma só", () => {
    const now = Date.now();
    expect(expiredTurnWindows(new Date(now), now)).toBe(0);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS - 1), now)).toBe(1);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS * 3), now)).toBe(3);
    expect(expiredTurnWindows(new Date(now + 10_000), now)).toBe(0); // relógio torto
  });
});

describe("tryResolveTurn — fim por faint e PP", () => {
  it("carta derruba o oponente => FINISHED na data do claim, vitória do ativo", async () => {
    prismaMock.battle.findUnique.mockResolvedValue(battleReadyToResolve(1)); // zeta com 1 HP

    await tryResolveTurn("b1");

    expect(tx.battle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FINISHED", winnerId: "alpha" }),
      })
    );
  });

  it("grava a coluna `moves` do atacante de volta (senão o PP recarrega sozinho)", async () => {
    await tryResolveTurn("b1");

    // O ativo (alpha = pA, sideA) gastou 1 PP. Acha o write do participante "pa".
    const call = tx.battlePokemon.updateMany.mock.calls.find((c) => c[0].where.participantId === "pa");
    expect(call).toBeDefined();
    expect(call![0].data).toHaveProperty("moves");
    const moves = call![0].data.moves as { name: string; currentPp: number }[];
    expect(moves[0]).toMatchObject({ name: "thunderbolt", currentPp: 14 });
  });
});
