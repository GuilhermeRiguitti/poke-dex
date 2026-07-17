import { describe, expect, it } from "vitest";
import { applyDuelAction, startDuel } from "@/src/modules/battle/domain/duelEngine";
import { computeInitiative } from "@/src/modules/battle/domain/duelInitiative";
import type { DuelSide, DuelState } from "@/src/modules/battle/domain/duelTypes";
import { TypeEffectivenessMap } from "@/src/modules/battle/domain/typeChart";
import { makeMon, makeMove, sequenceRng, throwingRng } from "./testFixtures";

const neutralChart: TypeEffectivenessMap = {};

// Uma carta de status (power null) não rola rng nem causa dano — ideal pra
// testar o FLUXO alternado sem ruído. throwingRng garante que ninguém rolou.
const statusCard = () => makeMove({ name: "wait", damageClass: "status", power: null });

function makeDuelSide(userId: string, speed: number, moves = [statusCard()]): DuelSide {
  return {
    userId,
    active: makeMon({
      moves,
      stats: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed },
    }),
  };
}

describe("computeInitiative", () => {
  it("Speed maior começa a rodada", () => {
    const fast = makeDuelSide("user-a", 120);
    const slow = makeDuelSide("user-b", 60);
    expect(computeInitiative(fast, slow)).toEqual(["user-a", "user-b"]);
    expect(computeInitiative(slow, fast)).toEqual(["user-a", "user-b"]);
  });

  it("Speed empatado desempata por userId (determinístico, reconstruível)", () => {
    const a = makeDuelSide("user-b", 80);
    const b = makeDuelSide("user-a", 80);
    expect(computeInitiative(a, b)).toEqual(["user-a", "user-b"]);
  });
});

describe("startDuel", () => {
  it("começa na rodada 1, com a vez de quem tem mais Speed", () => {
    const state = startDuel(makeDuelSide("slow", 30), makeDuelSide("fast", 90));
    expect(state.round).toBe(1);
    expect(state.actedThisRound).toBe(0);
    expect(state.activeUserId).toBe("fast");
    expect(state.order).toEqual(["fast", "slow"]);
  });
});

describe("applyDuelAction — fluxo alternado", () => {
  function freshState(): DuelState {
    // fast começa; ambos com carta de status pra não rolar rng.
    return startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
  }

  it("depois de agir, a vez passa pro segundo da iniciativa (não avança rodada)", () => {
    const r = applyDuelAction({
      state: freshState(),
      action: { userId: "fast", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(r.finished).toBe(false);
    expect(r.state.activeUserId).toBe("slow");
    expect(r.state.round).toBe(1);
    expect(r.state.actedThisRound).toBe(1);
  });

  it("quando os dois agem, começa a rodada 2 e recalcula a iniciativa", () => {
    let state = freshState();
    state = applyDuelAction({ state, action: { userId: "fast", type: "CARD", cardSlot: 0 }, typeChart: neutralChart, rng: throwingRng() }).state;
    const r = applyDuelAction({ state, action: { userId: "slow", type: "CARD", cardSlot: 0 }, typeChart: neutralChart, rng: throwingRng() });

    expect(r.state.round).toBe(2);
    expect(r.state.actedThisRound).toBe(0);
    expect(r.state.activeUserId).toBe("fast"); // Speed manda de novo
    expect(r.events.some((e) => e.type === "roundStart" && e.round === 2 && e.firstUserId === "fast")).toBe(true);
  });

  it("recusa uma ação de quem não é a vez (trava lógica; o command também barra)", () => {
    expect(() =>
      applyDuelAction({
        state: freshState(),
        action: { userId: "slow", type: "CARD", cardSlot: 0 },
        typeChart: neutralChart,
        rng: throwingRng(),
      })
    ).toThrow(/não é a vez/);
  });

  it("NONE é hesitação: passa em branco mas gasta o turno", () => {
    const r = applyDuelAction({
      state: freshState(),
      action: { userId: "fast", type: "NONE" },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(r.events).toContainEqual({ type: "hesitate", userId: "fast" });
    expect(r.state.activeUserId).toBe("slow");
  });
});

describe("applyDuelAction — dano e fim de jogo", () => {
  it("aplica dano no oponente e encerra o duelo quando ele desmaia (1×1)", () => {
    // 'fast' com carta forte; 'slow' com 1 de HP pra desmaiar de um golpe.
    const attacker: DuelSide = {
      userId: "fast",
      active: makeMon({
        moves: [makeMove({ name: "boom", power: 200, damageClass: "physical" })],
        stats: { hp: 100, attack: 200, defense: 100, specialAttack: 100, specialDefense: 100, speed: 90 },
      }),
    };
    const victim: DuelSide = {
      userId: "slow",
      active: makeMon({ maxHp: 1, currentHp: 1, stats: { hp: 1, attack: 10, defense: 1, specialAttack: 10, specialDefense: 1, speed: 10 } }),
    };
    const state = startDuel(attacker, victim);

    const r = applyDuelAction({
      state,
      action: { userId: "fast", type: "CARD", cardSlot: 0 },
      // accuracy pass, no crit, variance máxima: 3 rolagens
      typeChart: neutralChart,
      rng: sequenceRng([0, 0.99, 0.99]),
    });

    expect(r.finished).toBe(true);
    expect(r.winnerId).toBe("fast");
    const target = r.state.sideB.userId === "slow" ? r.state.sideB : r.state.sideA;
    expect(target.active.fainted).toBe(true);
    // a vez NÃO avança num duelo encerrado
    expect(r.state.actedThisRound).toBe(0);
  });

  it("gasta PP da carta usada", () => {
    const state = startDuel(
      { userId: "fast", active: makeMon({ moves: [makeMove({ name: "jab", damageClass: "status", power: null, currentPp: 5 })], stats: { hp: 100, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 90 } }) },
      makeDuelSide("slow", 30)
    );
    const r = applyDuelAction({ state, action: { userId: "fast", type: "CARD", cardSlot: 0 }, typeChart: neutralChart, rng: throwingRng() });
    const fastSide = r.state.sideA.userId === "fast" ? r.state.sideA : r.state.sideB;
    expect(fastSide.active.moves[0].currentPp).toBe(4);
  });
});
