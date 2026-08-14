import { describe, expect, it } from "vitest";
import { resolveRound } from "@/src/modules/battle/domain/duelEngine";
import { protectChance } from "@/src/modules/battle/domain/conditions";
import type { DuelState } from "@/src/modules/battle/domain/duelTypes";
import { makeEffect, makeMon, makeMove, throwingRng } from "./testFixtures";

// PROTECT é a "mecânica reativa" do TODO — e o que a torna aceitável é ela ser
// escolhida ÀS CEGAS, no mesmo round, como qualquer outra carta. Não há janela
// de reação (que morreu junto com o turno alternado); há uma APOSTA.

const typeChart = { normal: {} };

const escudo = () => makeMove({ name: "protect", power: null, damageClass: "status", effect: makeEffect({ protects: true }) });
const soco = () => makeMove({ name: "tackle", power: 80 });

function state(movesA = [escudo()], movesB = [soco()]): DuelState {
  return {
    round: 1,
    sideA: { userId: "alpha", activeSlot: 1, energy: 6, team: [makeMon({ moves: movesA })] },
    sideB: { userId: "beta", activeSlot: 1, energy: 6, team: [makeMon({ moves: movesB })] },
  };
}

const move = (userId: string, cardSlot = 0) => ({ userId, type: "MOVE" as const, cardSlot });

describe("protect", () => {
  it("anula o golpe do oponente no turno", () => {
    const s = state();
    const hpAntes = s.sideA.team[0].currentHp;

    const r = resolveRound({
      state: s,
      actionA: move("alpha"), // escudo
      actionB: move("beta"), // soco
      typeChart,
      rng: () => 0.5,
    });

    expect(r.state.sideA.team[0].currentHp).toBe(hpAntes);
    expect(r.events.some((e) => e.type === "protect" && e.held)).toBe(true);
    expect(r.events.some((e) => e.type === "blocked" && e.reason === "protected")).toBe(true);
  });

  it("o atacante PERDE o turno e gasta PP e energia mesmo assim", () => {
    // É isso que dá sentido à aposta: proteger só vale porque o outro perde o
    // turno junto. Se o golpe bloqueado fosse devolvido de graça, protect seria
    // só um turno perdido pra quem protege.
    const s = state();
    const r = resolveRound({
      state: s,
      actionA: move("alpha"),
      actionB: move("beta"),
      typeChart,
      rng: () => 0.5,
    });

    expect(r.state.sideB.team[0].moves[0].currentPp).toBe(14); // gastou PP
    expect(r.state.sideB.energy).toBeLessThan(6 + 1); // gastou energia (e regenerou 1)
  });

  it("a 1ª proteção NÃO sorteia nada — o rng fica intocado", () => {
    // A suíte inteira do motor depende disso: quem não tem motivo não toca o
    // rng. Um sorteio incondicional aqui quebraria os testes determinísticos.
    const r = resolveRound({
      state: state([escudo()], [makeMove({ name: "splash", power: null, damageClass: "status" })]),
      actionA: move("alpha"),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng: throwingRng(),
    });

    expect(r.events.some((e) => e.type === "protect" && e.held)).toBe(true);
  });

  it("a chance cai pela metade a cada uso seguido", () => {
    expect(protectChance(0)).toBe(100);
    expect(protectChance(1)).toBe(50);
    expect(protectChance(2)).toBe(25);
  });

  it("proteger duas vezes seguidas pode FALHAR — e aí o golpe entra", () => {
    const s = state();
    // 1º turno: protege (sem rng).
    const r1 = resolveRound({
      state: s,
      actionA: move("alpha"),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng: () => 0.5,
    });
    expect(r1.state.sideA.team[0].conditions!.protectStreak).toBe(1);

    // 2º turno: chance 50, e o rng manda falhar (0.9 * 100 = 90 >= 50).
    const r2 = resolveRound({
      state: r1.state,
      actionA: move("alpha"),
      actionB: move("beta"),
      typeChart,
      rng: () => 0.9,
    });

    expect(r2.events.some((e) => e.type === "protect" && !e.held)).toBe(true);
    // Falhou → a sequência zera e o dano entrou.
    expect(r2.state.sideA.team[0].conditions!.protectStreak).toBe(0);
    expect(r2.state.sideA.team[0].currentHp).toBeLessThan(100);
  });

  it("fazer OUTRA coisa zera a sequência", () => {
    // Sem isto, daria pra alternar protect/ataque e a chance nunca cairia.
    const s = state([escudo(), soco()]);
    const r1 = resolveRound({
      state: s,
      actionA: move("alpha", 0), // escudo
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng: () => 0.5,
    });
    expect(r1.state.sideA.team[0].conditions!.protectStreak).toBe(1);

    const r2 = resolveRound({
      state: r1.state,
      actionA: move("alpha", 1), // atacou
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng: () => 0.5,
    });
    expect(r2.state.sideA.team[0].conditions!.protectStreak).toBe(0);
  });

  it("o escudo NÃO sobrevive ao turno seguinte", () => {
    const s = state();
    const r1 = resolveRound({
      state: s,
      actionA: move("alpha"),
      actionB: { userId: "beta", type: "NONE" },
      typeChart,
      rng: () => 0.5,
    });
    expect(r1.state.sideA.team[0].conditions!.protected).toBe(false);
  });
});
