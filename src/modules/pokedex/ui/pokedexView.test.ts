import { describe, expect, it } from "vitest";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";
import { collectionView, detailView, dexNumber } from "./pokedexView";
import type { CollectionDTO, PokemonCardDTO, PokemonDetailDTO } from "./types";

function pokemon(id: number, name: string, types = ["normal"]): PokemonCardDTO {
  return {
    id,
    name,
    artworkUrl: `https://sprites/artwork/${id}.png`,
    iconUrl: `https://sprites/${id}.png`,
    types,
  };
}

/** Coleção de `size` cartas; as `inDeck` primeiras estão no deck, nessa ordem. */
function collection(size: number, inDeck: number): CollectionDTO {
  const cards = Array.from({ length: size }, (_, i) => ({
    userCardId: `uc-${i}`,
    pokemonId: 100 + i,
    pokemon: pokemon(100 + i, `mon-${i}`),
  }));

  return {
    cards,
    deck:
      inDeck > 0
        ? {
            id: "deck-1",
            cards: Array.from({ length: inDeck }, (_, i) => ({
              id: `dc-${i}`,
              userCardId: `uc-${i}`,
            })),
          }
        : null,
  };
}

describe("dexNumber", () => {
  it("formata com 4 dígitos", () => {
    expect(dexNumber(25)).toBe("#0025");
    expect(dexNumber(1025)).toBe("#1025");
  });
});

describe("collectionView", () => {
  it("marca quem está no deck e diz com que id sair", () => {
    const { cards } = collectionView(collection(3, 1));

    expect(cards[0].inDeck).toBe(true);
    expect(cards[0].deckCardId).toBe("dc-0");
    expect(cards[1].inDeck).toBe(false);
    expect(cards[1].deckCardId).toBe(null);
  });

  it("sempre devolve DECK_LIMIT vagas, as vazias com pokemonId null", () => {
    const { deckSlots, deckCount } = collectionView(collection(5, 2));

    expect(deckSlots).toHaveLength(DECK_LIMIT);
    expect(deckCount).toBe(2);
    expect(deckSlots[0]).toEqual({
      pokemonId: 100,
      name: "mon-0",
      iconUrl: "https://sprites/100.png",
    });
    expect(deckSlots[2]).toEqual({ pokemonId: null, name: null, iconUrl: null });
  });

  it("com o deck cheio, trava quem está fora mas libera quem está dentro", () => {
    const { cards, deckCount } = collectionView(collection(8, DECK_LIMIT));

    expect(deckCount).toBe(DECK_LIMIT);
    // quem já está no deck PRECISA poder sair, senão o time fica intocável
    expect(cards[0].canToggle).toBe(true);
    // quem está fora não entra: não há vaga
    expect(cards[DECK_LIMIT].canToggle).toBe(false);
  });

  it("sem deck ainda, tudo pode entrar (o deck nasce no primeiro '+ deck')", () => {
    const { cards, deckCount, deckSlots } = collectionView(collection(2, 0));

    expect(deckCount).toBe(0);
    expect(deckSlots.every((s) => s.pokemonId === null)).toBe(true);
    expect(cards.every((c) => c.canToggle)).toBe(true);
  });

  // A carta é NOSSA (está no banco); o pokémon vem da PokéAPI. Se a API não
  // respondeu, o jogador ainda TEM esse pokémon — a carta não pode sumir da
  // coleção, nem virar um buraco sem nome. Cai no número da dex.
  it("desenha a carta mesmo quando a PokéAPI não devolveu o pokémon", () => {
    const { cards, deckSlots, isEmpty } = collectionView({
      cards: [{ userCardId: "uc-0", pokemonId: 25, pokemon: null }],
      deck: { id: "deck-1", cards: [{ id: "dc-0", userCardId: "uc-0" }] },
    });

    expect(isEmpty).toBe(false);
    expect(cards[0].name).toBe("#0025");
    expect(cards[0].artworkUrl).toBe(null);
    expect(cards[0].types).toEqual([]);
    expect(cards[0].accentType).toBe("normal"); // a moldura precisa de uma cor
    expect(cards[0].inDeck).toBe(true); // e ele continua no deck
    expect(deckSlots[0].name).toBe("#0025");
  });

  it("coleção vazia é vazia", () => {
    expect(collectionView({ cards: [], deck: null }).isEmpty).toBe(true);
  });
});

describe("detailView", () => {
  const detail: PokemonDetailDTO = {
    id: 25,
    name: "pikachu",
    artworkUrl: null,
    types: ["electric"],
    height: 4, // decímetros
    weight: 60, // hectogramas
    stats: [
      { name: "hp", value: 35 },
      { name: "special-attack", value: 50 },
      { name: "inventado", value: 10 },
    ],
    moves: ["thunder-punch", "mega-kick"],
    totalMoves: 105,
  };

  it("converte as unidades da PokéAPI (dm/hg) pras da tela (m/kg)", () => {
    const view = detailView(detail);
    expect(view.heightMeters).toBe("0.4");
    expect(view.weightKg).toBe("6.0");
  });

  it("traduz o rótulo do stat e cai no nome cru quando não conhece", () => {
    const [hp, spAtk, desconhecido] = detailView(detail).statBars;
    expect(hp.label).toBe("HP");
    expect(spAtk.label).toBe("At. Especial");
    expect(desconhecido.label).toBe("inventado");
  });

  it("tira o hífen dos nomes de move", () => {
    expect(detailView(detail).moveNames).toEqual(["thunder punch", "mega kick"]);
  });
});
