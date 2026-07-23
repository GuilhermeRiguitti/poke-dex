import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  STARTING_LEVEL,
  FALLBACK_BASE_EXPERIENCE,
  applyXp,
  calcHp,
  calcStat,
  deriveStats,
  levelFromXp,
  xpForLevel,
  xpFromDefeat,
  xpToNextLevel,
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

  it("nível 1 é o piso absoluto da escala", () => {
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

describe("curva de XP (medium-fast: total = nível³)", () => {
  it("xpForLevel é n³", () => {
    expect(xpForLevel(1)).toBe(1);
    expect(xpForLevel(5)).toBe(125);
    expect(xpForLevel(10)).toBe(1000);
    expect(xpForLevel(MAX_LEVEL)).toBe(1_000_000);
  });

  it("levelFromXp é o inverso EXATO — inclusive nos limiares (cbrt em float mente)", () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      expect(levelFromXp(xpForLevel(lv))).toBe(lv);
      // 1 de XP a menos ainda é o nível anterior
      if (lv > 1) expect(levelFromXp(xpForLevel(lv) - 1)).toBe(lv - 1);
    }
  });

  it("o nível inicial da coleção casa com o XP inicial (a invariante do schema)", () => {
    expect(levelFromXp(xpForLevel(STARTING_LEVEL))).toBe(STARTING_LEVEL);
  });

  it("xpToNextLevel diz quanto falta, e 0 no teto", () => {
    expect(xpToNextLevel(125)).toBe(xpForLevel(6) - 125); // 216 - 125 = 91
    expect(xpToNextLevel(xpForLevel(MAX_LEVEL))).toBe(0);
  });
});

describe("xpFromDefeat — fórmula da série", () => {
  it("é baseExperience × nível do derrotado ÷ 7", () => {
    // Pikachu tem baseExperience 112 na API; derrotá-lo no nv.20 dá 320.
    expect(xpFromDefeat(112, 20)).toBe(320);
  });

  it("cai num default quando a espécie não tem o dado (a API devolve null)", () => {
    expect(xpFromDefeat(null, 7)).toBe(Math.floor((FALLBACK_BASE_EXPERIENCE * 7) / 7));
    expect(xpFromDefeat(0, 7)).toBe(FALLBACK_BASE_EXPERIENCE);
  });
});

describe("applyXp", () => {
  it("acumula sem subir quando falta XP", () => {
    // nv.5 = 125; +50 = 175, ainda abaixo de 216 (nv.6)
    expect(applyXp(125, 50)).toEqual({ level: 5, xp: 175, gained: 0 });
  });

  it("sobe de nível quando cruza o limiar", () => {
    expect(applyXp(125, 91)).toEqual({ level: 6, xp: 216, gained: 1 });
  });

  it("sobe múltiplos níveis de uma vez (o tempo só passa quando alguém olha)", () => {
    // 125 → 1000 é nv.5 → nv.10
    expect(applyXp(125, 875)).toEqual({ level: 10, xp: 1000, gained: 5 });
  });

  it("satura no teto em vez de acumular pra sempre", () => {
    const r = applyXp(xpForLevel(MAX_LEVEL), 999_999);
    expect(r.level).toBe(MAX_LEVEL);
    expect(r.xp).toBe(xpForLevel(MAX_LEVEL));
    expect(r.gained).toBe(0);
  });

  it("ignora ganho negativo/lixo em vez de regredir", () => {
    expect(applyXp(216, -100)).toEqual({ level: 6, xp: 216, gained: 0 });
  });
});
