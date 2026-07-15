import type { NormalizedPokemon } from "@/src/lib/pokeapi";
import { toPokemonCardDTO } from "@/src/modules/pokedex";
import { bstOf, rarityTier } from "../domain/rarity";
import type { PackCardDTO } from "../ui/types";

/**
 * Uma carta sorteada → DTO pronto pra tela.
 *
 * O visual reusa `toPokemonCardDTO` do pokedex (whitelist de 5 campos), então o
 * movepool inteiro do NormalizedPokemon (~130 moves com url) NÃO trafega pro
 * cliente — mesma proteção de PESO que a coleção já tem. bst/rarity vêm do
 * domain, campo a campo. Nunca uma linha do Prisma nem o payload cru da PokéAPI.
 */
export function toPackCardDTO(
  pokemonId: number,
  pokemon: NormalizedPokemon | null,
  isNew: boolean
): PackCardDTO {
  const bst = bstOf(pokemonId);
  return {
    pokemonId,
    card: pokemon ? toPokemonCardDTO(pokemon) : null,
    bst,
    rarity: rarityTier(bst),
    isNew,
  };
}
