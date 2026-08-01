import { describe, expect, it } from "vitest";
import { toCollectionCardDTO } from "@/src/modules/pokedex/queries/toCollectionPageDTO";

// A linha crua do UserPokemon+Pokemon carrega coisa que a tela não precisa
// (userId, pokemonId interno, fetchedAt, o learnset inteiro). Linha de Prisma
// NUNCA vai crua pro browser — o mapper é whitelist explícita, e este teste é o
// que tranca isso por construção.

const linha = {
  id: "up-1",
  level: 12,
  xp: 1728,
  userId: "SEGREDO-DO-DONO",
  pokemon: {
    pokemonApiId: 4,
    name: "charmander",
    spriteUrl: "https://img/4.png",
    types: ["fire"],
    baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    bst: 309,
    rarity: "common",
  },
};

describe("toCollectionCardDTO", () => {
  it("monta a carta com bst e rarity vindos da COLUNA", () => {
    const dto = toCollectionCardDTO(linha as never);

    expect(dto.userPokemonId).toBe("up-1");
    expect(dto.pokemonId).toBe(4);
    expect(dto.level).toBe(12);
    expect(dto.bst).toBe(309);
    expect(dto.rarity).toBe("common");
    expect(dto.pokemon).toEqual({
      id: 4,
      name: "charmander",
      artworkUrl: "https://img/4.png",
      iconUrl: "https://img/4.png",
      types: ["fire"],
    });
  });

  it("não vaza campo fora da whitelist", () => {
    const serializado = JSON.stringify(toCollectionCardDTO(linha as never));
    expect(serializado).not.toContain("SEGREDO-DO-DONO");
    expect(serializado).not.toContain("userId");
  });
});
