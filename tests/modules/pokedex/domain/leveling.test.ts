import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  XP_PER_LEVEL,
  applyXp,
  calcHp,
  calcStat,
  deriveStats,
  skillPowerMult,
  xpForNextLevel,
  type BaseStats,
} from "@/src/modules/pokedex/domain/leveling";

// Base stats do Charizard (a mesma referência do comentário em battle/stats).
const charizard: BaseStats = { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 };

describe("deriveStats / fórmula da §6", () => {
  it("bate com a fórmula oficial no nível 50 (o antigo BATTLE_LEVEL)", () => {
    // HP = floor(2*78*50/100) + 50 + 10 = 78 + 60 = 138
    expect(calcHp(78, 50)).toBe(138);
    // atk = floor(2*84*50/100) + 5 = 84 + 5 = 89
    expect(calcStat(84, 50)).toBe(89);
  });

  it("nível 1 é o piso da coleção (captura nasce nv.1)", () => {
    // HP = floor(2*78*1/100) + 1 + 10 = 1 + 11 = 12
    expect(calcHp(78, 1)).toBe(12);
    // atk = floor(2*84*1/100) + 5 = 1 + 5 = 6
    expect(calcStat(84, 1)).toBe(6);
  });

  it("stat cresce monotonicamente com o nível", () => {
    let prev = -1;
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      const s = deriveStats(charizard, lv);
      expect(s.hp).toBeGreaterThan(prev);
      prev = s.hp;
    }
  });

  it("mapeia todas as 6 base stats pros nomes de batalha", () => {
    const s = deriveStats(charizard, 50);
    expect(s).toEqual({
      hp: 138,
      attack: 89,
      defense: 83,
      specialAttack: 114,
      specialDefense: 90,
      speed: 105,
    });
  });

  it("prende nível fora de [1,100] em vez de estourar (entrada não confiável)", () => {
    expect(calcHp(78, 0)).toBe(calcHp(78, 1));
    expect(calcHp(78, 999)).toBe(calcHp(78, MAX_LEVEL));
    expect(calcStat(84, NaN)).toBe(calcStat(84, 1));
  });
});

describe("xpForNextLevel", () => {
  it("é linear no nível e +∞ no teto (não sobe além de 100)", () => {
    expect(xpForNextLevel(1)).toBe(XP_PER_LEVEL);
    expect(xpForNextLevel(4)).toBe(XP_PER_LEVEL * 4);
    expect(xpForNextLevel(MAX_LEVEL)).toBe(Infinity);
  });
});

describe("applyXp", () => {
  it("acumula sem subir quando falta XP", () => {
    // custo L1→L2 = 25; 10 não chega
    expect(applyXp(1, 0, 10)).toEqual({ level: 1, xp: 10, gained: 0 });
  });

  it("sobe um nível e guarda o resto", () => {
    // 25 sobe pra 2, sobra 5
    expect(applyXp(1, 20, 10)).toEqual({ level: 2, xp: 5, gained: 1 });
  });

  it("sobe múltiplos níveis de uma vez (o tempo só passa quando alguém olha)", () => {
    // L1→L2=25, L2→L3=50: total 75 leva do nível 1 ao 3
    expect(applyXp(1, 0, 75)).toEqual({ level: 3, xp: 0, gained: 2 });
  });

  it("satura no teto e descarta o excedente", () => {
    const r = applyXp(MAX_LEVEL, 0, 999999);
    expect(r.level).toBe(MAX_LEVEL);
    expect(r.xp).toBe(0);
    expect(r.gained).toBe(0);
  });

  it("ignora ganho negativo/lixo em vez de regredir", () => {
    expect(applyXp(3, 10, -100)).toEqual({ level: 3, xp: 10, gained: 0 });
  });
});

describe("skillPowerMult", () => {
  it("é 1.0 no nível 1 e escala linear com k", () => {
    expect(skillPowerMult(1)).toBe(1);
    expect(skillPowerMult(11, 0.02)).toBeCloseTo(1.2);
  });
});
