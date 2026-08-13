import { describe, expect, it } from "vitest";
import {
  accuracyStageMultiplier,
  actionGate,
  ailmentBlockedBy,
  applyAilment,
  applyStageChanges,
  clearVolatiles,
  conditionsOf,
  effectiveSpeed,
  effectiveStat,
  emptyConditions,
  leechDamage,
  normalizeConditions,
  residualDamage,
  stageMultiplier,
} from "@/src/modules/battle/domain/conditions";
import { makeMon, sequenceRng, throwingRng } from "./testFixtures";

const semTurnos = { ailmentMinTurns: null, ailmentMaxTurns: null };

describe("stat stages", () => {
  it("segue a tabela da série: +2 é ×2, -2 é ÷2, e o teto é ±6", () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(stageMultiplier(6)).toBe(4);
    expect(stageMultiplier(99)).toBe(4); // clampado
    expect(stageMultiplier(-99)).toBe(0.25);
  });

  it("precisão/evasão usam a tabela de base 3, que é mais fraca", () => {
    expect(accuracyStageMultiplier(1)).toBeCloseTo(4 / 3);
    expect(accuracyStageMultiplier(-1)).toBeCloseTo(3 / 4);
  });

  it("aplicar estágio devolve o que MUDOU DE FATO — no teto, delta 0", () => {
    const mon = makeMon();
    expect(applyStageChanges(mon, [{ stat: "attack", change: 2 }])).toEqual([{ stat: "attack", delta: 2, stage: 2 }]);
    applyStageChanges(mon, [{ stat: "attack", change: 4 }]);
    expect(applyStageChanges(mon, [{ stat: "attack", change: 2 }])).toEqual([{ stat: "attack", delta: 0, stage: 6 }]);
  });

  it("o atributo efetivo é o que o dano usa (ataque 100 com +2 vira 200)", () => {
    const mon = makeMon();
    applyStageChanges(mon, [{ stat: "attack", change: 2 }]);
    expect(effectiveStat(mon, "attack")).toBe(200);
  });
});

describe("status não-volátil", () => {
  it("queimadura corta o Ataque pela metade — e SÓ o físico", () => {
    const mon = makeMon();
    conditionsOf(mon).status = "burn";
    expect(effectiveStat(mon, "attack")).toBe(50);
    expect(effectiveStat(mon, "specialAttack")).toBe(100);
  });

  it("paralisia corta a Velocidade pela metade (é o que muda a ordem do turno)", () => {
    const mon = makeMon({ stats: { hp: 100, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 80 } });
    expect(effectiveSpeed(mon)).toBe(80);
    conditionsOf(mon).status = "paralysis";
    expect(effectiveSpeed(mon)).toBe(40);
  });

  it("um por vez: quem já tem status não pega outro", () => {
    const mon = makeMon();
    applyAilment(mon, "burn", semTurnos, throwingRng());
    expect(ailmentBlockedBy(mon, "paralysis")).toBe("already");
  });

  it("o tipo dá imunidade: fogo não queima, elétrico não paralisa, veneno não envenena", () => {
    expect(ailmentBlockedBy(makeMon({ types: ["fire"] }), "burn")).toBe("immune");
    expect(ailmentBlockedBy(makeMon({ types: ["electric"] }), "paralysis")).toBe("immune");
    expect(ailmentBlockedBy(makeMon({ types: ["steel"] }), "poison")).toBe("immune");
    expect(ailmentBlockedBy(makeMon({ types: ["grass"] }), "leech-seed")).toBe("immune");
    expect(ailmentBlockedBy(makeMon({ types: ["fire"] }), "paralysis")).toBeNull();
  });

  it("o sono dura no máximo 3 turnos, mesmo quando a API pede 4", () => {
    const mon = makeMon();
    const aplicado = applyAilment(mon, "sleep", { ailmentMinTurns: 2, ailmentMaxTurns: 4 }, () => 0.99);
    expect(aplicado.turns).toBeLessThanOrEqual(3);
    expect(conditionsOf(mon).status).toBe("sleep");
  });
});

