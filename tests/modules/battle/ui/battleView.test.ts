import { describe, expect, it } from "vitest";
import { selectDuelView } from "@/src/modules/battle/ui/battleView";
import type { BattleDTO } from "@/src/modules/battle/ui/types";

function mon(over: Partial<BattleDTO["participants"][number]["pokemons"][number]> = {}) {
  return {
    id: "pk",
    slot: 1,
    pokemonId: 25,
    name: "pikachu",
    spriteUrl: null,
    types: ["electric"],
    level: 20,
    maxHp: 80,
    currentHp: 40,
    fainted: false,
    moves: [
      { id: 1, name: "thunderbolt", type: "electric", power: 90, accuracy: 100, damageClass: "special" as const, priority: 0, maxPp: 15, currentPp: 15 },
      { id: 2, name: "quick-attack", type: "normal", power: 40, accuracy: 100, damageClass: "physical" as const, priority: 1, maxPp: 30, currentPp: 0 },
    ],
    ...over,
  };
}

function battle(over: Partial<BattleDTO> = {}): BattleDTO {
  return {
    id: "b1",
    status: "IN_PROGRESS",
    round: 3,
    activeUserId: "me",
    winnerId: null,
    participants: [
      { id: "pm", userId: "me", activeSlot: 1, pokemons: [mon()] },
      { id: "po", userId: "opp", activeSlot: 1, pokemons: [mon({ currentHp: 10, name: "bulbasaur" })] },
    ],
    turnLogs: [
      { turnNumber: 4, events: [{ type: "roundStart", round: 3, firstUserId: "me" }] },
      { turnNumber: 3, events: [{ type: "attack", userId: "me", cardName: "thunderbolt", damage: 22, effectiveness: 2, isCrit: false, missed: false, targetFainted: false }] },
    ],
    ...over,
  };
}

describe("selectDuelView", () => {
  it("monta a visão do MEU ponto de vista: minha vez, HP%, cartas", () => {
    const v = selectDuelView(battle(), "me")!;
    expect(v.isMyTurn).toBe(true);
    expect(v.me.name).toBe("pikachu");
    expect(v.opp.name).toBe("bulbasaur");
    expect(v.me.hpPct).toBe(50); // 40/80
    expect(v.cards).toHaveLength(2);
    // quick-attack sem PP e ainda há outra com PP → não jogável.
    expect(v.cards[1].disabled).toBe(true);
    expect(v.cards[0].disabled).toBe(false);
  });

  it("não é minha vez quando activeUserId é o oponente", () => {
    expect(selectDuelView(battle({ activeUserId: "opp" }), "me")!.isMyTurn).toBe(false);
  });

  it("log em ordem cronológica (asc por turno) e chaveado por 'Você'/'Oponente'", () => {
    const v = selectDuelView(battle(), "me")!;
    // turnLogs vêm desc; a view ordena asc por turnNumber → turno 3 (ataque)
    // antes do turno 4 (roundStart).
    expect(v.logLines[0].text).toContain("Você usou thunderbolt");
    expect(v.logLines[0].text).toContain("super eficaz");
    expect(v.logLines[1].text).toContain("Rodada 3");
  });

  it("fim de jogo: isOver + iWon pelo winnerId", () => {
    const v = selectDuelView(battle({ status: "FINISHED", winnerId: "me", activeUserId: "me" }), "me")!;
    expect(v.isOver).toBe(true);
    expect(v.iWon).toBe(true);
    expect(v.isMyTurn).toBe(false); // acabou → não é vez de ninguém
  });

  it("devolve null se eu não estou na partida", () => {
    expect(selectDuelView(battle(), "estranho")).toBeNull();
  });
});
