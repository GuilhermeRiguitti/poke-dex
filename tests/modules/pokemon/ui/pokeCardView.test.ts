import { describe, expect, it } from "vitest";
import { CARD_WIDTH, cardMetal, dexNumber, statBars } from "@/src/modules/pokemon/ui/pokeCardView";

describe("dexNumber", () => {
  it("preenche com zero à esquerda", () => {
    expect(dexNumber(25)).toBe("#0025");
    expect(dexNumber(1025)).toBe("#1025");
  });
});

describe("cardMetal", () => {
  it("mapeia cada raridade pro seu metal", () => {
    expect(cardMetal("common")).toBe("bronze");
    expect(cardMetal("uncommon")).toBe("silver");
    expect(cardMetal("rare")).toBe("rose");
    expect(cardMetal("legendary")).toBe("gold");
  });
});

describe("CARD_WIDTH", () => {
  it("tem os três tamanhos, do maior pro menor", () => {
    expect(CARD_WIDTH.full).toBe(340);
    expect(CARD_WIDTH.grid).toBe(260);
    expect(CARD_WIDTH.mini).toBe(96);
  });
});

describe("statBars", () => {
  // Mewtwo, base stats reais da PokéAPI.
  const mewtwo = { hp: 106, atk: 110, def: 90, spa: 154, spd: 90, spe: 130 };

  it("devolve as 6 barras na ordem fixa", () => {
    expect(statBars(mewtwo, 50).map((b) => b.label)).toEqual([
      "HP",
      "ATK",
      "DEF",
      "AT.ESP",
      "DF.ESP",
      "VEL",
    ]);
  });

  it("o NÚMERO é o derivado pelo nível (mesma fórmula da engine)", () => {
    // HP  = floor(2*106*1/100) + 1 + 10 = 2 + 11 = 13
    // ATK = floor(2*110*1/100) + 5      = 2 + 5  = 7
    const lv1 = statBars(mewtwo, 1);
    expect(lv1[0].value).toBe(13);
    expect(lv1[1].value).toBe(7);

    // HP  = floor(2*106*50/100) + 50 + 10 = 106 + 60 = 166
    // ATK = floor(2*110*50/100) + 5       = 110 + 5  = 115
    const lv50 = statBars(mewtwo, 50);
    expect(lv50[0].value).toBe(166);
    expect(lv50[1].value).toBe(115);
  });

  it("a BARRA é o base stat da espécie, não o derivado", () => {
    const bars = statBars(mewtwo, 1);
    expect(bars.map((b) => b.pct)).toEqual([100, 100, 90, 100, 90, 100]);
    // ^ hp 106 e atk 110 passam de 100 e travam; def 90 e spd 90 ficam em 90.
  });

  it("a barra NÃO muda com o nível — ela é o perfil da espécie", () => {
    const lv1 = statBars(mewtwo, 1).map((b) => b.pct);
    const lv100 = statBars(mewtwo, 100).map((b) => b.pct);
    expect(lv1).toEqual(lv100);
    // ...enquanto os números crescem
    expect(statBars(mewtwo, 100)[0].value).toBeGreaterThan(statBars(mewtwo, 1)[0].value);
  });

  it("é a MESMA conta do handoff — Articuno enche igual à carta de referência", () => {
    // O handoff desenha HP 90 / ATK 78 / DEF 82 / SPD 95 com `width: {valor}%`,
    // e esses números são os base stats do Articuno. A barra tem que bater.
    const articuno = { hp: 90, atk: 85, def: 100, spa: 95, spd: 125, spe: 85 };
    const bars = statBars(articuno, 30);
    expect(bars[0].pct).toBe(90); // HP
    expect(bars[1].pct).toBe(85); // ATK
    expect(bars[2].pct).toBe(100); // DEF
  });

  it("a barra nunca passa de 100 nem no maior base stat do jogo", () => {
    // Blissey tem o maior HP base do jogo (255).
    const blissey = { hp: 255, atk: 10, def: 10, spa: 75, spd: 135, spe: 55 };
    for (const bar of statBars(blissey, 100)) {
      expect(bar.pct).toBeLessThanOrEqual(100);
      expect(bar.pct).toBeGreaterThanOrEqual(0);
    }
    expect(statBars(blissey, 100)[0].value).toBe(620);
  });

  it("pokémon fraco tem barra curta em qualquer nível — é o que o vazio antigo perdia", () => {
    const caterpie = { hp: 45, atk: 30, def: 35, spa: 20, spd: 20, spe: 45 };
    const bars = statBars(caterpie, 1);
    expect(bars.map((b) => b.pct)).toEqual([45, 30, 35, 20, 20, 45]);
    // No nível 1 os NÚMEROS são quase iguais aos do Mewtwo (11 vs 13)...
    expect(bars[0].value).toBe(11);
    // ...mas a barra separa os dois na hora.
    expect(bars[0].pct).toBeLessThan(statBars(mewtwo, 1)[0].pct);
  });
});
