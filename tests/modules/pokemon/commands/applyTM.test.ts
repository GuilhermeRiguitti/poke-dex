import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// applyTM ensina um golpe de TM gastando 1 token. O que só quebra em produção é
// a concorrência (dois cliques no "Ensinar"): não pode gastar 2 tokens, nem
// conceder a mesma carta duas vezes, nem cobrar quando o pedido é inválido.

const tx = {
  packState: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  userPokemonMove: { create: vi.fn() },
};

const prismaMock = {
  userPokemon: { findUnique: vi.fn() },
  pokemonMove: { findUnique: vi.fn() },
  userPokemonMove: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { applyTM } = await import("@/src/modules/training/commands/applyTM");

const input = { userPokemonId: "up-1", moveId: "mv-tm" };

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.userPokemon.findUnique.mockResolvedValue({ id: "up-1", userId: "alpha", pokemonId: "species-1" });
  prismaMock.pokemonMove.findUnique.mockResolvedValue({ learnMethod: "machine" }); // é golpe de TM
  prismaMock.userPokemonMove.findUnique.mockResolvedValue(null); // ainda não concedido
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

  tx.packState.updateMany.mockResolvedValue({ count: 1 }); // tinha saldo → descontou
  tx.userPokemonMove.create.mockResolvedValue({ id: "grant-1" });
  tx.packState.findUniqueOrThrow.mockResolvedValue({ tmTokens: 2 });
});

describe("applyTM", () => {
  it("ensina, gasta 1 token e devolve o saldo novo", async () => {
    const result = await applyTM("alpha", input);

    expect(result).toEqual({ ok: true, moveId: "mv-tm", tmTokens: 2 });
    expect(tx.packState.updateMany).toHaveBeenCalledWith({
      where: { userId: "alpha", tmTokens: { gte: 1 } },
      data: { tmTokens: { decrement: 1 } },
    });
    expect(tx.userPokemonMove.create).toHaveBeenCalledOnce();
  });

  // O CASO QUE IMPORTA: sem saldo (ou perdeu a corrida). O claim volta count 0 —
  // não pode SOBRAR escrita (nada de conceder de graça).
  it("sem token, recusa e NÃO concede nada", async () => {
    tx.packState.updateMany.mockResolvedValue({ count: 0 });

    const result = await applyTM("alpha", input);

    expect(result).toEqual({ ok: false, error: "no_tokens" });
    expect(tx.userPokemonMove.create).not.toHaveBeenCalled();
  });

  // Corrida do MESMO golpe: o segundo create viola a unique → rollback total (o
  // token volta). Traduzido pra already_known, não pra erro 500.
  it("corrida do mesmo golpe (unique violada) vira already_known", async () => {
    tx.userPokemonMove.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
      })
    );

    const result = await applyTM("alpha", input);

    expect(result).toEqual({ ok: false, error: "already_known" });
  });

  it("recusa o pokémon de outro dono sem tocar em token", async () => {
    prismaMock.userPokemon.findUnique.mockResolvedValue({ id: "up-1", userId: "beta", pokemonId: "species-1" });

    const result = await applyTM("alpha", input);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("recusa golpe que não é de máquina (não gasta token)", async () => {
    prismaMock.pokemonMove.findUnique.mockResolvedValue({ learnMethod: "level-up" });

    const result = await applyTM("alpha", input);

    expect(result).toEqual({ ok: false, error: "not_machine_move" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("golpe já concedido não gasta token de novo", async () => {
    prismaMock.userPokemonMove.findUnique.mockResolvedValue({ id: "grant-1" });

    const result = await applyTM("alpha", input);

    expect(result).toEqual({ ok: false, error: "already_known" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
