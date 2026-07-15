import { beforeEach, describe, expect, it, vi } from "vitest";

// O que estes testes protegem:
//  1. IDEMPOTÊNCIA por dia: dois check-ins no mesmo dia não contam duas vezes.
//  2. CONCORRÊNCIA (regra 6): quem perde o claim não credita streak nem bônus.
//  3. A regra do streak: continua, reseta, e concede bônus no 7º dia.

const prismaMock = {
  packState: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
};

vi.mock("@/src/lib/prisma", () => ({ prisma: prismaMock }));

const { checkInLogin } = await import("./checkInLogin");

const d = (iso: string) => new Date(iso);
const NOW = d("2026-07-14T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.packState.updateMany.mockResolvedValue({ count: 1 });
});

describe("checkInLogin — idempotência", () => {
  it("já fez check-in hoje => não escreve, não credita", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastCheckIn: d("2026-07-14T01:00:00Z"), // hoje
      loginStreak: 5,
      extraPacks: 0,
    });

    const r = await checkInLogin("u1", NOW);

    expect(r).toEqual({ checkedIn: false, streak: 5, awardedPack: false, extraPacks: 0 });
    expect(prismaMock.packState.updateMany).not.toHaveBeenCalled();
  });
});

describe("checkInLogin — regra do streak", () => {
  it("último foi ontem => +1", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastCheckIn: d("2026-07-13T20:00:00Z"),
      loginStreak: 4,
      extraPacks: 0,
    });

    const r = await checkInLogin("u1", NOW);

    expect(r.checkedIn).toBe(true);
    expect(r.streak).toBe(5);
    expect(r.awardedPack).toBe(false);
  });

  it("pulou um dia => reseta pra 1", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastCheckIn: d("2026-07-12T10:00:00Z"),
      loginStreak: 9,
      extraPacks: 2,
    });

    const r = await checkInLogin("u1", NOW);

    expect(r.streak).toBe(1);
    expect(r.awardedPack).toBe(false);
    expect(r.extraPacks).toBe(2); // bônus preservado, só não ganha novo
  });

  it("7º dia seguido => concede 1 pacote-bônus", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastCheckIn: d("2026-07-13T20:00:00Z"),
      loginStreak: 6,
      extraPacks: 0,
    });

    const r = await checkInLogin("u1", NOW);

    expect(r.streak).toBe(7);
    expect(r.awardedPack).toBe(true);
    expect(r.extraPacks).toBe(1);
    // o incremento do bônus vai no MESMO updateMany do check-in (atômico)
    const dataArg = prismaMock.packState.updateMany.mock.calls[0][0].data;
    expect(dataArg.extraPacks).toEqual({ increment: 1 });
  });

  it("dia normal (não-múltiplo de 7) NÃO mexe em extraPacks", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastCheckIn: d("2026-07-13T20:00:00Z"),
      loginStreak: 2,
      extraPacks: 0,
    });

    await checkInLogin("u1", NOW);

    const dataArg = prismaMock.packState.updateMany.mock.calls[0][0].data;
    expect(dataArg.extraPacks).toBeUndefined();
  });
});

describe("checkInLogin — concorrência (perde o claim)", () => {
  it("claim count 0 => não credita, relê o estado real", async () => {
    prismaMock.packState.upsert.mockResolvedValue({
      lastCheckIn: d("2026-07-13T20:00:00Z"),
      loginStreak: 6,
      extraPacks: 0,
    });
    // outra aba já fez o check-in de hoje primeiro
    prismaMock.packState.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.packState.findUniqueOrThrow.mockResolvedValue({ loginStreak: 7, extraPacks: 1 });

    const r = await checkInLogin("u1", NOW);

    // NÃO devolve awardedPack true — quem perdeu não pode disparar o toast do bônus
    expect(r).toEqual({ checkedIn: false, streak: 7, awardedPack: false, extraPacks: 1 });
  });
});
