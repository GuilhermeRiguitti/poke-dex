import { fetchPokemon } from "@/src/lib/pokeapi";
import type { PokemonDetailDTO } from "../ui/types";
import { toPokemonDetailDTO } from "./toPokemonDTO";

/**
 * O pokémon da página de detalhe. null se não existe (a page faz notFound()).
 * Só leitura — o fetch é read-through no cache do Next.
 */
export async function getPokemonDetail(idOrName: string): Promise<PokemonDetailDTO | null> {
  const pokemon = await fetchPokemon(idOrName);
  return pokemon ? toPokemonDetailDTO(pokemon) : null;
}
