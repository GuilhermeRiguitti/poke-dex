import { describe, expect, it } from "vitest";
import { TYPE_COLORS, typeColor } from "@/src/lib/typeColors";
import { collectionFilterView } from "@/src/modules/pokedex/ui/collectionFilterView";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";

describe("collectionFilterView", () => {
  it("oferece 18 tipos + a opção 'todos'", () => {
    const v = collectionFilterView(parseCollectionFilters({}));
    expect(v.typeChips).toHaveLength(19);
    expect(v.typeChips[0]).toMatchObject({ value: "", label: "Todos" });
  });

  it("cada tipo leva a cor dele — é o que pinta o botão da paleta", () => {
    const v = collectionFilterView(parseCollectionFilters({}));
    expect(v.typeChips.find((t) => t.value === "fire")?.color).toBe(TYPE_COLORS.fire);
    // o "todos" não é tipo, então cai no cinza de fallback do typeColor
    expect(v.typeChips[0].color).toBe(typeColor(""));
  });

  it("só o tipo filtrado fica ativo; sem filtro, o ativo é o 'todos'", () => {
    const semFiltro = collectionFilterView(parseCollectionFilters({}));
    expect(semFiltro.typeChips.filter((t) => t.active).map((t) => t.value)).toEqual([""]);

    const comFogo = collectionFilterView(parseCollectionFilters({ type: "fire" }));
    expect(comFogo.typeChips.filter((t) => t.active).map((t) => t.value)).toEqual(["fire"]);
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
