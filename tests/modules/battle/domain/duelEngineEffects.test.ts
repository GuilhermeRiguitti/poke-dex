import { describe, expect, it } from "vitest";
import { resolveRound } from "@/src/modules/battle/domain/duelEngine";
import { conditionsOf } from "@/src/modules/battle/domain/conditions";
import { activeOf, type DuelSide, type DuelState } from "@/src/modules/battle/domain/duelTypes";
import type { DuelEvent } from "@/src/modules/battle/domain/duelTypes";
import { TypeEffectivenessMap } from "@/src/modules/battle/domain/typeChart";
import type { BattleMoveDef } from "@/src/modules/battle/domain/types";
import { makeEffect, makeMon, makeMove, sequenceRng, throwingRng } from "./testFixtures";

// O turno com EFEITOS: status, stat stage, dreno, recuo, semente, recuo de turno.
//
// Os golpes daqui têm `accuracy: null` e chance 100 de propósito: assim o round
// inteiro roda sem consumir rng nenhum, e o `throwingRng` vira a prova de que o
// resultado veio da REGRA, e não de um sorteio escondido. Onde o sorteio é o
// ponto (paralisia travando, efeito secundário de 10%), a sequência é explícita.

const neutralChart: TypeEffectivenessMap = {};

/** Carta de status que nunca erra — o "sempre acontece" das provas abaixo. */
function statusMove(name: string, effect: BattleMoveDef["effect"]): BattleMoveDef {
  return makeMove({ name, damageClass: "status", power: null, accuracy: null, effect });
}

/** Carta de dano que nunca erra. */
function hitMove(over: Partial<BattleMoveDef> = {}): BattleMoveDef {
  return makeMove({ name: "tackle", power: 100, damageClass: "physical", accuracy: null, ...over });
}

/** Atributos redondos com Velocidade explícita — empate de Speed sortearia, e o
 *  sorteio consumiria rng, estragando a prova do `throwingRng`. */
function stats(speed: number) {
  return { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed };
}

function side(userId: string, moves: BattleMoveDef[], over: Parameters<typeof makeMon>[0] = {}): DuelSide {
  return { userId, activeSlot: 1, team: [makeMon({ slot: 1, moves, stats: stats(90), ...over })] };
}

function duel(a: DuelSide, b: DuelSide): DuelState {
  return { round: 1, sideA: a, sideB: b };
}

/** O oponente que não faz nada: carta inerte e mais lento, pra a ordem ser fixa. */
const espera = (userId: string): DuelSide => side(userId, [statusMove("wait", null)], { stats: stats(10) });

function play(state: DuelState, rng: () => number, cardA = 0, cardB = 0) {
  return resolveRound({
    state,
    actionA: { userId: state.sideA.userId, type: "MOVE", cardSlot: cardA },
    actionB: { userId: state.sideB.userId, type: "MOVE", cardSlot: cardB },
    typeChart: neutralChart,
    rng,
  });
}

const eventsOf = <T extends DuelEvent["type"]>(events: DuelEvent[], type: T) =>
  events.filter((e): e is Extract<DuelEvent, { type: T }> => e.type === type);

