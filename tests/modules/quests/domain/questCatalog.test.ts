import { describe, expect, it } from "vitest";
import {
  DAILY_QUEST_COUNT,
  QUEST_CATALOG,
  isComplete,
  questById,
  questsForDay,
} from "@/src/modules/quests/domain/questCatalog";

describe("questsForDay", () => {
  it("é DETERMINÍSTICA: o mesmo dia dá sempre a mesma lista", () => {
    // Sem worker, ninguém "gira as quests à meia-noite". Se fosse sorteio
    // guardado no primeiro acesso, duas abas abertas juntas poderiam receber
    // listas diferentes, e a corrida entre elas decidiria qual valia.
    expect(questsForDay(20_678).map((q) => q.id)).toEqual(
      questsForDay(20_678).map((q) => q.id),
    );
  });

  it("entrega a quantidade combinada, sem repetir", () => {
    const ids = questsForDay(20_678).map((q) => q.id);
    expect(ids).toHaveLength(DAILY_QUEST_COUNT);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("muda de um dia pro outro", () => {
    const hoje = questsForDay(20_678).map((q) => q.id);
    const amanha = questsForDay(20_679).map((q) => q.id);
    expect(hoje).not.toEqual(amanha);
  });

  it("todo id devolvido existe no catálogo", () => {
    // O id é a chave gravada em QuestProgress — um id fora do catálogo viraria
    // progresso órfão, que nunca completa.
    for (const q of questsForDay(20_678)) {
      expect(questById(q.id)).not.toBeNull();
    }
  });

  it("dá a volta no catálogo sem quebrar em dayIndex grande", () => {
    expect(() => questsForDay(999_999)).not.toThrow();
    expect(questsForDay(999_999)).toHaveLength(DAILY_QUEST_COUNT);
  });
});

describe("catálogo", () => {
  it("não tem id repetido", () => {
    const ids = QUEST_CATALOG.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda quest tem alvo maior que zero", () => {
    // goal 0 daria divisão por zero na barra de progresso (NaN) e uma quest que
    // nasce completa.
    for (const q of QUEST_CATALOG) expect(q.goal).toBeGreaterThan(0);
  });
});

describe("isComplete", () => {
  it("completa na borda e continua completa depois", () => {
    expect(isComplete(2, 3)).toBe(false);
    expect(isComplete(3, 3)).toBe(true);
    expect(isComplete(4, 3)).toBe(true);
  });
});
