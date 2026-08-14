import { describe, expect, it } from "vitest";
import {
  EGG_BIRTH_LEVEL,
  resolveBreeding,
  resolveBreedingEitherWay,
} from "@/src/modules/pokemon/domain/breeding";
import { STARTING_LEVEL } from "@/src/modules/pokemon/domain/leveling";

// A compatibilidade é regra do JOGO, não da série: nada de egg group, gênero ou
// hatch counter. Dois pokémon cruzam quando um SABE um golpe que a espécie do
// outro APRENDE POR OVO.

const pai = {
  userPokemonId: "up-pai",
  pokemonId: "sp-pikachu",
  playableMoveIds: ["mv-thunderbolt", "mv-wish"],
  eggMoveIds: [],
};

const mae = {
  userPokemonId: "up-mae",
  pokemonId: "sp-eevee",
  playableMoveIds: ["mv-tackle"],
  eggMoveIds: ["mv-wish", "mv-curse"],
};

describe("resolveBreeding", () => {
  it("o filhote é da espécie de quem APRENDE por ovo, com o golpe de quem SABE", () => {
    const r = resolveBreeding({ a: pai, b: mae });

    // Eevee aprende Wish por ovo; Pikachu já sabe Wish. Nasce um Eevee com Wish.
    expect(r).toEqual({
      childSpeciesId: "sp-eevee",
      moveId: "mv-wish",
      fromParentId: "up-pai",
      speciesFromParentId: "up-mae",
    });
  });

  it("sem golpe em comum não nasce nada", () => {
    const semNada = { ...mae, eggMoveIds: ["mv-curse"] };
    expect(resolveBreeding({ a: pai, b: semNada })).toBeNull();
  });

  it("a mesma carta não cruza consigo mesma", () => {
    expect(resolveBreeding({ a: pai, b: { ...mae, userPokemonId: "up-pai" } })).toBeNull();
  });

  it("a escolha do golpe é DETERMINÍSTICA quando há mais de um em comum", () => {
    // Duas lambdas (o preview e o cruzamento) têm que chegar no mesmo golpe,
    // senão a tela promete um e o banco grava outro. Sortear aqui também tocaria
    // o rng, que o resto do jogo mantém intocado por quem não tem motivo.
    const paiRico = { ...pai, playableMoveIds: ["mv-zebra", "mv-alfa", "mv-meio"] };
    const maeRica = { ...mae, eggMoveIds: ["mv-zebra", "mv-alfa", "mv-meio"] };

    const primeiro = resolveBreeding({ a: paiRico, b: maeRica });
    const segundo = resolveBreeding({ a: paiRico, b: maeRica });

    expect(primeiro?.moveId).toBe("mv-alfa");
    expect(segundo?.moveId).toBe(primeiro?.moveId);
  });

  it("não confunde 'sabe' com 'aprende por ovo' — o sentido importa", () => {
    // Aqui a MÃE sabe Wish e o PAI é quem aprende por ovo. No sentido a→b isso
    // não casa: `a.playableMoveIds` não tem nada de `b.eggMoveIds`.
    const invertido = resolveBreeding({
      a: { ...pai, playableMoveIds: ["mv-thunderbolt"] },
      b: { ...mae, eggMoveIds: ["mv-wish"] },
    });
    expect(invertido).toBeNull();
  });
});

describe("resolveBreedingEitherWay", () => {
  it("acha o cruzamento mesmo se o jogador escolher os cards na ordem 'errada'", () => {
    // O jogador escolhe dois cards, não "quem é o pai" — e não tem como saber
    // qual das espécies aprende o golpe por ovo. Exigir a ordem faria metade das
    // tentativas válidas parecerem incompatíveis.
    const naOrdem = resolveBreedingEitherWay(pai, mae);
    const aoContrario = resolveBreedingEitherWay(mae, pai);

    expect(naOrdem?.childSpeciesId).toBe("sp-eevee");
    expect(aoContrario?.childSpeciesId).toBe("sp-eevee");
    expect(aoContrario?.moveId).toBe("mv-wish");
  });

  it("incompatível nos dois sentidos continua incompatível", () => {
    const a = { ...pai, playableMoveIds: ["mv-x"], eggMoveIds: ["mv-y"] };
    const b = { ...mae, playableMoveIds: ["mv-z"], eggMoveIds: ["mv-w"] };
    expect(resolveBreedingEitherWay(a, b)).toBeNull();
  });
});

describe("EGG_BIRTH_LEVEL", () => {
  it("o filhote nasce no mesmo nível de uma carta de pacote", () => {
    // Se divergisse, o cruzamento viraria atalho (ou punição) de progressão.
    expect(EGG_BIRTH_LEVEL).toBe(STARTING_LEVEL);
  });
});
