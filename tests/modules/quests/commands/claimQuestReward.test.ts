import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUEST_CATALOG } from "@/src/modules/quests/domain/questCatalog";

// O resgate cria um token do nada. Sob concorrência (dois cliques em
// "Resgatar"), quem perde o claim NÃO pode creditar (CLAUDE.md regra 6).

const tx = {
  questProgress: { updateMany: vi.fn(), findUnique: vi.fn() },
  packState: { upsert: vi.fn() },
};

const prismaMock = { $transaction: vi.fn() };

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { claimQuestReward } = await import("@/src/modules/quests/commands/claimQuestReward");

const QUEST_ID = QUEST_CATALOG[0].id;
const NOW = new Date("2026-08-14T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  tx.questProgress.updateMany.mockResolvedValue({ count: 1 }); // ganhou o claim
  tx.packState.upsert.mockResolvedValue({ tutorTokens: 3 });
});

describe("claimQuestReward", () => {
  it("credita 1 token e devolve o saldo novo", async () => {
    const result = await claimQuestReward("alpha", { questId: QUEST_ID }, NOW);

    expect(result).toEqual({ ok: true, tutorTokens: 3 });
    expect(tx.packState.upsert).toHaveBeenCalled();
  });

  it("o claim exige 'não resgatada' e 'completa' no PRÓPRIO where", async () => {
    await claimQuestReward("alpha", { questId: QUEST_ID }, NOW);

    const where = tx.questProgress.updateMany.mock.calls[0][0].where;
    // Checar antes num findUnique seria corrida: entre a leitura e a escrita, a
    // outra lambda resgataria.
    expect(where.claimedAt).toBeNull();
    expect(where.progress).toEqual({ gte: QUEST_CATALOG[0].goal });
  });

  it("quem PERDE o claim não credita token", async () => {
    tx.questProgress.updateMany.mockResolvedValue({ count: 0 });
    tx.questProgress.findUnique.mockResolvedValue({ progress: 99, claimedAt: NOW });

    const result = await claimQuestReward("alpha", { questId: QUEST_ID }, NOW);

    expect(result).toEqual({ ok: false, error: "already_claimed" });
    expect(tx.packState.upsert).not.toHaveBeenCalled();
  });

  it("quest incompleta não credita", async () => {
    tx.questProgress.updateMany.mockResolvedValue({ count: 0 });
    tx.questProgress.findUnique.mockResolvedValue({ progress: 0, claimedAt: null });

    const result = await claimQuestReward("alpha", { questId: QUEST_ID }, NOW);

    expect(result).toEqual({ ok: false, error: "not_complete" });
    expect(tx.packState.upsert).not.toHaveBeenCalled();
  });

  it("quest sem progresso nenhum também não credita", async () => {
    tx.questProgress.updateMany.mockResolvedValue({ count: 0 });
    tx.questProgress.findUnique.mockResolvedValue(null); // nunca jogou hoje

    const result = await claimQuestReward("alpha", { questId: QUEST_ID }, NOW);

    expect(result).toEqual({ ok: false, error: "not_complete" });
    expect(tx.packState.upsert).not.toHaveBeenCalled();
  });

  it("questId fora do catálogo nem abre transação", async () => {
    const result = await claimQuestReward("alpha", { questId: "quest-inventada" }, NOW);

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
