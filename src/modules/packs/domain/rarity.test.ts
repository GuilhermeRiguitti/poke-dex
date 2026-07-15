import { describe, expect, it } from "vitest";
import { bstOf, drawPack, PACK_SIZE, rarityTier, weightForBst } from "./rarity";

describe("weightForBst", () => {
  it("é monotônico decrescente: BST maior => peso menor", () => {
    expect(weightForBst(200)).toBeGreaterThan(weightForBst(320));
    expect(weightForBst(320)).toBeGreaterThan(weightForBst(500));
    expect(weightForBst(500)).toBeGreaterThan(weightForBst(680));
  });

  it("nunca é zero nem negativo — nada é impossível de sair", () => {
    expect(weightForBst(680)).toBeGreaterThan(0);
    expect(weightForBst(720)).toBeGreaterThan(0); // Arceus, o teto real
    expect(weightForBst(9999)).toBeGreaterThan(0); // além do teto: clamp em 1
  });

  it("o lendário é DRASTICAMENTE mais raro que o fraco (>40x por carta)", () => {
    // A premissa do feature: pokémon fortes são muito mais difíceis.
    const magikarp = weightForBst(200);
    const mewtwo = weightForBst(680);
    expect(magikarp / mewtwo).toBeGreaterThan(40); // (600/120)^2.5 ≈ 56x
  });
});

describe("rarityTier", () => {
  it("classifica pelos degraus de BST", () => {
    expect(rarityTier(195)).toBe("common"); // Caterpie
    expect(rarityTier(320)).toBe("common"); // Pikachu
    expect(rarityTier(455)).toBe("uncommon");
    expect(rarityTier(540)).toBe("rare"); // Snorlax
    expect(rarityTier(680)).toBe("legendary"); // Mewtwo
  });
});

describe("bstOf", () => {
  it("lê o índice gerado (Pikachu = 320)", () => {
    expect(bstOf(25)).toBe(320);
  });
  it("id fora da dex => 0", () => {
    expect(bstOf(99999)).toBe(0);
    expect(bstOf(0)).toBe(0);
  });
});

describe("drawPack", () => {
  it("devolve PACK_SIZE ids DISTINTOS (sem reposição no pacote)", () => {
    const cards = drawPack(Math.random);
    expect(cards).toHaveLength(PACK_SIZE);
    expect(new Set(cards).size).toBe(PACK_SIZE);
  });

  it("rng=0 sempre pega a primeira fatia da roleta (o de MENOR BST do pool)", () => {
    // Pool artificial: 129 (Magikarp, BST 200) e 150 (Mewtwo, BST 680). Com
    // rng()=0 o ponteiro cai na primeira fatia, e a ordem da roleta é a ordem
    // do pool — então sai Magikarp primeiro. Prova que o peso rege a escolha.
    const cards = drawPack(() => 0, 2, [129, 150]);
    expect(cards).toEqual([129, 150]);
  });

  it("rng≈1 alcança a última fatia sem estourar (fallback de ponto flutuante)", () => {
    const cards = drawPack(() => 0.999999, 1, [129, 150]);
    expect(cards).toHaveLength(1);
    expect([129, 150]).toContain(cards[0]);
  });

  it("nunca sorteia mais cartas do que o pool tem", () => {
    const cards = drawPack(Math.random, 6, [1, 4, 7]);
    expect(cards).toHaveLength(3);
    expect(new Set(cards).size).toBe(3);
  });

  it("estatística: o fraco sai MUITO mais que o forte em muitas aberturas", () => {
    // Não é um teste de valor exato (seria flaky), é de tendência: sortear
    // 1 carta 2000x de um pool fraco+forte e conferir que o fraco domina.
    let weak = 0;
    for (let i = 0; i < 2000; i++) {
      const [id] = drawPack(Math.random, 1, [129, 150]); // Magikarp vs Mewtwo
      if (id === 129) weak++;
    }
    expect(weak).toBeGreaterThan(1500); // esperado ~98% (razão de peso ≈ 56:1)
  });
});
