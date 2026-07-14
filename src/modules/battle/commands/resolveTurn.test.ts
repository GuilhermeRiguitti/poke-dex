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

const { tryResolveTurn, TURN_TIMEOUT_MS, MAX_MISSES, expiredTurnWindows } = await import(
  "./resolveTurn"
);

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

// Sem worker, o turno só anda quando alguém faz request (CLAUDE.md, regra 5).
// Então "o tempo estourou" e "alguém apareceu pra notar" são coisas diferentes,
// e é daí que saíam dois furos: a partida zumbi (os dois fecharam a aba, nada
// encerra) e o abandono que não era retroativo (o claim reseta turnStartedAt,
// então cada volta ao jogo só valia 1 falta, custando 3×90s de espera).
describe("tryResolveTurn — abandono é retroativo", () => {
  it("conta uma janela de timeout por período vencido, não uma só", () => {
    const now = Date.now();
    expect(expiredTurnWindows(new Date(now), now)).toBe(0);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS - 1), now)).toBe(1);
    expect(expiredTurnWindows(new Date(now - TURN_TIMEOUT_MS * 3), now)).toBe(3);
    // relógio torto / turno criado "no futuro" não vira falta negativa
    expect(expiredTurnWindows(new Date(now + 10_000), now)).toBe(0);
  });

  it("oponente sumido há muito tempo => encerra no PRIMEIRO request, não em 3", async () => {
    const battle = battleReadyToResolve();
    battle.pendingMoves = [battle.pendingMoves[0]]; // só "alpha" jogou
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS * MAX_MISSES);
    prismaMock.battle.findUnique.mockResolvedValue(battle);
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    // Antes: +1 falta por resolução => quem voltasse esperava 3×90s olhando a
    // tela pra ganhar de alguém que sumiu há uma hora.
    expect(tx.battle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABANDONED", winnerId: "alpha" }),
      })
    );
  });

  it("partida zumbi (os DOIS sumiram) => ABANDONED sem vencedor", async () => {
    const battle = battleReadyToResolve();
    battle.pendingMoves = []; // ninguém jogou
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS * 40); // ~1h
    prismaMock.battle.findUnique.mockResolvedValue(battle);
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    // Dar a vitória pro lado B só porque é o segundo do sort premiaria quem
    // também abandonou.
    expect(tx.battle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ABANDONED", winnerId: null }),
      })
    );
  });
});

describe("tryResolveTurn — enrolar não zera a falta", () => {
  it("quem joga DECAI 1 falta, não volta pra zero", async () => {
    // O furo: como a falta era zerada a cada jogada, bastava mandar uma jogada a
    // cada 3 turnos pra nunca cair em ABANDONED e arrastar a partida a 90s por
    // turno pra sempre. Aqui "zeta" já tem 2 faltas e joga: cai pra 1, não 0.
    const battle = battleReadyToResolve();
    battle.participants[1].missedTurns = 2;
    prismaMock.battle.findUnique.mockResolvedValue(battle);
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    expect(tx.battleParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pb" },
        data: expect.objectContaining({ missedTurns: 1 }),
      })
    );
  });

  it("miss, miss, joga, miss => acumula até ABANDONED (o grief não sustenta)", async () => {
    // Estado depois de: falta, falta (=2), jogada (=1). Agora falta de novo.
    const battle = battleReadyToResolve();
    battle.pendingMoves = [battle.pendingMoves[0]]; // "zeta" não jogou
    battle.participants[1].missedTurns = 1;
    battle.turnStartedAt = new Date(Date.now() - TURN_TIMEOUT_MS - 1000);
    prismaMock.battle.findUnique.mockResolvedValue(battle);
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    expect(tx.battleParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pb" },
        data: expect.objectContaining({ missedTurns: 2 }),
      })
    );
  });
});

describe("tryResolveTurn — persistência do PP", () => {
  it("grava a coluna `moves` de volta, senão o PP recarrega sozinho todo turno", async () => {
    tx.battle.updateMany.mockResolvedValue({ count: 1 });

    await tryResolveTurn("b1");

    // O engine gasta o PP no estado em memória. Se este write não incluísse
    // `moves`, o gasto morria aqui e o jogador repetiria o golpe mais forte
    // pra sempre — que era o bug.
    const [call] = tx.battlePokemon.updateMany.mock.calls;
    expect(call[0].data).toHaveProperty("moves");

    const moves = call[0].data.moves as { name: string; currentPp: number }[];
    expect(moves[0]).toMatchObject({ name: "thunderbolt", currentPp: 14 });
  });
});
