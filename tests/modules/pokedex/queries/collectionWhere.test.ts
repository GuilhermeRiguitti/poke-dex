import { describe, expect, it } from "vitest";
import { buildCollectionWhere, orderByFor } from "@/src/modules/pokedex/queries/collectionWhere";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";

describe("buildCollectionWhere", () => {
  it("sem filtro, recorta só pelo dono e exclui quem já está no deck", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({}));
    expect(where).toEqual({ userId: "u1", deckSlots: { none: {} }, pokemon: {} });
  });

  it("busca por nome é insensível a maiúscula", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({ q: "Char" }));
    expect(where.pokemon).toEqual({ name: { contains: "Char", mode: "insensitive" } });
  });

  it("tipo elemental usa array_contains na coluna Json", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({ type: "fire" }));
    expect(where.pokemon).toEqual({ types: { array_contains: ["fire"] } });
  });

  it("raridade é igualdade na coluna", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({ rarity: "legendary" }));
    expect(where.pokemon).toEqual({ rarity: "legendary" });
  });

  it("os três filtros combinam", () => {
    const where = buildCollectionWhere(
      "u1",
      parseCollectionFilters({ q: "dra", type: "dragon", rarity: "rare" })
    );
    expect(where.pokemon).toEqual({
      name: { contains: "dra", mode: "insensitive" },
      types: { array_contains: ["dragon"] },
      rarity: "rare",
    });
  });
});

describe("orderByFor", () => {
  // O openPack cria as 6 cartas num createMany dentro de uma transação, e o
  // now() do Postgres é o MESMO pra todas: as 6 têm capturedAt idêntico. Nível
  // empata ainda mais. Em ordenação empatada o Postgres não garante a mesma
  // ordem entre duas queries — com LIMIT/OFFSET isso faz uma carta aparecer em
  // duas páginas e outra sumir das duas. `id` é cuid e único: é o desempate.
  it.each(["captured", "level_desc", "level_asc"] as const)(
    "termina em id — %s",
    (sort) => {
      const ordem = orderByFor(sort);
      expect(ordem[ordem.length - 1]).toEqual({ id: "asc" });
    }
  );

  it("captured ordena por data de captura primeiro", () => {
    expect(orderByFor("captured")).toEqual([{ capturedAt: "asc" }, { id: "asc" }]);
  });

  it("level_desc põe o nível na frente", () => {
    expect(orderByFor("level_desc")).toEqual([
      { level: "desc" },
      { capturedAt: "asc" },
      { id: "asc" },
    ]);
  });

  it("level_asc idem, invertido", () => {
    expect(orderByFor("level_asc")).toEqual([
      { level: "asc" },
      { capturedAt: "asc" },
      { id: "asc" },
    ]);
  });
});
