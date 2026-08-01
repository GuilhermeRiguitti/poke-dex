import { describe, expect, it } from "vitest";
import { collectionFilterView } from "@/src/modules/pokedex/ui/collectionFilterView";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";

describe("collectionFilterView", () => {
  it("oferece 18 tipos + a opção 'todos'", () => {
    const v = collectionFilterView(parseCollectionFilters({}));
    expect(v.typeOptions).toHaveLength(19);
    expect(v.typeOptions[0]).toEqual({ value: "", label: "Todos os tipos" });
  });

  it("oferece as 4 raridades + 'todas', com rótulo em português", () => {
    const v = collectionFilterView(parseCollectionFilters({}));
    expect(v.rarityOptions).toHaveLength(5);
    expect(v.rarityOptions.map((o) => o.label)).toEqual([
      "Todas as raridades",
      "Comum",
      "Incomum",
      "Rara",
      "Lendária",
    ]);
  });

  it("marca o valor selecionado", () => {
    const v = collectionFilterView(parseCollectionFilters({ type: "fire", rarity: "rare" }));
    expect(v.selectedType).toBe("fire");
    expect(v.selectedRarity).toBe("rare");
  });

  it("sem filtro, não mostra o botão de limpar", () => {
    expect(collectionFilterView(parseCollectionFilters({})).showClear).toBe(false);
  });

  it("com filtro, mostra o botão de limpar apontando pra coleção limpa", () => {
    const v = collectionFilterView(parseCollectionFilters({ q: "pika", page: "4" }));
    expect(v.showClear).toBe(true);
    expect(v.clearHref).toBe("/pokedex");
  });

  it("preserva a ordenação ao limpar os filtros", () => {
    // Ordenação não é filtro: limpar "fogo" não pode desfazer "por nível".
    const v = collectionFilterView(parseCollectionFilters({ type: "fire", sort: "level_desc" }));
    expect(v.clearHref).toBe("/pokedex?sort=level_desc");
  });
});
