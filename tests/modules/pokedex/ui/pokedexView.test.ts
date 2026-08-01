import { describe, expect, it } from "vitest";
import { collectionView, dexNumber } from "@/src/modules/pokedex/ui/pokedexView";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";
import type { CollectionPageDTO } from "@/src/modules/pokedex/ui/types";

const BASE_STATS = { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 };

const carta = (id: string, pokemonId: number) => ({
  userPokemonId: id,
  pokemonId,
  level: 10,
  xp: 1000,
  bst: 309,
  rarity: "common" as const,
  baseStats: BASE_STATS,
  pokemon: {
    id: pokemonId,
    name: "charmander",
    artworkUrl: "a.png",
    iconUrl: "i.png",
    types: ["fire"],
  },
});

const pagina = (over: Partial<CollectionPageDTO> = {}): CollectionPageDTO => ({
  cards: [carta("up-1", 4)],
  deck: null,
  page: 1,
  totalPages: 1,
  totalCards: 1,
  totalInCollection: 1,
  filters: parseCollectionFilters({}),
  ...over,
});

describe("dexNumber", () => {
  it("preenche com zero à esquerda", () => {
    expect(dexNumber(25)).toBe("#0025");
    expect(dexNumber(1025)).toBe("#1025");
  });
});

describe("collectionView", () => {
  it("sempre devolve DECK_LIMIT vagas, mesmo sem deck", () => {
    expect(collectionView(pagina()).deckSlots).toHaveLength(DECK_LIMIT);
  });

  it("marca a carta que está no deck e dá o id da vaga", () => {
    const v = collectionView(
      pagina({ deck: { id: "d1", slots: [{ id: "slot-9", userPokemonId: "up-1" }] } })
    );
    expect(v.cards[0].inDeck).toBe(true);
    expect(v.cards[0].deckSlotId).toBe("slot-9");
    expect(v.deckCount).toBe(1);
  });

  it("usa o primeiro tipo como cor de destaque", () => {
    expect(collectionView(pagina()).cards[0].accentType).toBe("fire");
  });

  it("sem carta e sem coleção, o vazio é de COLEÇÃO", () => {
    const v = collectionView(pagina({ cards: [], totalCards: 0, totalInCollection: 0 }));
    expect(v.emptyState).toBe("collection");
  });

  it("sem carta MAS com coleção, o vazio é de FILTRO", () => {
    // O jogador tem 40 cartas e filtrou "lendária" sem ter nenhuma. Tela
    // diferente: manda limpar o filtro, não capturar.
    const v = collectionView(pagina({ cards: [], totalCards: 0, totalInCollection: 40 }));
    expect(v.emptyState).toBe("filter");
  });

  it("com carta, não há vazio", () => {
    expect(collectionView(pagina()).emptyState).toBe("none");
  });
});
