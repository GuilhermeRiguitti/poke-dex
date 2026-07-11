import { describe, expect, it } from "vitest";
import { resolveTurn } from "./engine";
import { makeMon, makeMove, makeSide, makeState, sequenceRng, throwingRng } from "./testFixtures";
import { TypeEffectivenessMap } from "./typeChart";

const neutralChart: TypeEffectivenessMap = {};

describe("resolveTurn — ordem de ação", () => {
  it("prioridade de move decide a ordem mesmo com velocidade menor", () => {
    const quickMove = makeMove({ name: "quick", damageClass: "status", power: null, priority: 1 });
    const slowMove = makeMove({ name: "slow", damageClass: "status", power: null, priority: 0 });

    const state = makeState({
      sideA: makeSide({ team: [makeMon({ moves: [quickMove], stats: { hp: 100, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 10 } })] }),
      sideB: makeSide({ team: [makeMon({ moves: [slowMove], stats: { hp: 100, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 100 } })] }),
    });

    const { events } = resolveTurn({
      state,
      actionA: { type: "MOVE", moveSlot: 0 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(), // prioridades diferentes: não deve haver desempate por rng
    });

    const attackEvents = events.filter((e) => e.type === "attack");
    expect(attackEvents[0]).toMatchObject({ side: "A", moveName: "quick" });
    expect(attackEvents[1]).toMatchObject({ side: "B", moveName: "slow" });
  });

  it("empate de prioridade e velocidade é decidido pelo rng", () => {
    const move = makeMove({ damageClass: "status", power: null });
    const baseState = () =>
      makeState({
        sideA: makeSide({ team: [makeMon({ moves: [move] })] }),
        sideB: makeSide({ team: [makeMon({ moves: [move] })] }),
      });

    const resultA = resolveTurn({
      state: baseState(),
      actionA: { type: "MOVE", moveSlot: 0 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: sequenceRng([0]), // < 0.5 -> A primeiro
    });
    expect(resultA.events.filter((e) => e.type === "attack")[0]).toMatchObject({ side: "A" });

    const resultB = resolveTurn({
      state: baseState(),
      actionA: { type: "MOVE", moveSlot: 0 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: sequenceRng([0.9]), // >= 0.5 -> B primeiro
    });
    expect(resultB.events.filter((e) => e.type === "attack")[0]).toMatchObject({ side: "B" });
  });

  it("trocar consome o turno — quem trocou não ataca", () => {
    const attackMove = makeMove({ name: "hit", damageClass: "status", power: null });
    const state = makeState({
      sideA: makeSide({
        activeSlot: 1,
        team: [makeMon({ slot: 1, name: "mon-1" }), makeMon({ slot: 2, name: "mon-2" })],
      }),
      sideB: makeSide({ team: [makeMon({ moves: [attackMove] })] }),
    });

    const { events, state: newState } = resolveTurn({
      state,
      actionA: { type: "SWITCH", toSlot: 2 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });

    expect(newState.sideA.activeSlot).toBe(2);
    expect(events.find((e) => e.type === "switch")).toMatchObject({ side: "A", toSlot: 2 });
    expect(events.filter((e) => e.type === "attack")).toHaveLength(1);
    expect(events.filter((e) => e.type === "attack")[0]).toMatchObject({ side: "B" });
  });
});

describe("resolveTurn — fainting e vencedor", () => {
  it("desmaia o defensor e declara o vencedor quando o time inteiro cai", () => {
    const finisher = makeMove({ name: "finisher", type: "fire", power: 80, accuracy: 100, damageClass: "physical" });
    const passiveMove = makeMove({ name: "passive", damageClass: "status", power: null });

    const state = makeState({
      sideA: makeSide({
        team: [makeMon({ moves: [finisher], stats: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 } })],
      }),
      sideB: makeSide({
        team: [makeMon({ currentHp: 1, moves: [passiveMove], stats: { hp: 50, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 1 } })],
      }),
    });

    const { state: newState, winner, events } = resolveTurn({
      state,
      actionA: { type: "MOVE", moveSlot: 0 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: sequenceRng([0, 0.5, 0]), // hit, sem crit, variância mínima — só o ataque de A consome rng
    });

    expect(newState.sideB.team[0].fainted).toBe(true);
    expect(newState.sideB.team[0].currentHp).toBe(0);
    expect(winner).toBe("A");
    // B desmaiou antes de agir, então não deve haver evento de ataque do lado B
    expect(events.filter((e) => e.type === "attack" && e.side === "B")).toHaveLength(0);
  });

  it("needsSwitch fica true quando o ativo desmaia mas o time ainda tem sobreviventes", () => {
    const finisher = makeMove({ name: "finisher", type: "fire", power: 80, accuracy: 100, damageClass: "physical" });
    const passiveMove = makeMove({ name: "passive", damageClass: "status", power: null });

    const state = makeState({
      sideA: makeSide({
        team: [
          makeMon({ slot: 1, currentHp: 1, moves: [passiveMove], stats: { hp: 50, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 1 } }),
          makeMon({ slot: 2, currentHp: 50, maxHp: 50 }),
        ],
        activeSlot: 1,
      }),
      sideB: makeSide({
        team: [makeMon({ moves: [finisher], stats: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 } })],
      }),
    });

    const { winner, needsSwitch } = resolveTurn({
      state,
      actionA: { type: "MOVE", moveSlot: 0 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: sequenceRng([0, 0.5, 0]),
    });

    expect(winner).toBeNull();
    expect(needsSwitch.A).toBe(true);
    expect(needsSwitch.B).toBe(false);
  });

  it("um pokémon já desmaiado nunca ataca, mesmo se a ação enviada for MOVE", () => {
    const move = makeMove({ damageClass: "status", power: null });
    // sideA já está desmaiado (estado inválido de ficar sem SWITCH antes do turno,
    // mas o motor precisa se defender dele de qualquer forma): nem A consegue agir
    // (sanitizeAction), nem B "ataca" um alvo que já caiu.
    const state = makeState({
      sideA: makeSide({ team: [makeMon({ fainted: true, currentHp: 0, moves: [move] })] }),
      sideB: makeSide({ team: [makeMon({ moves: [move] })] }),
    });

    const { events } = resolveTurn({
      state,
      actionA: { type: "MOVE", moveSlot: 0 },
      actionB: { type: "MOVE", moveSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });

    expect(events.some((e) => e.type === "attack")).toBe(false);
  });
});