describe("golpe de status — a carta que antes não fazia nada", () => {
  it("paralisa o oponente, sem causar dano", () => {
    const state = duel(side("a", [statusMove("thunder-wave", makeEffect({ ailment: "paralysis" }))]), espera("b"));
    // A rola nada; B, JÁ paralisado quando chega a vez dele, rola o "travou?".
    const r = play(state, sequenceRng([0.9]));

    const alvo = activeOf(r.state.sideB);
    expect(conditionsOf(alvo).status).toBe("paralysis");
    expect(alvo.currentHp).toBe(100);
    expect(eventsOf(r.events, "ailment")).toHaveLength(1);
  });

  it("sobe o atributo de QUEM USA e o dano do turno seguinte sente", () => {
    const dance = statusMove("swords-dance", makeEffect({ stageChanges: [{ stat: "attack", change: 2 }], stageTarget: "self" }));
    const state = duel(side("a", [dance, hitMove()]), espera("b"));

    // 1º turno: dança. 2º turno: bate com o Ataque dobrado (rng fixo nos dois).
    const r1 = play(state, () => 0.5, 0, 0);
    expect(conditionsOf(activeOf(r1.state.sideA)).stages.attack).toBe(2);

    const comBuff = play(r1.state, () => 0.5, 1, 0);
    const semBuff = play(duel(side("a", [dance, hitMove()]), espera("b")), () => 0.5, 1, 0);

    const dano = (r: ReturnType<typeof play>) => 100 - activeOf(r.state.sideB).currentHp;
    expect(dano(comBuff)).toBeGreaterThan(dano(semBuff));
  });

  it("não pega em quem é imune por tipo — e o log DIZ o porquê", () => {
    const state = duel(
      side("a", [statusMove("thunder-wave", makeEffect({ ailment: "paralysis" }))]),
      side("b", [statusMove("wait", null)], { types: ["electric"], stats: stats(10) })
    );
    const r = play(state, throwingRng());

    expect(conditionsOf(activeOf(r.state.sideB)).status).toBeNull();
    expect(eventsOf(r.events, "ailment")[0].blocked).toBe("immune");
  });

  it("cura quem usou, e a cura para no HP máximo", () => {
    const recover = statusMove("recover", makeEffect({ healPct: 50 }));
    const state = duel(side("a", [recover], { maxHp: 100, currentHp: 30 }), espera("b"));
    const r = play(state, throwingRng());

    expect(activeOf(r.state.sideA).currentHp).toBe(80);
    expect(eventsOf(r.events, "tick")[0]).toMatchObject({ source: "heal", hp: 50 });
  });
});

describe("efeito secundário de golpe de dano", () => {
  it("só acontece quando o golpe CONECTA (errou = não queima)", () => {
    // precisão 50 pra o mesmo rng poder acertar e errar; queima 100% do que acerta.
    const ember = hitMove({ name: "ember", accuracy: 50, effect: makeEffect({ ailment: "burn" }) });
    const state = duel(side("a", [ember]), espera("b"));

    const errou = play(state, sequenceRng([0.9])); // 0.9*100 = 90 >= 50 → errou
    expect(eventsOf(errou.events, "attack")[0].missed).toBe(true);
    expect(conditionsOf(activeOf(errou.state.sideB)).status).toBeNull();

    // acertou (precisão), sem crítico, variância baixa → queima
    const acertou = play(state, sequenceRng([0.1, 0.9, 0.1]));
    expect(conditionsOf(activeOf(acertou.state.sideB)).status).toBe("burn");
  });

  it("dreno devolve HP a quem usou; recuo cobra", () => {
    const absorb = hitMove({ name: "absorb", effect: makeEffect({ drainPct: 50 }) });
    const state = duel(side("a", [absorb], { maxHp: 100, currentHp: 20 }), espera("b"));
    const r = play(state, sequenceRng([0.9, 0.5]));

    const eu = activeOf(r.state.sideA);
    const dano = 100 - activeOf(r.state.sideB).currentHp;
    expect(eu.currentHp).toBe(20 + Math.floor(dano / 2));

    const takeDown = hitMove({ name: "take-down", effect: makeEffect({ drainPct: -25 }) });
    const rr = play(duel(side("a", [takeDown], { maxHp: 100, currentHp: 100 }), espera("b")), sequenceRng([0.9, 0.5]));
    expect(activeOf(rr.state.sideA).currentHp).toBeLessThan(100);
    expect(eventsOf(rr.events, "tick")[0].source).toBe("recoil");
  });

  it("golpe de múltiplos acertos bate mais de uma vez e o log conta quantas", () => {
    const doubleKick = hitMove({ name: "double-kick", power: 30, effect: makeEffect({ minHits: 2, maxHits: 2 }) });
    const state = duel(side("a", [doubleKick]), espera("b"));
    // 1º acerto: crit + variância. 2º acerto: crit + variância (a precisão é uma só).
    const r = play(state, sequenceRng([0.9, 0.5, 0.9, 0.5]));

    expect(eventsOf(r.events, "attack")[0].hits).toBe(2);
  });
});

