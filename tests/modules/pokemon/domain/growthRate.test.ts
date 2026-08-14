import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROWTH_RATE,
  levelFromXpOn,
  normalizeGrowthRate,
  xpForLevelOn,
  type GrowthRate,
} from "@/src/modules/pokemon/domain/growthRate";
import { MAX_LEVEL, levelFromXp, xpForLevel } from "@/src/modules/pokemon/domain/leveling";

const CURVAS: GrowthRate[] = [
  "slow",
  "medium-slow",
  "medium-fast",
  "fast",
  "erratic",
  "fluctuating",
];

describe("normalizeGrowthRate", () => {
  it("aceita as seis e cai no default pro resto", () => {
    for (const c of CURVAS) expect(normalizeGrowthRate(c)).toBe(c);
    expect(normalizeGrowthRate("inventada")).toBe(DEFAULT_GROWTH_RATE);
    expect(normalizeGrowthRate(null)).toBe(DEFAULT_GROWTH_RATE);
    expect(normalizeGrowthRate(42)).toBe(DEFAULT_GROWTH_RATE);
  });

  it("o default é medium-fast — a curva única de antes de 2026-08-14", () => {
    // É isto que faz a mudança ser aditiva: espécie ainda não re-sincronizada
    // continua se comportando exatamente como antes.
    expect(DEFAULT_GROWTH_RATE).toBe("medium-fast");
  });
});

describe("as tabelas", () => {
  it("são monotônicas — nível maior sempre custa mais XP", () => {
    // Se uma curva "descesse" em algum ponto, a busca binária da inversa daria
    // resposta errada em silêncio.
    for (const c of CURVAS) {
      for (let n = 2; n <= MAX_LEVEL; n++) {
        expect(xpForLevelOn(c, n)).toBeGreaterThan(xpForLevelOn(c, n - 1));
      }
    }
  });

  it("levelFromXpOn é o inverso exato de xpForLevelOn, nas seis", () => {
    // Este é O teste da fatia: `erratic` e `fluctuating` são polinômios por
    // faixa e NÃO têm inversa analítica — a busca binária é o que resolve, e é
    // ela que precisa estar certa nas bordas de faixa.
    for (const c of CURVAS) {
      for (let n = 1; n <= MAX_LEVEL; n++) {
        const xp = xpForLevelOn(c, n);
        expect(levelFromXpOn(c, xp)).toBe(n);
        // Um XP a menos ainda é o nível anterior.
        if (n > 1) expect(levelFromXpOn(c, xp - 1)).toBe(n - 1);
      }
    }
  });

  it("XP abaixo do nível 1 e acima do teto não estouram", () => {
    for (const c of CURVAS) {
      expect(levelFromXpOn(c, 0)).toBe(1);
      expect(levelFromXpOn(c, -999)).toBe(1);
      expect(levelFromXpOn(c, Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
    }
  });

  it("as seis curvas são realmente DIFERENTES entre si", () => {
    // Se duas fórmulas tivessem sido digitadas iguais, os testes acima
    // passariam e a feature não faria nada.
    //
    // Medido no nível 40, e NÃO no 50: em exatamente 50 a `erratic` troca de
    // faixa e o valor dela coincide com o da `medium-fast` (125.000 nas duas).
    // A coincidência é das fórmulas da série, não um erro de digitação — mas ela
    // faz um teste de distinção falhar sem que nada esteja errado.
    const totais = CURVAS.map((c) => xpForLevelOn(c, 40));
    expect(new Set(totais).size).toBe(CURVAS.length);
  });

  it("`fast` é mais barata e `slow` mais cara que medium-fast", () => {
    expect(xpForLevelOn("fast", 50)).toBeLessThan(xpForLevelOn("medium-fast", 50));
    expect(xpForLevelOn("slow", 50)).toBeGreaterThan(xpForLevelOn("medium-fast", 50));
  });
});

describe("a fachada em leveling.ts", () => {
  it("sem curva, o comportamento é IDÊNTICO ao de antes (n³)", () => {
    // A garantia de que nenhuma carta existente mudou de nível com esta fatia.
    for (const n of [1, 5, 20, 50, 100]) {
      expect(xpForLevel(n)).toBe(n ** 3);
      expect(levelFromXp(n ** 3)).toBe(n);
    }
  });

  it("com curva, usa a curva", () => {
    expect(xpForLevel(50, "fast")).toBe(xpForLevelOn("fast", 50));
    expect(xpForLevel(50, "fast")).not.toBe(xpForLevel(50));
  });

  it("o teto da tabela bate com MAX_LEVEL", () => {
    // Se divergissem, o nível 100 de alguma curva viraria undefined e todo o
    // cálculo de XP daquela espécie quebraria em silêncio.
    for (const c of CURVAS) expect(Number.isFinite(xpForLevelOn(c, MAX_LEVEL))).toBe(true);
  });
});
