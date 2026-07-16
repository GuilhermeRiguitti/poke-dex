import { extractIdFromUrl, fetchPokemon, fetchPokemonIndex } from "@/src/lib/pokeapi";
import { prisma } from "@/src/lib/prisma";
import { TOTAL_PAGES, pageRange } from "../domain/pagination";
import type { PokedexPageDTO } from "../ui/types";
import { toPokemonCardDTO } from "./toPokemonDTO";

/**
 * Uma página da listagem da PokéDex, com a marca de quais o usuário já capturou.
 *
 * Os fetches são todos read-through no cache do fetch do Next (force-cache, ver
 * lib/pokeapi.ts): num hit, isso aqui não bate na PokéAPI nenhuma vez. É a
 * única tela que não dá pra servir do PokeApiCache — o usuário navega 1025
 * pokémon que ele justamente NÃO tem, então não há o que pré-aquecer.
 *
 * Não escreve nada: pode ser chamada do render da page.
 */
export async function listPokedexPage(userId: string, page: number): Promise<PokedexPageDTO> {
  const { offset, limit } = pageRange(page);

  const [index, userPokemons] = await Promise.all([
    fetchPokemonIndex(offset, limit),
    prisma.userPokemon.findMany({
      where: { userId },
      select: { pokemon: { select: { pokemonApiId: true } } },
    }),
  ]);

  const pokemons = (
    await Promise.all(index.map((entry) => fetchPokemon(extractIdFromUrl(entry.url))))
  )
    .filter((p) => p !== null)
    .map(toPokemonCardDTO);

  return {
    page,
    totalPages: TOTAL_PAGES,
    pokemons,
    capturedIds: userPokemons.map((up) => up.pokemon.pokemonApiId),
  };
}
