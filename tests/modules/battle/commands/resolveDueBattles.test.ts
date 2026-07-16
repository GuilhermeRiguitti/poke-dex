import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveDueBattles é o motor de servidor (o pg_cron chama a rota que chama
// isto). O que precisa ser provado aqui não é a resolução do turno em si — isso
// é do resolveTurn.test.ts — é o comportamento da VARREDURA:
//  - só toca partidas IN_PROGRESS com o turno vencido;
//  - uma partida que explode NÃO derruba as outras (isolamento por try/catch);
//  - o resumo conta certo o que terminou e o que falhou.

const prismaMock = {
  battle: { findMany: vi.fn() },
};
vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

// loadBattleForResolve/resolveIfDue moram no resolveTurn.ts; mockamos só elas e
// mantemos TURN_TIMEOUT_MS real (a varredura calcula o threshold com ele).
const loadBattleForResolve = vi.fn();
const resolveIfDue = vi.fn();
vi.mock("@/src/modules/battle/commands/resolveTurn", async (orig) => {
  const actual = await orig<typeof import("@/src/modules/battle/commands/resolveTurn")>();
  return { ...actual, loadBattleForResolve, resolveIfDue };
});

const { resolveDueBattles } = await import("@/src/modules/battle/commands/resolveDueBattles");
const { TURN_TIMEOUT_MS } = await import("@/src/modules/battle/commands/resolveTurn");

function battleRow(id: string) {
  return { id, status: "IN_PROGRESS" as const };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadBattleForResolve.mockImplementation(async (id: string) => battleRow(id));
  resolveIfDue.mockImplementation(async (b: { id: string }) => ({ ...b, status: "IN_PROGRESS" }));
});

describe("resolveDueBattles — seleção", () => {
  it("varre só IN_PROGRESS com turno vencido (turnStartedAt < agora - TURN_TIMEOUT_MS)", async () => {
    const now = 1_000_000_000_000;
    prismaMock.battle.findMany.mockResolvedValue([]);

    await resolveDueBattles(now);

    const arg = prismaMock.battle.findMany.mock.calls[0][0];
    expect(arg.where.status).toBe("IN_PROGRESS");
    // O threshold é exatamente uma janela de timeout atrás do "agora" recebido.
    expect(arg.where.turnStartedAt.lt).toEqual(new Date(now - TURN_TIMEOUT_MS));
    // Mais antigas primeiro e com teto, senão uma varredura gigante estoura a lambda.
    expect(arg.orderBy).toEqual({ turnStartedAt: "asc" });
    expect(arg.take).toBeGreaterThan(0);
  });
});

describe("resolveDueBattles — isolamento de falhas", () => {
  it("uma partida que explode NÃO impede as outras de resolver", async () => {
    prismaMock.battle.findMany.mockResolvedValue([battleRow("a"), battleRow("b"), battleRow("c")]);
    // A "b" estoura no meio da varredura.
    resolveIfDue.mockImplementation(async (batt: { id: string }) => {
      if (batt.id === "b") throw new Error("cascade no meio da resolução");
      return { ...batt, status: "IN_PROGRESS" };
    });

    const summary = await resolveDueBattles();

    // Todas as três foram tentadas — o throw da "b" não abortou a varredura.
    expect(resolveIfDue).toHaveBeenCalledTimes(3);
    expect(summary.scanned).toBe(3);
    expect(summary.errors).toBe(1);
  });

  it("conta em `finished` só as partidas que saíram de IN_PROGRESS", async () => {
    prismaMock.battle.findMany.mockResolvedValue([battleRow("a"), battleRow("b")]);
    resolveIfDue.mockImplementation(async (batt: { id: string }) => ({
      ...batt,
      status: batt.id === "a" ? "ABANDONED" : "IN_PROGRESS",
    }));

    const summary = await resolveDueBattles();

    expect(summary).toEqual({ scanned: 2, finished: 1, errors: 0 });
  });

  it("partida que sumiu entre o SELECT e o load (null) é pulada sem erro", async () => {
    prismaMock.battle.findMany.mockResolvedValue([battleRow("a"), battleRow("b")]);
    loadBattleForResolve.mockImplementation(async (id: string) => (id === "a" ? null : battleRow(id)));

    const summary = await resolveDueBattles();

    // "a" virou null → nem chega em resolveIfDue; "b" resolve normal.
    expect(resolveIfDue).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({ scanned: 2, finished: 0, errors: 0 });
  });
});