describe("condições cobrando o preço", () => {
  it("queimadura tira HP no FIM do turno", () => {
    const state = duel(side("a", [statusMove("wait", null)], { maxHp: 160 }), espera("b"));
    conditionsOf(state.sideA.team[0]).status = "burn";

    const r = play(state, throwingRng());
    expect(activeOf(r.state.sideA).currentHp).toBe(160 - 10); // 1/16
    expect(eventsOf(r.events, "tick")[0]).toMatchObject({ source: "burn", hp: -10 });
  });

  it("semente drena de um lado e devolve pro outro", () => {
    const state = duel(
      side("a", [statusMove("wait", null)], { maxHp: 80 }),
      side("b", [statusMove("wait", null)], { maxHp: 100, currentHp: 50, stats: stats(10) })
    );
    conditionsOf(state.sideA.team[0]).seeded = true;

    const r = play(state, throwingRng());
    expect(activeOf(r.state.sideA).currentHp).toBe(70);
    expect(activeOf(r.state.sideB).currentHp).toBe(60);
  });

  it("dormindo perde o turno inteiro — e nem gasta PP", () => {
    const state = duel(side("a", [hitMove({ currentPp: 10 })]), espera("b"));
    const c = conditionsOf(state.sideA.team[0]);
    c.status = "sleep";
    c.sleepTurns = 2;

    const r = play(state, throwingRng());
    expect(eventsOf(r.events, "blocked")[0].reason).toBe("sleep");
    expect(eventsOf(r.events, "attack").filter((e) => e.userId === "a")).toHaveLength(0);
    expect(activeOf(r.state.sideA).moves[0].currentPp).toBe(10);
    expect(activeOf(r.state.sideB).currentHp).toBe(100);
  });

  it("o recuo (flinch) do MAIS RÁPIDO tira o turno do mais lento", () => {
    const fakeOut = hitMove({ name: "fake-out", power: 40, effect: makeEffect({ flinchChance: 100 }) });
    const rapido = side("a", [fakeOut], { stats: stats(200) });
    const lento = side("b", [hitMove()], { stats: stats(10) });

    // rápido: crit + variância + flinch. lento: nem chega a rolar.
    const r = play(duel(rapido, lento), sequenceRng([0.9, 0.5, 0.1]));

    expect(eventsOf(r.events, "blocked")[0]).toMatchObject({ targetUserId: "b", reason: "flinch" });
    expect(activeOf(r.state.sideA).currentHp).toBe(100); // o lento não bateu
    // e o recuo NÃO sobra pro próximo turno
    expect(conditionsOf(activeOf(r.state.sideB)).flinched).toBe(false);
  });

  it("paralisia trava o turno quando o sorteio manda", () => {
    const state = duel(side("a", [hitMove()]), espera("b"));
    conditionsOf(state.sideA.team[0]).status = "paralysis";

    const travou = play(state, sequenceRng([0.1]));
    expect(eventsOf(travou.events, "blocked")[0].reason).toBe("paralysis");
    expect(activeOf(travou.state.sideB).currentHp).toBe(100);
  });
});

describe("a troca como resposta ao debuff", () => {
  it("quem sai de campo larga os estágios, mas leva o status junto", () => {
    const time: DuelSide = {
      userId: "a",
      activeSlot: 1,
      team: [makeMon({ slot: 1, moves: [hitMove()] }), makeMon({ slot: 2, name: "reserva", moves: [hitMove()] })],
    };
    const c = conditionsOf(time.team[0]);
    c.stages.attack = -4;
    c.status = "poison";

    const r = resolveRound({
      state: duel(time, espera("b")),
      actionA: { userId: "a", type: "SWITCH", targetSlot: 2 },
      actionB: { userId: "b", type: "MOVE", cardSlot: 0 },
      typeChart: neutralChart,
      rng: throwingRng(),
    });

    const saiu = r.state.sideA.team[0];
    expect(conditionsOf(saiu).stages.attack).toBe(0);
    expect(conditionsOf(saiu).status).toBe("poison");
  });
});
