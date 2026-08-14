import { describe, expect, it } from "vitest";
import { claimableCount, questView } from "@/src/modules/quests/ui/questView";
import { toQuestDTO } from "@/src/modules/quests/queries/toQuestDTO";

const quest = { id: "win-3", event: "battle_won" as const, goal: 3, label: "Vença 3 batalhas" };

describe("toQuestDTO", () => {
  it("não vaza userId nem dayIndex", () => {
    const dto = toQuestDTO(quest, { questId: "win-3", progress: 1, claimedAt: null });
    const json = JSON.stringify(dto);
    // dayIndex em especial: a UI que o recebesse ficaria tentada a calcular o
    // dia no cliente, onde o fuso do browser dá outra resposta que a do servidor.
    expect(json).not.toContain("dayIndex");
    expect(json).not.toContain("userId");
  });

  it("limita o progresso ao alvo — 5/3 na barra só confunde", () => {
    const dto = toQuestDTO(quest, { questId: "win-3", progress: 5, claimedAt: null });
    expect(dto.progress).toBe(3);
    expect(dto.completed).toBe(true);
  });

  it("sem linha no banco é progresso zero, não erro", () => {
    const dto = toQuestDTO(quest, undefined);
    expect(dto.progress).toBe(0);
    expect(dto.completed).toBe(false);
  });
});

describe("questView", () => {
  const dto = (over: Partial<ReturnType<typeof toQuestDTO>> = {}) => ({
    questId: "win-3",
    label: "Vença 3 batalhas",
    goal: 3,
    progress: 1,
    completed: false,
    claimed: false,
    ...over,
  });

  it("distingue os três estados", () => {
    expect(questView(dto()).state).toBe("doing");
    expect(questView(dto({ progress: 3, completed: true })).state).toBe("claimable");
    expect(questView(dto({ progress: 3, completed: true, claimed: true })).state).toBe("claimed");
  });

  it("só mostra o botão quando há o que resgatar", () => {
    expect(questView(dto()).showClaim).toBe(false);
    expect(questView(dto({ progress: 3, completed: true })).showClaim).toBe(true);
    expect(questView(dto({ progress: 3, completed: true, claimed: true })).showClaim).toBe(false);
  });

  it("a porcentagem da barra bate com o contador", () => {
    expect(questView(dto({ progress: 1 })).percent).toBe(33);
    expect(questView(dto({ progress: 1 })).counter).toBe("1/3");
    expect(questView(dto({ progress: 3 })).percent).toBe(100);
  });

  it("goal 0 não vira NaN (a barra sumiria sem erro nenhum)", () => {
    expect(questView(dto({ goal: 0, progress: 0 })).percent).toBe(0);
  });
});

describe("claimableCount", () => {
  it("conta só as completas e ainda não resgatadas", () => {
    const quests = [
      { questId: "a", label: "", goal: 1, progress: 1, completed: true, claimed: false },
      { questId: "b", label: "", goal: 1, progress: 1, completed: true, claimed: true },
      { questId: "c", label: "", goal: 3, progress: 1, completed: false, claimed: false },
    ];
    expect(claimableCount(quests)).toBe(1);
  });
});
