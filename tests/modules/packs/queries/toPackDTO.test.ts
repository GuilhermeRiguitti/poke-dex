import { describe, expect, it } from "vitest";
import type { PokemonCardDTO } from "@/src/modules/pokedex";
import { toPackCardDTO } from "@/src/modules/packs/queries/toPackDTO";

// O card já vem montado do espelho local (whitelist do PokemonCardDTO), então o
// que toPackCardDTO acrescenta é só bst/rarity/isNew a partir do id.
const card: PokemonCardDTO = {
  id: 25,
  name: "pikachu",
  artworkUrl: "art.png",
  iconUrl: "icon.png",
  types: ["electric"],
};

// base stats reais do Pikachu — a carta desenha as 6 barras a partir deles
const base = { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 };

describe("toPackCardDTO", () => {
  it("mapeia bst e raridade a partir do id", () => {
    const dto = toPackCardDTO(25, card, base, 1, true);
    expect(dto.pokemonId).toBe(25);
    expect(dto.bst).toBe(320); // Pikachu, do índice gerado
    expect(dto.rarity).toBe("common");
    expect(dto.isNew).toBe(true);
    expect(dto.card?.name).toBe("pikachu");
  });

  it("card null (espécie fora do espelho) => card null, mas a carta ainda é concedida", () => {
    const dto = toPackCardDTO(150, null, null, 1, true);
    expect(dto.card).toBeNull();
    expect(dto.pokemonId).toBe(150);
    expect(dto.bst).toBe(680); // Mewtwo — bst vem do índice estático, não da rede
    expect(dto.rarity).toBe("legendary");
  });
});
