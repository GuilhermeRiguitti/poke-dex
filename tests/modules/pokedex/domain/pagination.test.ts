import { describe, expect, it } from "vitest";
import { MAX_POKEMON, PAGE_SIZE, TOTAL_PAGES, clampPage, pageRange } from "@/src/modules/pokedex/domain/pagination";

describe("clampPage", () => {
  // O ?page= é entrada do usuário: dá pra digitar qualquer coisa na URL. Isto
  // roda no render da page, então NADA aqui pode lançar — um throw viraria
  // tela de erro no lugar da PokéDex.
  it("cai na página 1 quando não é um número", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage("")).toBe(1);
    expect(clampPage("abc")).toBe(1);
  });

  it("prende dentro de [1, TOTAL_PAGES]", () => {
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-5")).toBe(1);
    expect(clampPage("999999")).toBe(TOTAL_PAGES);
  });

  it("aceita uma página válida", () => {
    expect(clampPage("7")).toBe(7);
    expect(clampPage(String(TOTAL_PAGES))).toBe(TOTAL_PAGES);
  });
});

describe("pageRange", () => {
  it("dá o offset e o limite cheio nas páginas do meio", () => {
    expect(pageRange(1)).toEqual({ offset: 0, limit: PAGE_SIZE });
    expect(pageRange(3)).toEqual({ offset: 40, limit: PAGE_SIZE });
  });

  // 1025 não é múltiplo de 20: a última página tem 5. Sem esse recorte, ela
  // pediria 20 e a PokéAPI devolveria 15 FORMAS ALTERNATIVAS (deoxys-attack,
  // wormadam-sandy...) que não são pokémon da dex.
  it("recorta o limite na última página pra não passar de MAX_POKEMON", () => {
    const last = pageRange(TOTAL_PAGES);
    expect(last.offset + last.limit).toBe(MAX_POKEMON);
    expect(last.limit).toBeLessThan(PAGE_SIZE);
  });

  it("nunca deixa o intervalo passar de MAX_POKEMON", () => {
    for (let page = 1; page <= TOTAL_PAGES; page++) {
      const { offset, limit } = pageRange(page);
      expect(offset + limit).toBeLessThanOrEqual(MAX_POKEMON);
      expect(limit).toBeGreaterThan(0);
    }
  });
});
