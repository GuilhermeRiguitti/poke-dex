import { describe, expect, it } from "vitest";
import { applyForcedSwitch, resolveRound, startDuel } from "@/src/modules/battle/domain/duelEngine";
import { orderForTurn } from "@/src/modules/battle/domain/turnOrder";
import { activeOf, type DuelSide, type DuelState } from "@/src/modules/battle/domain/duelTypes";
import { TypeEffectivenessMap } from "@/src/modules/battle/domain/typeChart";
import { makeMon, makeMove, sequenceRng, throwingRng } from "./testFixtures";

const neutralChart: TypeEffectivenessMap = {};

// Uma carta de status (power null) não rola rng nem causa dano — ideal pra
// testar o FLUXO do turno sem ruído. throwingRng garante que ninguém rolou.
const statusCard = () => makeMove({ name: "wait", damageClass: "status", power: null });

function makeDuelSide(userId: string, speed: number, moves = [statusCard()]): DuelSide {
  return {
    userId,
    activeSlot: 1,
    team: [
      makeMon({
        slot: 1,
        moves,
        stats: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed },
      }),
    ],
  };
}

const sideOf = (state: { sideA: DuelSide; sideB: DuelSide }, userId: string) =>
  state.sideA.userId === userId ? state.sideA : state.sideB;
const active = (state: { sideA: DuelSide; sideB: DuelSide }, userId: string) => activeOf(sideOf(state, userId));

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
    const fast = { userId: "fast", mon: makeDuelSide("fast", 120).team[0], cardSlot: 0 };
    const slow = { userId: "slow", mon: makeDuelSide("slow", 60).team[0], cardSlot: 0 };
    expect(orderForTurn(fast, slow, throwingRng())[0].userId).toBe("fast");
    expect(orderForTurn(slow, fast, throwingRng())[0].userId).toBe("fast");
  });

  it("speed tie é sorteio (como no jogo), e SÓ aí o rng é consumido", () => {
    const a = { userId: "a", mon: makeDuelSide("a", 80).team[0], cardSlot: 0 };
    const b = { userId: "b", mon: makeDuelSide("b", 80).team[0], cardSlot: 0 };
    expect(orderForTurn(a, b, () => 0.1)[0].userId).toBe("a");
    expect(orderForTurn(a, b, () => 0.9)[0].userId).toBe("b");
  });

  it("quem não escolheu carta fica atrás de quem escolheu", () => {
    const hesitantFast = { userId: "fast", mon: makeDuelSide("fast", 200).team[0], cardSlot: null };
    const slow = { userId: "slow", mon: makeDuelSide("slow", 5).team[0], cardSlot: 0 };
    expect(orderForTurn(hesitantFast, slow, throwingRng())[0].userId).toBe("slow");
  });
});

