import { describe, expect, it } from "vitest";
import { resolveRound } from "@/src/modules/battle/domain/duelEngine";
import { ENERGY_MAX, ENERGY_START } from "@/src/modules/battle/domain/energy";
import type { DuelState } from "@/src/modules/battle/domain/duelTypes";
import { makeMon, makeMove } from "./testFixtures";

// A energia é o 2º limitador do turno (o PP é o 1º). O que só quebra jogando:
// ficar sem energia NÃO pode virar derrota por abandono, e a troca não pode
// virar recarga.

const typeChart = { normal: {} };

/** rng fixo em 0.5: acerta, não critica, e o desempate de Speed é estável. */
const rng = () => 0.5;

function state(over: { energyA?: number; energyB?: number; movesA?: ReturnType<typeof makeMove>[] } = {}): DuelState {
  return {
    round: 1,
    sideA: {
      userId: "alpha",
      activeSlot: 1,
      energy: over.energyA ?? ENERGY_START,
      team: [makeMon({ moves: over.movesA ?? [makeMove({ power: 40 })] })],
    },
    sideB: {
      userId: "beta",
      activeSlot: 1,
      energy: over.energyB ?? ENERGY_START,
      team: [makeMon({ moves: [makeMove({ power: 40 })] })],
    },
  };
}

const move = (userId: string, cardSlot = 0) => ({ userId, type: "MOVE" as const, cardSlot });

describe("gasto de energia", () => {
  it("desconta o custo da carta usada", () => {
    const r = resolveRound({
      state: state({ energyA: 3, energyB: 3 }),
      actionA: move("alpha"),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    // Gastou 1 (carta de poder 40) e o round devolveu 1 → volta pra 3.
    expect(r.state.sideA.energy).toBe(3);
    // Quem não jogou não gasta, mas regenera.
    expect(r.state.sideB.energy).toBe(ENERGY_MAX >= 4 ? 4 : ENERGY_MAX);
  });

  it("a carta cara custa mais e o saldo desce de verdade", () => {
    const r = resolveRound({
      state: state({ energyA: 3, movesA: [makeMove({ power: 120 })] }), // custa 3
      actionA: move("alpha"),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    // 3 - 3 = 0, mais o regen do round = 1.
    expect(r.state.sideA.energy).toBe(1);
  });

  it("cobra mesmo quando o golpe ERRA — igual ao PP", () => {
    const erra = () => 0.99; // rolagem de precisão alta = erro
    const r = resolveRound({
      state: state({ energyA: 3, movesA: [makeMove({ power: 120, accuracy: 50 })] }),
      actionA: move("alpha"),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng: erra,
    });

    expect(r.state.sideA.energy).toBe(1); // 3 - 3 + 1
  });
});

describe("sem energia", () => {
  it("carta cara com OUTRA pagável na mão vira hesitação, não jogada", () => {
    const r = resolveRound({
      state: state({
        energyA: 1,
        movesA: [makeMove({ power: 120 }), makeMove({ power: 40 })], // 3 e 1
      }),
      actionA: move("alpha", 0), // escolheu a cara
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    expect(r.events.some((e) => e.type === "hesitate" && e.userId === "alpha")).toBe(true);
    // Hesitou: não gastou nada além do regen do round.
    expect(r.state.sideA.energy).toBe(2);
  });

  it("NENHUMA carta pagável cai em STRUGGLE, e não em derrota por inação", () => {
    // Este é o caso que mais importa: sem o ramo do struggle, ficar sem energia
    // seria não ter ação — e não ter ação, três vezes, é abandono.
    const r = resolveRound({
      state: state({ energyA: 0, movesA: [makeMove({ power: 120 })] }),
      actionA: move("alpha", 0),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    const atacou = r.events.some((e) => e.type === "attack" && e.userId === "alpha");
    expect(atacou).toBe(true);
    // Struggle custa 0 — sobra só o regen.
    expect(r.state.sideA.energy).toBe(1);
  });
});

describe("regeneração", () => {
  it("devolve 1 por round, pros DOIS lados", () => {
    const r = resolveRound({
      state: state({ energyA: 1, energyB: 2 }),
      actionA: { userId: "alpha", type: "NONE" },
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    expect(r.state.sideA.energy).toBe(2);
    expect(r.state.sideB.energy).toBe(3);
  });

  it("respeita o teto", () => {
    const r = resolveRound({
      state: state({ energyA: ENERGY_MAX, energyB: ENERGY_MAX }),
      actionA: { userId: "alpha", type: "NONE" },
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    expect(r.state.sideA.energy).toBe(ENERGY_MAX);
  });

  it("TROCAR não recarrega — trocar é escolha, não fuga", () => {
    const comReserva: DuelState = {
      ...state({ energyA: 1 }),
      sideA: {
        userId: "alpha",
        activeSlot: 1,
        energy: 1,
        team: [makeMon({ slot: 1 }), makeMon({ slot: 2, name: "reserva" })],
      },
    };

    const r = resolveRound({
      state: comReserva,
      actionA: { userId: "alpha", type: "SWITCH", targetSlot: 2 },
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    // Só o regen do round (1 → 2). Se a troca recarregasse, ficar sem energia
    // deixaria de ter consequência.
    expect(r.state.sideA.energy).toBe(2);
  });
});

describe("partida antiga (sem a coluna)", () => {
  it("energia ausente é lida como ENERGY_START, sem quebrar", () => {
    const antigo = state();
    delete antigo.sideA.energy;
    delete antigo.sideB.energy;

    const r = resolveRound({
      state: antigo,
      actionA: { userId: "alpha", type: "NONE" },
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng,
    });

    expect(r.state.sideA.energy).toBe(Math.min(ENERGY_MAX, ENERGY_START + 1));
  });
});
