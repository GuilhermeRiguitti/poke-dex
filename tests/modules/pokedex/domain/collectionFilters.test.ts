import { describe, expect, it } from "vitest";
import {
  COLLECTION_PAGE_SIZE,
  collectionHref,
  hasActiveFilter,
  parseCollectionFilters,
} from "@/src/modules/pokedex/domain/collectionFilters";

// Entrada de URL é entrada de USUÁRIO, e isto roda no render de uma page: um
// throw aqui vira tela de erro em vez de listagem. Nada pode lançar; valor
// inválido vira null ou o default. (Mesma razão do clampPage.)

describe("parseCollectionFilters", () => {
  it("sem parâmetro nenhum, devolve o default", () => {
    expect(parseCollectionFilters({})).toEqual({
      q: null,
      type: null,
      rarity: null,
      sort: "captured",
      page: 1,
    });
  });

  it("aceita os valores válidos", () => {
    expect(
      parseCollectionFilters({ q: "char", type: "fire", rarity: "rare", sort: "level_desc", page: "3" })
    ).toEqual({ q: "char", type: "fire", rarity: "rare", sort: "level_desc", page: 3 });
  });

  it.each([
    ["page não numérica", { page: "abc" }, 1],
    ["page negativa", { page: "-3" }, 1],
    ["page zero", { page: "0" }, 1],
    ["page fracionária", { page: "2.9" }, 2],
  ])("recorta a página: %s", (_nome, raw, esperado) => {
    expect(parseCollectionFilters(raw).page).toBe(esperado);
  });

  it("descarta tipo e raridade que não existem", () => {
    const f = parseCollectionFilters({ type: "<script>", rarity: "ultra" });
    expect(f.type).toBeNull();
    expect(f.rarity).toBeNull();
  });

  it("descarta ordenação desconhecida", () => {
    expect(parseCollectionFilters({ sort: "bogus" }).sort).toBe("captured");
  });

  it("trima a busca e trata vazia como ausente", () => {
    expect(parseCollectionFilters({ q: "   " }).q).toBeNull();
    expect(parseCollectionFilters({ q: "  pika  " }).q).toBe("pika");
  });

  it("TRUNCA a busca longa em vez de rejeitar", () => {
    // Rejeitar faria a tela piscar vazia por causa de um paste acidental.
    const f = parseCollectionFilters({ q: "a".repeat(500) });
    expect(f.q).toHaveLength(50);
  });

  // Next entrega array quando a chave repete na URL (?q=a&q=b). Sem tratar
  // isso, ".trim()"/"parseInt" num array lançam e a tela de erro substitui a
  // coleção — o oposto do "NADA LANÇA" prometido no topo do arquivo.
  it("NÃO lança com query param repetido (array) — usa o primeiro valor", () => {
    expect(() => parseCollectionFilters({ q: ["a", "b"] })).not.toThrow();
    expect(parseCollectionFilters({ q: ["a", "b"] }).q).toBe("a");
    expect(parseCollectionFilters({ page: ["2", "9"] }).page).toBe(2);
    expect(parseCollectionFilters({ type: ["fire", "water"] }).type).toBe("fire");
  });
});

describe("hasActiveFilter", () => {
  it("página e ordenação não contam como filtro", () => {
    const f = parseCollectionFilters({ page: "4", sort: "level_desc" });
    expect(hasActiveFilter(f)).toBe(false);
  });

  it("busca, tipo ou raridade contam", () => {
    expect(hasActiveFilter(parseCollectionFilters({ q: "pika" }))).toBe(true);
    expect(hasActiveFilter(parseCollectionFilters({ type: "fire" }))).toBe(true);
    expect(hasActiveFilter(parseCollectionFilters({ rarity: "rare" }))).toBe(true);
  });
});

describe("collectionHref", () => {
  it("preserva o que não foi trocado", () => {
    const f = parseCollectionFilters({ q: "char", type: "fire", page: "2" });
    expect(collectionHref(f, { page: 3 })).toBe("/pokedex?q=char&type=fire&page=3");
  });

  it("omite o que está no default (URL limpa)", () => {
    expect(collectionHref(parseCollectionFilters({}), {})).toBe("/pokedex");
  });

  // O comportamento que evita a página fantasma: trocar um FILTRO tem que
  // voltar pra página 1, senão o jogador cai numa página que não existe mais.
  it("trocar filtro zera a página", () => {
    const f = parseCollectionFilters({ page: "5", q: "char" });
    expect(collectionHref(f, { rarity: "rare" })).toBe("/pokedex?q=char&rarity=rare");
  });

  it("trocar só a página NÃO zera a página", () => {
    const f = parseCollectionFilters({ page: "5" });
    expect(collectionHref(f, { page: 6 })).toBe("/pokedex?page=6");
  });
});

describe("COLLECTION_PAGE_SIZE", () => {
  it("é 16", () => {
    expect(COLLECTION_PAGE_SIZE).toBe(16);
  });
});