describe("resolveRound — o turno é uma unidade", () => {
  it("as DUAS jogadas saem no mesmo round, e o round avança uma vez só", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    const r = resolveRound({
      state,
      actionA: { userId: "fast", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "slow", type: "MOVE", cardSlot: 0 },
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
      actionA: { userId: "slow", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "fast", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(r.events[0]).toEqual({ type: "roundStart", round: 1, firstUserId: "fast" });
  });

  it("quem é nocauteado pelo primeiro golpe NÃO chega a agir", () => {
    // 'fast' mata de um golpe; 'slow' tem 1 de HP e uma carta que causaria dano.
    const killer: DuelSide = {
      userId: "fast",
      activeSlot: 1,
      team: [
        makeMon({
          slot: 1,
          moves: [makeMove({ name: "boom", power: 200, damageClass: "physical" })],
          stats: { hp: 100, attack: 200, defense: 100, specialAttack: 100, specialDefense: 100, speed: 90 },
        }),
      ],
    };
    const victim: DuelSide = {
      userId: "slow",
      activeSlot: 1,
      team: [
        makeMon({
          slot: 1,
          maxHp: 1,
          currentHp: 1,
          moves: [makeMove({ name: "revenge", power: 200, damageClass: "physical" })],
          stats: { hp: 1, attack: 200, defense: 1, specialAttack: 10, specialDefense: 1, speed: 10 },
        }),
      ],
    };

    const r = resolveRound({
      state: startDuel(killer, victim),
      actionA: { userId: "fast", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "slow", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      // 3 rolagens do golpe do 'fast': accuracy, crit, variância. Se o 'slow'
      // chegasse a atacar, o rng estouraria — é essa a prova.
      rng: sequenceRng([0, 0.99, 0.99]),
    });

    expect(r.finished).toBe(true);
    expect(r.winnerId).toBe("fast");
    expect(active(r.state, "slow").fainted).toBe(true);
    expect(active(r.state, "fast").currentHp).toBe(100); // não tomou nada
    expect(r.events.filter((e) => e.type === "attack")).toHaveLength(1);
    expect(r.state.round).toBe(1); // duelo encerrado não avança o round
  });

  it("NONE é hesitação: o lado passa em branco e o outro age normal", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    const r = resolveRound({
      state,
      actionA: { userId: "fast", type: "NONE" },
      actionB: { userId: "slow", type: "MOVE", cardSlot: 0 },
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
      activeSlot: 1,
      team: [
        makeMon({
          slot: 1,
          moves: [makeMove({ name: "jab", damageClass: "status", power: null, currentPp: 5 })],
          stats: { hp: 100, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed },
        }),
      ],
    });
    const r = resolveRound({
      state: startDuel(withPp("fast", 90), withPp("slow", 30)),
      actionA: { userId: "fast", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "slow", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(active(r.state, "fast").moves[0].currentPp).toBe(4);
    expect(active(r.state, "slow").moves[0].currentPp).toBe(4);
  });

  it("recusa ação de quem não é do duelo, e duas ações do mesmo jogador", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    expect(() =>
      resolveRound({
        state,
        actionA: { userId: "intruso", type: "MOVE", cardSlot: 0 },
        actionB: { userId: "slow", type: "MOVE", cardSlot: 0 },
        typeChart: neutralChart,
        rng: throwingRng(),
      })
    ).toThrow(/não pertence/);

    expect(() =>
      resolveRound({
        state,
        actionA: { userId: "fast", type: "MOVE", cardSlot: 0 },
        actionB: { userId: "fast", type: "MOVE", cardSlot: 0 },
        typeChart: neutralChart,
        rng: throwingRng(),
      })
    ).toThrow(/mesmo jogador/);
  });

  it("não muta o estado recebido (o command grava o resultado, não o input)", () => {
    const state = startDuel(makeDuelSide("fast", 90), makeDuelSide("slow", 30));
    resolveRound({
      state,
      actionA: { userId: "fast", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "slow", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });
    expect(state.round).toBe(1);
    expect(state.sideA.team[0].moves[0].currentPp).toBe(15);
  });
});

// ── TIME de 6: troca voluntária, desmaio sem fim, e troca forçada ─────────────

// Carta física de dano previsível pra provar quem tomou golpe. rng 0.5 sempre
// acerta, não crita e a variância é 0.925.
const rng = () => 0.5;
const hitCard = () => makeMove({ name: "tackle", power: 100, damageClass: "physical", accuracy: null });

/** Um lado com time explícito (slots reindexados a partir de 1). */
function team(userId: string, mons: DuelSide["team"], activeSlot = 1): DuelSide {
  return { userId, activeSlot, team: mons };
}

function combatant(slot: number, name: string, hp: number, opts: { speed?: number; fainted?: boolean } = {}) {
  const speed = opts.speed ?? 50;
  return makeMon({
    slot,
    name,
    maxHp: hp,
    currentHp: opts.fainted ? 0 : hp,
    fainted: opts.fainted ?? false,
    moves: [hitCard()],
    stats: { hp, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed },
  });
}

// tackle: base 46, com STAB 1.5 (mon e carta são "normal") e variância 0.925:
// floor(46 * 1.5 * 0.925) = 63.
const HIT = 63;

describe("resolveRound — troca voluntária (time)", () => {
  it("a troca resolve ANTES do ataque, e quem entra PODE tomar dano no mesmo turno", () => {
    const state: DuelState = {
      round: 1,
      sideA: team("a", [combatant(1, "a1", 100), combatant(2, "a2", 100)]),
      sideB: team("b", [combatant(1, "b1", 100, { speed: 99 })]),
    };

    const r = resolveRound({
      state,
      actionA: { userId: "a", type: "SWITCH", targetSlot: 2 },
      actionB: { userId: "b", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng,
    });

    expect(r.state.sideA.activeSlot).toBe(2);
    expect(r.state.sideA.team[1].currentHp).toBe(100 - HIT); // o que ENTROU levou o golpe
    expect(r.state.sideA.team[0].currentHp).toBe(100); // o que saiu ficou intacto
    expect(r.state.sideB.team[0].currentHp).toBe(100); // A trocou → não atacou
    expect(r.events.some((e) => e.type === "switch")).toBe(true);
    expect(r.events.filter((e) => e.type === "attack")).toHaveLength(1);
    expect(r.finished).toBe(false);
  });
});

describe("resolveRound — desmaiar com/sem reserva", () => {
  it("desmaiar NÃO encerra enquanto há reserva viva", () => {
    const state: DuelState = {
      round: 3,
      sideA: team("a", [combatant(1, "a1", 30, { speed: 10 }), combatant(2, "a2", 100, { speed: 10 })]),
      sideB: team("b", [combatant(1, "b1", 100, { speed: 99 })]), // mais rápido: bate primeiro
    };

    const r = resolveRound({
      state,
      actionA: { userId: "a", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "b", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng,
    });

    expect(r.state.sideA.team[0].fainted).toBe(true);
    expect(r.finished).toBe(false);
    expect(r.winnerId).toBeNull();
    expect(r.state.round).toBe(4);
    expect(r.state.sideB.team[0].currentHp).toBe(100); // A caiu antes de agir → B intacto
  });

  it("desmaiar SEM reserva encerra a partida com vencedor", () => {
    const state: DuelState = {
      round: 5,
      sideA: team("a", [combatant(1, "a1", 30, { speed: 10 })]),
      sideB: team("b", [combatant(1, "b1", 100, { speed: 99 })]),
    };

    const r = resolveRound({
      state,
      actionA: { userId: "a", type: "MOVE", cardSlot: 0 },
      actionB: { userId: "b", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng,
    });

    expect(r.finished).toBe(true);
    expect(r.winnerId).toBe("b");
  });
});

describe("applyForcedSwitch — troca forçada", () => {
  const downed = (): DuelState => ({
    round: 4,
    sideA: team(
      "a",
      [combatant(1, "a1", 100, { fainted: true }), combatant(2, "a2", 100), combatant(3, "a3", 100)],
      1
    ),
    sideB: team("b", [combatant(1, "b1", 100)]),
  });

  it("auto-promove o 1º vivo quando não veio escolha (timeout)", () => {
    const r = applyForcedSwitch({ state: downed(), choiceA: null, choiceB: null });
    expect(r.state.sideA.activeSlot).toBe(2);
    expect(r.finished).toBe(false);
    expect(r.state.round).toBe(5);
    expect(r.events.some((e) => e.type === "switch")).toBe(true);
  });

  it("respeita a escolha válida do jogador", () => {
    const r = applyForcedSwitch({ state: downed(), choiceA: 3, choiceB: null });
    expect(r.state.sideA.activeSlot).toBe(3);
  });

  it("escolha inválida (desmaiado) cai no auto (1º vivo)", () => {
    const r = applyForcedSwitch({ state: downed(), choiceA: 1, choiceB: null }); // slot 1 está desmaiado
    expect(r.state.sideA.activeSlot).toBe(2);
  });
});
