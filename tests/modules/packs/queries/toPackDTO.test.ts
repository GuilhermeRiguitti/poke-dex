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

describe("toPackCardDTO", () => {
  it("mapeia bst e raridade a partir do id", () => {
    const dto = toPackCardDTO(25, card, true);
    expect(dto.pokemonId).toBe(25);
    expect(dto.bst).toBe(320); // Pikachu, do índice gerado
    expect(dto.rarity).toBe("common");
    expect(dto.isNew).toBe(true);
    expect(dto.card?.name).toBe("pikachu");
  });

  it("card null (espécie fora do espelho) => card null, mas a carta ainda é concedida", () => {
    const dto = toPackCardDTO(150, null, true);
    expect(dto.card).toBeNull();
    expect(dto.pokemonId).toBe(150);
    expect(dto.bst).toBe(680); // Mewtwo — bst vem do índice estático, não da rede
    expect(dto.rarity).toBe("legendary");
  });
});
