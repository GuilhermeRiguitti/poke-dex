import { beforeEach, describe, expect, it, vi } from "vitest";

// O que este teste protege: a PARTIDA ZUMBI não pode prender o jogador.
//
// Sem worker (CLAUDE.md, regra 5), se os dois jogadores fecham a aba ninguém
// faz polling e nada resolve o turno — a partida fica IN_PROGRESS pra sempre.
// Como o enqueue devolve a partida em andamento em vez de enfileirar, os DOIS
// ficavam sem conseguir batalhar de novo, e não há cron pra limpar (Hobby roda
// 1x por dia). O request do próprio jogador é a única coisa viva: é ele que
// precisa encerrar a zumbi.

const prismaMock = {
  battleParticipant: { findFirst: vi.fn() },
  matchmakingQueueEntry: { findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  battle: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/src/modules/deck", () => ({
  DECK_LIMIT: 6,
  readDeckRoster: vi.fn(async () => [{ pokemonId: 25 }]),
}));
vi.mock("./buildTeamSnapshot", () => ({ buildTeamSnapshot: vi.fn(async () => []) }));
vi.mock("./resolveTurn", () => ({ tryResolveTurn: vi.fn() }));

const { enqueueBattle } = await import("./enqueueBattle");
const { tryResolveTurn } = await import("./resolveTurn");

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
