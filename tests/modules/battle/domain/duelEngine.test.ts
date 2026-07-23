import { describe, expect, it } from "vitest";
import { resolveRound, startDuel } from "@/src/modules/battle/domain/duelEngine";
import { orderForTurn } from "@/src/modules/battle/domain/turnOrder";
import type { DuelSide } from "@/src/modules/battle/domain/duelTypes";
import { TypeEffectivenessMap } from "@/src/modules/battle/domain/typeChart";
import { makeMon, makeMove, sequenceRng, throwingRng } from "./testFixtures";

const neutralChart: TypeEffectivenessMap = {};

// Uma carta de status (power null) não rola rng nem causa dano — ideal pra
// testar o FLUXO do turno sem ruído. throwingRng garante que ninguém rolou.
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

const sideOf = (state: { sideA: DuelSide; sideB: DuelSide }, userId: string) =>
  state.sideA.userId === userId ? state.sideA : state.sideB;

describe("orderForTurn — a regra da série", () => {
  it("priority do golpe vence Speed (quick-attack sai antes)", () => {
    const slowWithPriority = {
      userId: "slow",
      mon: makeMon({
        moves: [makeMove({ name: "quick-attack", priority: 1 })],
        stats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 10 },
      }),
      cardSlot: 0,
    };
    const fastNoPriority = {
      userId: "fast",
      mon: makeMon({
        moves: [makeMove({ name: "tackle", priority: 0 })],
        stats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 200 },
      }),
      cardSlot: 0,
    };
    expect(orderForTurn(slowWithPriority, fastNoPriority, throwingRng())[0].userId).toBe("slow");
    expect(orderForTurn(fastNoPriority, slowWithPriority, throwingRng())[0].userId).toBe("slow");
  });

  it("empatada a priority, quem tem mais Speed age primeiro", () => {
    const fast = { userId: "fast", mon: makeDuelSide("fast", 120).active, cardSlot: 0 };
    const slow = { userId: "slow", mon: makeDuelSide("slow", 60).active, cardSlot: 0 };
    expect(orderForTurn(fast, slow, throwingRng())[0].userId).toBe("fast");
    expect(orderForTurn(slow, fast, throwingRng())[0].userId).toBe("fast");
  });

  it("speed tie é sorteio (como no jogo), e SÓ aí o rng é consumido", () => {
    const a = { userId: "a", mon: makeDuelSide("a", 80).active, cardSlot: 0 };
    const b = { userId: "b", mon: makeDuelSide("b", 80).active, cardSlot: 0 };
    expect(orderForTurn(a, b, () => 0.1)[0].userId).toBe("a");
    expect(orderForTurn(a, b, () => 0.9)[0].userId).toBe("b");
  });

  it("quem não escolheu carta fica atrás de quem escolheu", () => {
    const hesitantFast = { userId: "fast", mon: makeDuelSide("fast", 200).active, cardSlot: null };
    const slow = { userId: "slow", mon: makeDuelSide("slow", 5).active, cardSlot: 0 };
    expect(orderForTurn(hesitantFast, slow, throwingRng())[0].userId).toBe("slow");
  });
});

