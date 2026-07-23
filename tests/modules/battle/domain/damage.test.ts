import { describe, expect, it } from "vitest";
import { calculateDamage } from "@/src/modules/battle/domain/damage";
import { makeMon, makeMove, sequenceRng } from "./testFixtures";

// attacker: level 50, attack 100, tipo "fire"; defender: defense 100, tipo variável
// base = floor(floor(2*50/5+2) * power * atk/def / 50) + 2
//      = floor(22 * 80 * 1 / 50) + 2 = floor(35.2) + 2 = 37
// variance fixa em 0.85 (rng=0), sem crit (rng=0.5 >= 1/16)

describe("calculateDamage", () => {
  const attacker = makeMon({ types: ["fire"], stats: { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 50 } });
  const move = makeMove({ type: "fire", power: 80, accuracy: 100, damageClass: "physical" });

  it("aplica STAB (1.5x) quando o tipo do move é um dos tipos do atacante", () => {
    const defender = makeMon({ types: ["normal"] }); // efetividade 1 (não testada aqui)
    const rng = sequenceRng([0, 0.5, 0]); // hit, sem crit, variância mínima
    const result = calculateDamage({ attacker, defender, move, effectiveness: 1, rng });
    // 37 * 1.5(STAB) * 1(efet.) * 0.85(var) * 1(sem crit) = 47.175 -> 47
    expect(result.damage).toBe(47);
    expect(result.missed).toBe(false);
    expect(result.isCrit).toBe(false);
  });

  it("não aplica STAB quando o tipo do move não é do atacante", () => {
    const nonStabAttacker = makeMon({ types: ["water"] });
    const defender = makeMon({ types: ["normal"] });
    const rng = sequenceRng([0, 0.5, 0]);
    const result = calculateDamage({ attacker: nonStabAttacker, defender, move, effectiveness: 1, rng });
    // 37 * 1(sem STAB) * 1 * 0.85 * 1 = 31.45 -> 31
    expect(result.damage).toBe(31);
  });

  it("escala com a efetividade de tipo (2x super efetivo)", () => {
    const defender = makeMon({ types: ["normal"] });
    const rng = sequenceRng([0, 0.5, 0]);
    const result = calculateDamage({ attacker, defender, move, effectiveness: 2, rng });
    // 37 * 1.5 * 2 * 0.85 * 1 = 94.35 -> 94
    expect(result.damage).toBe(94);
  });

  it("zera o dano quando o alvo é imune (0x)", () => {
    const defender = makeMon({ types: ["normal"] });
    const rng = sequenceRng([0]); // só consome o roll de accuracy, imunidade sai antes de crit/variância
    const result = calculateDamage({ attacker, defender, move, effectiveness: 0, rng });
    expect(result.damage).toBe(0);
    expect(result.missed).toBe(false);
  });

  it("erra o ataque quando o roll de accuracy falha", () => {
    const lowAccuracyMove = makeMove({ type: "fire", power: 80, accuracy: 50, damageClass: "physical" });
    const defender = makeMon({ types: ["normal"] });
    const rng = sequenceRng([0.9]); // 0.9*100=90 >= 50 -> miss, só 1 roll consumido
    const result = calculateDamage({ attacker, defender, move: lowAccuracyMove, effectiveness: 1, rng });
    expect(result.missed).toBe(true);
    expect(result.damage).toBe(0);
  });

  it("aplica multiplicador de crítico (1.5x)", () => {
    const defender = makeMon({ types: ["normal"] });
    const rng = sequenceRng([0, 0.01, 0]); // hit, crit (0.01 < 1/16), variância mínima
    const result = calculateDamage({ attacker, defender, move, effectiveness: 1, rng });
    // 37 * 1.5(STAB) * 1 * 0.85 * 1.5(crit) = 70.7625 -> 70
    expect(result.isCrit).toBe(true);
    expect(result.damage).toBe(70);
  });

  it("moves de status não causam dano nem consomem rng", () => {
    const statusMove = makeMove({ damageClass: "status", power: null });
    const defender = makeMon({ types: ["normal"] });
    const rng = sequenceRng([]); // nenhuma chamada esperada
    const result = calculateDamage({ attacker, defender, move: statusMove, effectiveness: 1, rng });
    expect(result.damage).toBe(0);
    expect(result.missed).toBe(false);
  });

  it("move de status reporta efetividade neutra, mesmo que o tipo seria super efetivo", () => {
    // hypnosis (psychic) vs poison seria 2x, mas status não causa dano: efetividade
    // não se aplica. Reportar 2 fazia o log dizer "0 de dano, super eficaz".
    const statusMove = makeMove({ type: "psychic", damageClass: "status", power: null });
    const defender = makeMon({ types: ["poison"] });
    const rng = sequenceRng([]);
    const result = calculateDamage({ attacker, defender, move: statusMove, effectiveness: 2, rng });
    expect(result.damage).toBe(0);
    expect(result.effectiveness).toBe(1);
  });
});
