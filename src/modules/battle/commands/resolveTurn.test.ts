import { beforeEach, describe, expect, it, vi } from "vitest";

// tryResolveTurn é a ponte entre o motor puro e o banco. O engine já tem teste
// (domain/engine.test.ts); o que falta cobrir é o que só quebra em produção:
// a atomicidade do turno sob concorrência. Os dois jogadores fazem polling a
// cada 2s, então DUAS lambdas chegam aqui ao mesmo tempo o tempo todo.

const tx = {
  battle: { updateMany: vi.fn(), update: vi.fn() },
  battlePokemon: { updateMany: vi.fn() },
  battleParticipant: { update: vi.fn() },
  battleTurnLog: { create: vi.fn() },
  battlePendingMove: { deleteMany: vi.fn() },
};

const prismaMock = {
  battle: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

// buildTypeChart bate na PokéAPI num cache miss — fora do teste.
vi.mock("./buildTeamSnapshot", () => ({
  buildTypeChart: vi.fn(async () => ({})),
}));

const { tryResolveTurn, TURN_TIMEOUT_MS } = await import("./resolveTurn");

function pokemonRow(slot: number, currentHp = 100) {
  return {
    slot,
    pokemonId: 25,
    name: "pikachu",
    types: ["electric"],
    level: 50,
    stats: { hp: 100, attack: 80, defense: 60, specialAttack: 90, specialDefense: 70, speed: 120 },
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

// Uma partida no turno 3 com os DOIS lados já tendo jogado => pronta pra resolver.
function battleReadyToResolve() {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    currentTurn: 3,
    turnStartedAt: new Date(),
    winnerId: null,
    participants: [
      { id: "pa", userId: "alpha", activeSlot: 1, missedTurns: 0, pokemons: [pokemonRow(1)] },
      { id: "pb", userId: "zeta", activeSlot: 1, missedTurns: 0, pokemons: [pokemonRow(1)] },
    ],
    pendingMoves: [
      { userId: "alpha", turnNumber: 3, actionType: "MOVE", moveSlot: 0, switchToSlot: null },
      { userId: "zeta", turnNumber: 3, actionType: "MOVE", moveSlot: 0, switchToSlot: null },
    ],
    turnLogs: [],
  };
}

function writeCallCount() {
  return (
    tx.battlePokemon.updateMany.mock.calls.length +
    tx.battleParticipant.update.mock.calls.length +
    tx.battleTurnLog.create.mock.calls.length +
    tx.battlePendingMove.deleteMany.mock.calls.length +
    tx.battle.update.mock.calls.length
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Roda o callback da transação de verdade, com o tx mockado.
  prismaMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
  prismaMock.battle.findUnique.mockResolvedValue(battleReadyToResolve());
  tx.battlePokemon.updateMany.mockResolvedValue({ count: 1 });
  tx.battleParticipant.update.mockResolvedValue({});
  tx.battleTurnLog.create.mockResolvedValue({});
  tx.battlePendingMove.deleteMany.mockResolvedValue({ count: 2 });
  tx.battle.update.mockResolvedValue({});
});

describe("tryResolveTurn — atomicidade do turno", () => {
  it("perdeu a corrida do claim => NÃO escreve nada", async () => {
    // A outra lambda avançou o turno primeiro: o updateMany condicional não
    // casa mais com currentTurn: 3.
    tx.battle.updateMany.mockResolvedValue({ count: 0 });

    await tryResolveTurn("b1");

    expect(tx.battle.updateMany).toHaveBeenCalledTimes(1);
    // O bug: se qualquer escrita escapar do claim, o turno resolve DUAS vezes
    // (dano aplicado em dobro, log duplicado).
    expect(writeCallCount()).toBe(0);
  });

  it("ganhou o claim => aplica dano, grava o log e limpa as jogadas do turno", async () => {
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    expect(tx.battleTurnLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ battleId: "b1", turnNumber: 3 }) })
    );
    expect(tx.battlePendingMove.deleteMany).toHaveBeenCalledWith({
      where: { battleId: "b1", turnNumber: 3 },
    });
    expect(tx.battlePokemon.updateMany).toHaveBeenCalled();
  });

  it("o claim é a PRIMEIRA escrita da transação", async () => {
    // Se algo for escrito antes do claim, a trava otimista não protege nada.
    const order: string[] = [];
    tx.battle.updateMany.mockImplementation(async () => {
      order.push("claim");
      return { count: 1 };
    });
    tx.battlePokemon.updateMany.mockImplementation(async () => {
      order.push("write");
      return { count: 1 };
    });
    tx.battleTurnLog.create.mockImplementation(async () => {
      order.push("write");
      return {};
    });

    await tryResolveTurn("b1");

    expect(order[0]).toBe("claim");
  });

  it("turno em aberto (só um lado jogou, sem timeout) => nem abre transação", async () => {
    const battle = battleReadyToResolve();
    battle.pendingMoves = [battle.pendingMoves[0]]; // só "alpha" jogou
    prismaMock.battle.findUnique.mockResolvedValue(battle);

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("timeout estourado com um lado sem jogar => resolve mesmo assim", async () => {
    const battle = battleReadyToResolve();
    battle.pendingMoves = [battle.pendingMoves[0]];
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS - 1000);
    prismaMock.battle.findUnique.mockResolvedValue(battle);
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    expect(prismaMock.$transaction).toHaveBeenCalled();
    // Quem não jogou leva +1 missedTurn; quem jogou volta pra 0.
    expect(tx.battleParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pb" }, data: expect.objectContaining({ missedTurns: 1 }) })
    );
    expect(tx.battleParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pa" }, data: expect.objectContaining({ missedTurns: 0 }) })
    );
  });

  it("3º timeout seguido => ABANDONED na MESMA transação do turno", async () => {
    const battle = battleReadyToResolve();
    battle.pendingMoves = [battle.pendingMoves[0]]; // "zeta" (pb) não jogou
    battle.participants[1].missedTurns = 2; // já tinha perdido 2
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS - 1000);
    prismaMock.battle.findUnique.mockResolvedValue(battle);
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    // Antes o fim da partida era uma escrita SOLTA, depois da transação: dava
    // pra existir um estado com o turno aplicado e a partida ainda IN_PROGRESS.
    expect(tx.battle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABANDONED", winnerId: "alpha" }),
      })
    );
  });
});
