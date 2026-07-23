import { describe, expect, it } from "vitest";
import type { NormalizedPokemon } from "@/src/lib/pokeapi";
import { DETAIL_MOVES_SHOWN, toPokemonCardDTO, toPokemonDetailDTO } from "@/src/modules/pokedex/queries/toPokemonDTO";

// O NormalizedPokemon é o que a PokéAPI devolve depois de normalizado — e ele
// é GRANDE. O movepool sozinho passa de 100 entradas pra boa parte dos pokémon,
// cada uma com nome e URL.
//
// No battle, o mapper existe por segurança (a linha crua carregava a jogada do
// oponente). Aqui ele existe por PESO: sem ele, renderizar uma página da dex
// mandaria 20 movepools inteiros no payload RSC pra desenhar 20 sprites e 40
// badges de tipo. É um vazamento diferente, e a defesa é a mesma: whitelist
// explícita + um teste que trava o buraco.
function normalized(overrides: Partial<NormalizedPokemon> = {}): NormalizedPokemon {
  return {
    id: 19,
    name: "rattata",
    height: 3,
    weight: 35,
    baseExperience: 51,
    sprites: {
      front_default: "https://sprites/19.png",
      back_default: "https://sprites/back/19.png",
      artwork: "https://sprites/artwork/19.png",
    },
    stats: [
      { base_stat: 30, effort: 0, stat: { name: "hp" } },
      { base_stat: 56, effort: 1, stat: { name: "attack" } },
    ],
    types: [{ slot: 1, type: { name: "normal" } }],
    // 120 moves, como um pokémon real tem
    moves: Array.from({ length: 120 }, (_, i) => ({
      move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
      learnDetails: [{ levelLearnedAt: i, learnMethod: "level-up", versionGroup: "x-y" }],
    })),
    ...overrides,
  };
}

describe("toPokemonCardDTO", () => {
  it("leva só o que a moldura do card desenha", () => {
    const dto = toPokemonCardDTO(normalized());

    expect(dto).toEqual({
      id: 19,
      name: "rattata",
      artworkUrl: "https://sprites/artwork/19.png",
      iconUrl: "https://sprites/19.png",
      types: ["normal"],
    });
  });

  // O teste que importa: o movepool NÃO pode atravessar pro cliente. Se alguém
  // "simplificar" o mapper pra um spread do NormalizedPokemon, isto acusa.
  it("não vaza o movepool, nem stats, nem sprite de costas", () => {
    const json = JSON.stringify(toPokemonCardDTO(normalized()));

    expect(json).not.toContain("move-0");
    expect(json).not.toContain("moves");
    expect(json).not.toContain("stats");
    expect(json).not.toContain("back_default");
    expect(json).not.toContain("baseExperience");
  });

  it("cai no sprite pequeno quando não há artwork (e vice-versa)", () => {
    const semArtwork = toPokemonCardDTO(
      normalized({
        sprites: { front_default: "https://sprites/19.png", back_default: null, artwork: null },
      })
    );
    expect(semArtwork.artworkUrl).toBe("https://sprites/19.png");

    const semSprite = toPokemonCardDTO(
      normalized({
        sprites: { front_default: null, back_default: null, artwork: "https://sprites/art.png" },
      })
    );
    expect(semSprite.iconUrl).toBe("https://sprites/art.png");
  });
});

describe("toPokemonDetailDTO", () => {
  // A página de detalhe MOSTRA moves — mas só 12. Os outros 108 não têm por que
  // trafegar, e o `totalMoves` é o que a tela usa pra escrever "(120 no total)".
  it("corta o movepool no que a tela mostra, mas preserva o total", () => {
    const dto = toPokemonDetailDTO(normalized());

    expect(dto.moves).toHaveLength(DETAIL_MOVES_SHOWN);
    expect(dto.moves[0]).toBe("move-0");
    expect(dto.totalMoves).toBe(120);
    // as URLs de move da PokéAPI não vão junto — a tela só escreve o nome
    expect(JSON.stringify(dto)).not.toContain("pokeapi.co/api/v2/move");
  });

  it("achata os stats pro par (nome, valor)", () => {
    expect(toPokemonDetailDTO(normalized()).stats).toEqual([
      { name: "hp", value: 30 },
      { name: "attack", value: 56 },
    ]);
  });
});
