import { beforeEach, describe, expect, it, vi } from "vitest";

// Este arquivo protege as DUAS formas de o matchmaking travar sozinho.
//
// 1. A PARTIDA ZUMBI não pode prender o jogador. Sem worker (CLAUDE.md, regra
//    5), se os dois fecham a aba ninguém faz polling e nada resolve o turno — a
//    partida fica IN_PROGRESS. Como o enqueue devolve a partida em andamento em
//    vez de enfileirar, os DOIS ficavam sem conseguir batalhar de novo. Hoje o
//    pg_cron (30s) também encerra a zumbi, mas o request do jogador continua
//    encerrando na hora: ele não espera o tick, e o job não está em migration
//    nenhuma (ambiente novo sobe sem ele — DEPLOY.md).
//
// 2. Um DECK QUEBRADO não pode envenenar a fila. Se o snapshot do oponente
//    falha (loadout sem carta depois da poda da evolução) e ele volta pra fila,
//    ele derruba o pareamento do próximo jogador — e do próximo. Um jogador
//    trava o matchmaking de todo mundo, e não há faxina automática pra isso.

const prismaMock = {
  battleParticipant: { findFirst: vi.fn() },
  matchmakingQueueEntry: { findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  battle: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/src/modules/deck", () => ({
  DECK_LIMIT: 6,
  readDeckSlots: vi.fn(async () => [{ order: 0 }]),
}));
vi.mock("@/src/modules/battle/commands/buildDuelSnapshot", () => ({ buildDuelSnapshot: vi.fn(async () => []) }));
vi.mock("@/src/modules/battle/commands/resolveTurn", () => ({ tryResolveTurn: vi.fn() }));

const { enqueueBattle } = await import("@/src/modules/battle/commands/enqueueBattle");
const { tryResolveTurn } = await import("@/src/modules/battle/commands/resolveTurn");
const { buildDuelSnapshot } = await import("@/src/modules/battle/commands/buildDuelSnapshot");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.matchmakingQueueEntry.findFirst.mockResolvedValue(null); // fila vazia
  prismaMock.matchmakingQueueEntry.upsert.mockResolvedValue({});
  prismaMock.matchmakingQueueEntry.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.$transaction.mockImplementation(async (fn: (t: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  );
});

describe("enqueueBattle — partida em andamento", () => {
  it("partida VIVA => volta pra ela, não entra na fila", async () => {
    prismaMock.battleParticipant.findFirst.mockResolvedValue({ battleId: "b-viva" });
    vi.mocked(tryResolveTurn).mockResolvedValue({ status: "IN_PROGRESS" } as never);

    const result = await enqueueBattle("u1", "d1");

    expect(result).toEqual({ matched: true, battleId: "b-viva" });
    expect(prismaMock.matchmakingQueueEntry.upsert).not.toHaveBeenCalled();
  });

  it("partida ZUMBI => o próprio enqueue encerra e o jogador segue pro matchmaking", async () => {
    prismaMock.battleParticipant.findFirst.mockResolvedValue({ battleId: "b-zumbi" });
    // tryResolveTurn conta as janelas de timeout vencidas de forma retroativa:
    // a zumbi morre aqui, em ABANDONED.
    vi.mocked(tryResolveTurn).mockResolvedValue({ status: "ABANDONED" } as never);

    const result = await enqueueBattle("u1", "d1");

    // O bug: devolvia { matched: true, battleId: "b-zumbi" } pra sempre — o
    // jogador nunca mais conseguia entrar numa fila.
    expect(result).toEqual({ matched: false, queued: true });
    expect(prismaMock.matchmakingQueueEntry.upsert).toHaveBeenCalled();
  });

  it("partida sumiu do banco => não trava o jogador", async () => {
    prismaMock.battleParticipant.findFirst.mockResolvedValue({ battleId: "b-fantasma" });
    vi.mocked(tryResolveTurn).mockResolvedValue(null);

    const result = await enqueueBattle("u1", "d1");

    expect(result).toEqual({ matched: false, queued: true });
  });
});

describe("enqueueBattle — deck que não monta", () => {
  // Há alguém esperando na fila em todos os casos abaixo.
  beforeEach(() => {
    prismaMock.battleParticipant.findFirst.mockResolvedValue(null);
    prismaMock.matchmakingQueueEntry.findFirst.mockResolvedValue({
      id: "q-op",
      userId: "u2",
      deckId: "d2",
    });
    prismaMock.matchmakingQueueEntry.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("o deck quebrado é o MEU => o oponente volta pra fila e eu levo o erro", async () => {
    vi.mocked(buildDuelSnapshot).mockImplementation(async (userId: string) => {
      if (userId === "u1") throw new Error("Loadout do slot 0 sem cartas");
      return [];
    });

    const result = await enqueueBattle("u1", "d1");

    expect(result).toEqual({ error: "snapshot_failed" });
    expect(prismaMock.matchmakingQueueEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u2" } })
    );
  });

  it("o deck quebrado é o DELE => ele NÃO volta pra fila (senão envenena) e eu assumo o lugar", async () => {
    vi.mocked(buildDuelSnapshot).mockImplementation(async (userId: string) => {
      if (userId === "u2") throw new Error("Loadout do slot 0 sem cartas");
      return [];
    });

    const result = await enqueueBattle("u1", "d1");

    // O bug: o oponente voltava pra fila com o mesmo deck quebrado, e o próximo
    // jogador a procurar partida levava snapshot_failed também — em loop.
    expect(prismaMock.matchmakingQueueEntry.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u2" } })
    );
    expect(result).toEqual({ matched: false, queued: true });
    expect(prismaMock.matchmakingQueueEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });

  it("os DOIS decks quebrados => ninguém volta pra fila", async () => {
    vi.mocked(buildDuelSnapshot).mockRejectedValue(new Error("Loadout do slot 0 sem cartas"));

    const result = await enqueueBattle("u1", "d1");

    expect(result).toEqual({ error: "snapshot_failed" });
    expect(prismaMock.matchmakingQueueEntry.upsert).not.toHaveBeenCalled();
  });
});
