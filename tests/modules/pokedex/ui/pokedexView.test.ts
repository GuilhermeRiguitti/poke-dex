import { describe, expect, it } from "vitest";
import { collectionView, dexNumber } from "@/src/modules/pokedex/ui/pokedexView";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";
import type { CollectionPageDTO } from "@/src/modules/pokedex/types";

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
  it("usa o primeiro tipo como cor de destaque", () => {
    expect(collectionView(pagina()).cards[0].accentType).toBe("fire");
  });

  // A coleção deixou de saber qualquer coisa de deck: quem está numa vaga nem
  // é listado (buildCollectionWhere exclui no banco), então não há "inDeck",
  // "deckSlotId" nem "canToggle" pra vazar de volta pra cá.
  it("a carta não carrega nada sobre deck", () => {
    const card = collectionView(pagina()).cards[0];
    expect(card).not.toHaveProperty("inDeck");
    expect(card).not.toHaveProperty("deckSlotId");
    expect(card).not.toHaveProperty("canToggle");
  });

  it("sem carta e sem coleção, o vazio é de COLEÇÃO", () => {
    const v = collectionView(pagina({ cards: [], totalCards: 0, totalInCollection: 0 }));
    expect(v.emptyState).toBe("collection");
  });

  it("sem carta, COM coleção e COM filtro ativo, o vazio é de FILTRO", () => {
    // O jogador tem 40 cartas e filtrou "lendária" sem ter nenhuma. Tela
    // diferente: manda limpar o filtro, não capturar.
    const v = collectionView(
      pagina({
        cards: [],
        totalCards: 0,
        totalInCollection: 40,
        filters: parseCollectionFilters({ rarity: "legendary" }),
      })
    );
    expect(v.emptyState).toBe("filter");
  });

  it("sem carta, COM coleção e SEM filtro, o vazio é 'tudo no deck'", () => {
    // A coleção não lista mais quem está no deck. Quem montou tudo tem `cards`
    // vazio sem filtro nenhum — mandar "limpar filtros" aí seria pedir pra
    // limpar o que não existe.
    const v = collectionView(pagina({ cards: [], totalCards: 0, totalInCollection: 6 }));
    expect(v.emptyState).toBe("all_in_deck");
  });

  it("com carta, não há vazio", () => {
    expect(collectionView(pagina()).emptyState).toBe("none");
  });
});
