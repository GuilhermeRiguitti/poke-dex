import { beforeEach, describe, expect, it, vi } from "vitest";

// checkRateLimit é o freio das rotas de escrita. O que só quebra em produção:
// a janela que não reabre (jogador travado pra sempre), o teto que não trava
// (freio decorativo) e a corrida entre duas lambdas na virada da janela.

const prismaMock = {
  rateLimit: { upsert: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { checkRateLimit } = await import("@/src/lib/rateLimit");

const NOW = new Date("2026-08-14T12:00:00.000Z");
const WINDOW = 60_000;
const LIMIT = 5;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.rateLimit.updateMany.mockResolvedValue({ count: 1 });
});

describe("checkRateLimit", () => {
  it("passa enquanto o contador está dentro do teto", async () => {
    prismaMock.rateLimit.upsert.mockResolvedValue({
      count: LIMIT, // este pedido é o de número 5
      lastRequest: BigInt(NOW.getTime() - 10_000),
    });

    const result = await checkRateLimit("app:teste:u1", LIMIT, WINDOW, NOW);

    expect(result.ok).toBe(true);
    expect(prismaMock.rateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "app:teste:u1" } }),
    );
  });

  it("recusa o pedido que passa do teto e diz quanto falta pra janela virar", async () => {
    prismaMock.rateLimit.upsert.mockResolvedValue({
      count: LIMIT + 1, // o 6º dentro da janela
      lastRequest: BigInt(NOW.getTime() - 20_000),
    });

    const result = await checkRateLimit("app:teste:u1", LIMIT, WINDOW, NOW);

    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBe(40); // 60s de janela - 20s já passados
  });

  it("reabre a janela vencida em vez de deixar o jogador travado pra sempre", async () => {
    prismaMock.rateLimit.upsert.mockResolvedValue({
      count: 999, // estourado na janela ANTIGA
      lastRequest: BigInt(NOW.getTime() - WINDOW - 1),
    });

    const result = await checkRateLimit("app:teste:u1", LIMIT, WINDOW, NOW);

    expect(result.ok).toBe(true);
    // O `where` repete o lastRequest lido: é o claim que impede duas lambdas de
    // reabrirem a mesma janela e uma apagar a contagem da outra.
    expect(prismaMock.rateLimit.updateMany).toHaveBeenCalledWith({
      where: { key: "app:teste:u1", lastRequest: BigInt(NOW.getTime() - WINDOW - 1) },
      data: { count: 1, lastRequest: BigInt(NOW.getTime()) },
    });
  });

  it("quem PERDE a corrida de reabrir a janela não escreve por cima", async () => {
    prismaMock.rateLimit.upsert.mockResolvedValue({
      count: 999,
      lastRequest: BigInt(NOW.getTime() - WINDOW - 1),
    });
    prismaMock.rateLimit.updateMany.mockResolvedValue({ count: 0 }); // outra lambda reabriu antes

    const result = await checkRateLimit("app:teste:u1", LIMIT, WINDOW, NOW);

    // Passa (entra na janela que o vencedor abriu) e não tenta uma segunda
    // escrita pra "corrigir" — insistir aqui é que zeraria a contagem do outro.
    expect(result.ok).toBe(true);
    expect(prismaMock.rateLimit.updateMany).toHaveBeenCalledTimes(1);
  });

  it("é fail-OPEN: banco fora do ar não pode derrubar o jogo inteiro", async () => {
    prismaMock.rateLimit.upsert.mockRejectedValue(new Error("connection refused"));

    const result = await checkRateLimit("app:teste:u1", LIMIT, WINDOW, NOW);

    expect(result.ok).toBe(true);
  });

  it("a borda exata da janela já conta como vencida", async () => {
    prismaMock.rateLimit.upsert.mockResolvedValue({
      count: 999,
      lastRequest: BigInt(NOW.getTime() - WINDOW), // exatamente 60s
    });

    const result = await checkRateLimit("app:teste:u1", LIMIT, WINDOW, NOW);

    expect(result.ok).toBe(true);
    expect(prismaMock.rateLimit.updateMany).toHaveBeenCalled();
  });
});
