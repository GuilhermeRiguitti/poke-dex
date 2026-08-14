import { beforeEach, describe, expect, it, vi } from "vitest";

// O aceite transfere uma carta de um jogador pro outro. O que só quebra em
// produção é a concorrência: dois jogadores com o mesmo código chegando juntos
// não podem gerar duas transferências, e quem perde o claim não pode escrever
// NADA (CLAUDE.md regra 6).

const tx = {
  tradeOffer: { deleteMany: vi.fn() },
  userPokemon: { updateMany: vi.fn() },
  deckSlot: { deleteMany: vi.fn() },
  battlePokemon: { findFirst: vi.fn() },
  tradeLog: { create: vi.fn() },
};

const prismaMock = {
  tradeOffer: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { acceptTradeOffer } = await import("@/src/modules/trade/commands/acceptTradeOffer");

const NOW = new Date("2026-08-14T12:00:00.000Z");
const CODE = "A2B4C6D8";

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.tradeOffer.findUnique.mockResolvedValue({
    id: "offer-1",
    fromUserId: "doador",
    userPokemonId: "up-1",
    expiresAt: new Date(NOW.getTime() + 60_000),
  });
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.tradeOffer.deleteMany.mockResolvedValue({ count: 1 }); // ganhou o claim
  tx.userPokemon.updateMany.mockResolvedValue({ count: 1 }); // a carta ainda era do doador
  tx.deckSlot.deleteMany.mockResolvedValue({ count: 0 });
  tx.battlePokemon.findFirst.mockResolvedValue(null); // não está em partida
  tx.tradeLog.create.mockResolvedValue({ id: "log-1" });
});

describe("acceptTradeOffer", () => {
  it("transfere a carta, limpa o deck do doador e registra a proveniência", async () => {
    const result = await acceptTradeOffer("receptor", { code: CODE }, NOW);

    expect(result).toEqual({ ok: true, userPokemonId: "up-1" });
    expect(tx.userPokemon.updateMany).toHaveBeenCalledWith({
      // O dono ANTIGO vai no próprio where: é o 2º claim, não um findUnique
      // antes (que seria corrida).
      where: { id: "up-1", userId: "doador" },
      data: { userId: "receptor" },
    });
    expect(tx.deckSlot.deleteMany).toHaveBeenCalledWith({ where: { userPokemonId: "up-1" } });
    expect(tx.tradeLog.create).toHaveBeenCalled();
  });

  it("quem PERDE o claim da oferta não escreve nada", async () => {
    tx.tradeOffer.deleteMany.mockResolvedValue({ count: 0 }); // outro aceitou primeiro

    const result = await acceptTradeOffer("receptor", { code: CODE }, NOW);

    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(tx.userPokemon.updateMany).not.toHaveBeenCalled();
    expect(tx.deckSlot.deleteMany).not.toHaveBeenCalled();
    expect(tx.tradeLog.create).not.toHaveBeenCalled();
  });

  it("derruba tudo se a carta deixou de ser do doador entre a leitura e o claim", async () => {
    tx.userPokemon.updateMany.mockResolvedValue({ count: 0 });

    const result = await acceptTradeOffer("receptor", { code: CODE }, NOW);

    // A transação lança → rollback → a oferta apagada no passo 1 VOLTA.
    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(tx.tradeLog.create).not.toHaveBeenCalled();
  });

  it("derruba tudo se o doador entrou em partida com a carta no meio do caminho", async () => {
    tx.battlePokemon.findFirst.mockResolvedValue({ id: "bp-1" });

    const result = await acceptTradeOffer("receptor", { code: CODE }, NOW);

    // Senão o XP do fim daquela partida cairia no receptor, que não jogou.
    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(tx.tradeLog.create).not.toHaveBeenCalled();
  });

  it("recusa a própria oferta antes de qualquer escrita", async () => {
    const result = await acceptTradeOffer("doador", { code: CODE }, NOW);

    expect(result).toEqual({ ok: false, error: "own_offer" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("código de forma inválida nem chega a consultar o banco", async () => {
    const result = await acceptTradeOffer("receptor", { code: "nao-e-codigo" }, NOW);

    expect(result).toEqual({ ok: false, error: "invalid_code" });
    // Importa por latência: um código malformado e um inexistente têm que
    // responder igualmente rápido, senão o tempo de resposta vira oráculo.
    expect(prismaMock.tradeOffer.findUnique).not.toHaveBeenCalled();
  });

  it("oferta vencida responde igual a inexistente", async () => {
    prismaMock.tradeOffer.findUnique.mockResolvedValue({
      id: "offer-1",
      fromUserId: "doador",
      userPokemonId: "up-1",
      expiresAt: new Date(NOW.getTime() - 1),
    });

    const result = await acceptTradeOffer("receptor", { code: CODE }, NOW);

    // Distinguir "existe mas venceu" de "não existe" entregaria a um bote o
    // mapa do espaço de códigos.
    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("normaliza o que o jogador digitou antes de procurar", async () => {
    await acceptTradeOffer("receptor", { code: " a2b4-c6d8 " }, NOW);

    expect(prismaMock.tradeOffer.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: CODE } }),
    );
  });
});
