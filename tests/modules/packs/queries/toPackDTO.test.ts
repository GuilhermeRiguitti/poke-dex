import { describe, expect, it } from "vitest";
import type { NormalizedPokemon } from "@/src/lib/pokeapi";
import { toPackCardDTO } from "@/src/modules/packs/queries/toPackDTO";

// Um NormalizedPokemon "gordo": carrega o movepool inteiro e campos que a carta
// não usa. O DTO NÃO pode deixar nada disso vazar pro cliente (regra do DTO no
// CLAUDE.md — aqui o vazamento é de PESO, como na coleção).
const fat: NormalizedPokemon = {
  id: 25,
  name: "pikachu",
  height: 4,
  weight: 60,
  baseExperience: 112,
  sprites: { front_default: "icon.png", back_default: "back.png", artwork: "art.png" },
  stats: [{ base_stat: 55, effort: 2, stat: { name: "attack" } }],
  types: [{ slot: 1, type: { name: "electric" } }],
  moves: Array.from({ length: 130 }, (_, i) => ({
    move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
  })),
};

describe("toPackCardDTO", () => {
  it("mapeia bst e raridade a partir do id", () => {
    const dto = toPackCardDTO(25, fat, true);
    expect(dto.pokemonId).toBe(25);
    expect(dto.bst).toBe(320); // Pikachu, do índice gerado
    expect(dto.rarity).toBe("common");
    expect(dto.isNew).toBe(true);
    expect(dto.card?.name).toBe("pikachu");
  });

  it("NÃO vaza o movepool nem campos de peso morto", () => {
    const json = JSON.stringify(toPackCardDTO(25, fat, false));
    expect(json).not.toContain("move-0"); // nenhum dos 130 moves
    expect(json).not.toContain("/api/v2/move/"); // nem as urls
    expect(json).not.toContain("effort");
    expect(json).not.toContain("baseExperience");
    expect(json).not.toContain("back.png"); // sprite de costas
  });

  it("pokemon null (rede fora) => card null, mas a carta ainda é concedida", () => {
    const dto = toPackCardDTO(150, null, true);
    expect(dto.card).toBeNull();
    expect(dto.pokemonId).toBe(150);
    expect(dto.bst).toBe(680); // Mewtwo — bst vem do índice, não da rede
    expect(dto.rarity).toBe("legendary");
  });
});
