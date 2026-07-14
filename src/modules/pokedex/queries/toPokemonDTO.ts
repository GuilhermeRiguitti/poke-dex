import type { NormalizedPokemon } from "@/src/lib/pokeapi";
import type { PokemonCardDTO, PokemonDetailDTO } from "../ui/types";

/** Quantos moves a página de detalhe mostra (o movepool inteiro não vai pro cliente). */
export const DETAIL_MOVES_SHOWN = 12;

// Mappers explícitos, campo a campo. O NormalizedPokemon tem coisas que a UI
// não usa e que não têm por que trafegar: `moves` inteiro (~130 entradas com
// url em cada uma), `stats[].effort`, `baseExperience`, sprites de costas.
//
// Aqui o vazamento não é de segurança como o `pendingMoves` do battle — é de
// PESO. Mas a regra é a mesma e o mapper é o mesmo lugar: whitelist explícita,
// e um teste que trava o buraco.

export function toPokemonCardDTO(pokemon: NormalizedPokemon): PokemonCardDTO {
  return {
    id: pokemon.id,
    name: pokemon.name,
    artworkUrl: pokemon.sprites.artwork ?? pokemon.sprites.front_default,
    iconUrl: pokemon.sprites.front_default ?? pokemon.sprites.artwork,
    types: pokemon.types.map((t) => t.type.name),
  };
}

export function toPokemonDetailDTO(pokemon: NormalizedPokemon): PokemonDetailDTO {
  return {
    id: pokemon.id,
    name: pokemon.name,
    artworkUrl: pokemon.sprites.artwork ?? pokemon.sprites.front_default,
    types: pokemon.types.map((t) => t.type.name),
    height: pokemon.height,
    weight: pokemon.weight,
    stats: pokemon.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    moves: pokemon.moves.slice(0, DETAIL_MOVES_SHOWN).map((m) => m.move.name),
    totalMoves: pokemon.moves.length,
  };
}