describe("actionGate — o portão antes do golpe", () => {
  it("pokémon limpo passa sem rolar NADA (o rng estoura se for tocado)", () => {
    expect(actionGate(makeMon(), throwingRng())).toEqual({ blockedBy: null, hitSelf: false, recovered: null });
  });

  it("dormindo perde o turno e o contador desce; no fim, acorda", () => {
    const mon = makeMon();
    applyAilment(mon, "sleep", { ailmentMinTurns: 2, ailmentMaxTurns: 2 }, () => 0);

    expect(actionGate(mon, throwingRng()).blockedBy).toBe("sleep");
    expect(conditionsOf(mon).sleepTurns).toBe(1);
    expect(actionGate(mon, throwingRng()).blockedBy).toBe("sleep");
    expect(conditionsOf(mon).status).toBeNull(); // acordou pro próximo turno
    expect(actionGate(mon, throwingRng()).blockedBy).toBeNull();
  });

  it("congelado só age quando descongela (20%)", () => {
    const mon = makeMon();
    conditionsOf(mon).status = "freeze";
    expect(actionGate(mon, sequenceRng([0.9])).blockedBy).toBe("freeze");
    const gate = actionGate(mon, sequenceRng([0.1]));
    expect(gate.blockedBy).toBeNull();
    expect(gate.recovered).toBe("freeze");
    expect(conditionsOf(mon).status).toBeNull();
  });

  it("paralisia trava 25% das vezes", () => {
    const mon = makeMon();
    conditionsOf(mon).status = "paralysis";
    expect(actionGate(mon, sequenceRng([0.1])).blockedBy).toBe("paralysis");
    expect(actionGate(mon, sequenceRng([0.9])).blockedBy).toBeNull();
  });

  it("recuo (flinch) come o turno e a confusão pode bater em quem está confuso", () => {
    const recuado = makeMon();
    conditionsOf(recuado).flinched = true;
    expect(actionGate(recuado, throwingRng()).blockedBy).toBe("flinch");

    const confuso = makeMon();
    applyAilment(confuso, "confusion", { ailmentMinTurns: 2, ailmentMaxTurns: 2 }, () => 0);
    const bateu = actionGate(confuso, sequenceRng([0.1]));
    expect(bateu).toMatchObject({ blockedBy: "confusion", hitSelf: true });
    expect(actionGate(confuso, sequenceRng([0.9])).blockedBy).toBeNull(); // 2/3 das vezes age
  });
});

describe("fim de turno", () => {
  it("queimadura tira 1/16 e veneno 1/8 do HP máximo", () => {
    const queimado = makeMon({ maxHp: 160 });
    conditionsOf(queimado).status = "burn";
    expect(residualDamage(queimado)).toBe(10);

    const envenenado = makeMon({ maxHp: 160 });
    conditionsOf(envenenado).status = "poison";
    expect(residualDamage(envenenado)).toBe(20);
  });

  it("nunca tira 0: com HP máximo baixo, o status ainda cobra 1", () => {
    const mon = makeMon({ maxHp: 8 });
    conditionsOf(mon).status = "burn";
    expect(residualDamage(mon)).toBe(1);
  });

  it("semente drena 1/8 de quem está plantado", () => {
    const mon = makeMon({ maxHp: 80 });
    expect(leechDamage(mon)).toBe(0);
    conditionsOf(mon).seeded = true;
    expect(leechDamage(mon)).toBe(10);
  });
});

describe("troca", () => {
  it("leva embora estágio, confusão, semente e recuo — mas NÃO o status", () => {
    const mon = makeMon();
    applyStageChanges(mon, [{ stat: "attack", change: -2 }]);
    applyAilment(mon, "confusion", semTurnos, () => 0);
    conditionsOf(mon).seeded = true;
    conditionsOf(mon).flinched = true;
    conditionsOf(mon).status = "burn";

    clearVolatiles(mon);

    const c = conditionsOf(mon);
    expect(c.stages.attack).toBe(0);
    expect(c.confusionTurns).toBe(0);
    expect(c.seeded).toBe(false);
    expect(c.flinched).toBe(false);
    expect(c.status).toBe("burn"); // esse vai junto com ele
  });
});

describe("normalizeConditions — a coluna anulável", () => {
  it("null, lixo e forma errada viram estado LIMPO (é o que dispensa backfill)", () => {
    expect(normalizeConditions(null)).toEqual(emptyConditions());
    expect(normalizeConditions("burn")).toEqual(emptyConditions());
    expect(normalizeConditions([1, 2])).toEqual(emptyConditions());
    expect(normalizeConditions({ status: "inventado" }).status).toBeNull();
  });

  it("lê o que é válido e clampa estágio fora da faixa", () => {
    const c = normalizeConditions({ status: "poison", stages: { attack: 99, speed: -2 }, seeded: true });
    expect(c.status).toBe("poison");
    expect(c.stages.attack).toBe(6);
    expect(c.stages.speed).toBe(-2);
    expect(c.seeded).toBe(true);
  });
});
