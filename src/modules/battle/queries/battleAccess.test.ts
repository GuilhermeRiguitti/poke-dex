import { beforeEach, describe, expect, it, vi } from "vitest";

// A ordem entre AUTORIZAR e ESCREVER, que é o bug que estes testes travam.
//
// getBattleState e getBattleStatus resolvem o turno, e resolver o turno ESCREVE
// no banco e — num cache miss da matriz de tipos — BATE NA POKÉAPI. Antes, as
// duas resolviam o turno primeiro e só depois checavam se quem pediu era
// participante: o 403 saía certo, mas a partida dos outros já tinha sido mexida,
// e a chamada de rede já tinha saído em nome dela.
//
// Um teste que só olhasse o valor de retorno passaria nas DUAS versões (o erro
// devolvido é o mesmo!). Por isso o que se afirma aqui é que resolveIfDue NÃO
// FOI CHAMADO.

const prismaMock = {
  battlePendingMove: { findMany: vi.fn() },
};

const loadBattleForResolve = vi.fn();
const resolveIfDue = vi.fn();

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../commands/resolveTurn", () => ({ loadBattleForResolve, resolveIfDue }));

const { getBattleState } = await import("./getBattleState");
const { getBattleStatus } = await import("./getBattleStatus");

const BATTLE = {
  id: "b1",
  status: "IN_PROGRESS",
  currentTurn: 3,
  winnerId: null,
  participants: [
    { id: "pa", userId: "alpha", activeSlot: 1, pokemons: [] },
    { id: "pb", userId: "zeta", activeSlot: 1, pokemons: [] },
  ],
  turnLogs: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.battlePendingMove.findMany.mockResolvedValue([]);
  loadBattleForResolve.mockResolvedValue(BATTLE);
  resolveIfDue.mockResolvedValue(BATTLE);
});

describe.each([
  ["getBattleState", getBattleState],
  ["getBattleStatus", getBattleStatus],
])("%s — autorização antes da escrita", (_name, subject) => {
  it("estranho na partida => 403 e NENHUMA resolução de turno disparada", async () => {
    const result = await subject("b1", "intruso");

    expect(result).toEqual({ error: "forbidden" });
    // O ponto do teste: nada de escrita, nada de PokéAPI, em nome de uma partida
    // que não é dele.
    expect(resolveIfDue).not.toHaveBeenCalled();
  });

  it("partida inexistente => 404 sem disparar resolução de turno", async () => {
    loadBattleForResolve.mockResolvedValue(null);

    const result = await subject("nao-existe", "alpha");

    expect(result).toEqual({ error: "not_found" });
    expect(resolveIfDue).not.toHaveBeenCalled();
  });

  it("participante de verdade => resolve o turno normalmente", async () => {
    const result = await subject("b1", "alpha");

    expect(resolveIfDue).toHaveBeenCalledWith(BATTLE);
    expect(result).not.toHaveProperty("error");
  });

  // O motivo da separação loadBattleForResolve/resolveIfDue: /status é polling de
  // 2s dos DOIS jogadores. A autorização tem que vir antes da escrita SEM cobrar
  // um SELECT a mais por poll — a mesma leitura serve pras duas coisas.
  it("lê a partida UMA vez só (autorização não custa query extra)", async () => {
    await subject("b1", "alpha");

    expect(loadBattleForResolve).toHaveBeenCalledTimes(1);
  });
});
