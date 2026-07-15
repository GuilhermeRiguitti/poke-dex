import { describe, expect, it } from "vitest";
import {
  alreadyCheckedInToday,
  daysUntilReward,
  earnsReward,
  nextStreak,
  STREAK_REWARD_CYCLE,
} from "./streak";

// Datas em UTC puro pra fixar as fronteiras de dia.
const d = (iso: string) => new Date(iso);

describe("alreadyCheckedInToday", () => {
  it("mesmo dia UTC => true", () => {
    expect(alreadyCheckedInToday(d("2026-07-14T02:00:00Z"), d("2026-07-14T23:00:00Z"))).toBe(true);
  });
  it("dia anterior => false", () => {
    expect(alreadyCheckedInToday(d("2026-07-13T23:59:00Z"), d("2026-07-14T00:01:00Z"))).toBe(false);
  });
  it("nunca fez check-in => false", () => {
    expect(alreadyCheckedInToday(null, d("2026-07-14T00:00:00Z"))).toBe(false);
  });
});

describe("nextStreak", () => {
  it("primeiro check-in => 1", () => {
    expect(nextStreak(0, null, d("2026-07-14T10:00:00Z"))).toBe(1);
  });
  it("ontem => +1 (continua)", () => {
    expect(nextStreak(4, d("2026-07-13T20:00:00Z"), d("2026-07-14T08:00:00Z"))).toBe(5);
  });
  it("hoje de novo => mantém (o claim no-opa)", () => {
    expect(nextStreak(5, d("2026-07-14T01:00:00Z"), d("2026-07-14T22:00:00Z"))).toBe(5);
  });
  it("pulou um dia => reseta pra 1", () => {
    expect(nextStreak(9, d("2026-07-12T10:00:00Z"), d("2026-07-14T10:00:00Z"))).toBe(1);
  });
  it("fronteira: 23:59 de um dia -> 00:01 do outro conta como sequência", () => {
    // Só 2 minutos de diferença, mas cruzou a meia-noite UTC => delta 1 => +1.
    expect(nextStreak(2, d("2026-07-13T23:59:00Z"), d("2026-07-14T00:01:00Z"))).toBe(3);
  });
});

describe("earnsReward", () => {
  it("múltiplos de 7 dão bônus", () => {
    expect(earnsReward(7)).toBe(true);
    expect(earnsReward(14)).toBe(true);
  });
  it("não-múltiplos e zero não dão", () => {
    expect(earnsReward(6)).toBe(false);
    expect(earnsReward(8)).toBe(false);
    expect(earnsReward(0)).toBe(false);
  });
});

describe("daysUntilReward", () => {
  it("conta até o próximo múltiplo de 7", () => {
    expect(daysUntilReward(1)).toBe(6);
    expect(daysUntilReward(6)).toBe(1);
  });
  it("marco recém-batido => ciclo inteiro até o próximo", () => {
    expect(daysUntilReward(7)).toBe(STREAK_REWARD_CYCLE);
    expect(daysUntilReward(0)).toBe(STREAK_REWARD_CYCLE);
  });
});