describe("resolveRound — o turno é uma unidade", () => {
  it("as DUAS jogadas saem no mesmo round, e o round avança uma vez só", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    const r = resolveRound({
      state,
      actionA: { userId: "fast", type: "CARD", cardSlot: 0 },
      actionB: { userId: "slow", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });

    expect(r.finished).toBe(false);
    expect(r.state.round).toBe(2);
    const attacks = r.events.filter((e) => e.type === "attack");
    expect(attacks.map((e) => (e.type === "attack" ? e.userId : ""))).toEqual(["fast", "slow"]);
  });

  it("registra quem ganhou a ordem no roundStart (é o que dá sentido ao Speed na tela)", () => {
    const state = startDuel(makeDuelSide("slow", 10), makeDuelSide("fast", 200));
    const r = resolveRound({
      state,
      actionA: { userId: "slow", type: "CARD", cardSlot: 0 },
      actionB: { userId: "fast", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(r.events[0]).toEqual({ type: "roundStart", round: 1, firstUserId: "fast" });
  });

  it("quem é nocauteado pelo primeiro golpe NÃO chega a agir", () => {
    // 'fast' mata de um golpe; 'slow' tem 1 de HP e uma carta que causaria dano.
    const killer: DuelSide = {
      userId: "fast",
      active: makeMon({
        moves: [makeMove({ name: "boom", power: 200, damageClass: "physical" })],
        stats: { hp: 100, attack: 200, defense: 100, specialAttack: 100, specialDefense: 100, speed: 90 },
      }),
    };
    const victim: DuelSide = {
      userId: "slow",
      active: makeMon({
        maxHp: 1,
        currentHp: 1,
        moves: [makeMove({ name: "revenge", power: 200, damageClass: "physical" })],
        stats: { hp: 1, attack: 200, defense: 1, specialAttack: 10, specialDefense: 1, speed: 10 },
      }),
    };

    const r = resolveRound({
      state: startDuel(killer, victim),
      actionA: { userId: "fast", type: "CARD", cardSlot: 0 },
      actionB: { userId: "slow", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      // 3 rolagens do golpe do 'fast': accuracy, crit, variância. Se o 'slow'
      // chegasse a atacar, o rng estouraria — é essa a prova.
      rng: sequenceRng([0, 0.99, 0.99]),
    });

    expect(r.finished).toBe(true);
    expect(r.winnerId).toBe("fast");
    expect(sideOf(r.state, "slow").active.fainted).toBe(true);
    expect(sideOf(r.state, "fast").active.currentHp).toBe(100); // não tomou nada
    expect(r.events.filter((e) => e.type === "attack")).toHaveLength(1);
    expect(r.state.round).toBe(1); // duelo encerrado não avança o round
  });

  it("NONE é hesitação: o lado passa em branco e o outro age normal", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    const r = resolveRound({
      state,
      actionA: { userId: "fast", type: "NONE" },
      actionB: { userId: "slow", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(r.events).toContainEqual({ type: "hesitate", userId: "fast" });
    expect(r.events.some((e) => e.type === "attack" && e.userId === "slow")).toBe(true);
    expect(r.state.round).toBe(2);
  });

  it("gasta PP da carta usada, dos dois lados", () => {
    const withPp = (userId: string, speed: number): DuelSide => ({
      userId,
      active: makeMon({
        moves: [makeMove({ name: "jab", damageClass: "status", power: null, currentPp: 5 })],
        stats: { hp: 100, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed },
      }),
    });
    const r = resolveRound({
      state: startDuel(withPp("fast", 90), withPp("slow", 30)),
      actionA: { userId: "fast", type: "CARD", cardSlot: 0 },
      actionB: { userId: "slow", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(sideOf(r.state, "fast").active.moves[0].currentPp).toBe(4);
    expect(sideOf(r.state, "slow").active.moves[0].currentPp).toBe(4);
  });

  it("recusa ação de quem não é do duelo, e duas ações do mesmo jogador", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    expect(() =>
      resolveRound({
        state,
        actionA: { userId: "intruso", type: "CARD", cardSlot: 0 },
        actionB: { userId: "slow", type: "CARD", cardSlot: 0 },
        typeChart: neutralChart,
        rng: throwingRng(),
      })
    ).toThrow(/não pertence/);

    expect(() =>
      resolveRound({
        state,
        actionA: { userId: "fast", type: "CARD", cardSlot: 0 },
        actionB: { userId: "fast", type: "CARD", cardSlot: 0 },
        typeChart: neutralChart,
        rng: throwingRng(),
      })
    ).toThrow(/mesmo jogador/);
  });

  it("não muta o estado recebido (o command grava o resultado, não o input)", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    resolveRound({
      state,
      actionA: { userId: "fast", type: "CARD", cardSlot: 0 },
      actionB: { userId: "slow", type: "CARD", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(state.round).toBe(1);
    expect(state.sideA.active.moves[0].currentPp).toBe(15);
  });
});
