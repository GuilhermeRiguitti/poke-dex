import { fetchAndCachePokemon } from "@/src/lib/pokeapiCache";
import { prisma } from "@/src/lib/prisma";
import { MAX_POKEMON } from "../domain/pagination";

export type AddCardResult =
  | { ok: true; userCardId: string; pokemonId: number }
  | { ok: false; error: "invalid_id" | "not_found" };

/**
 * Captura um pokémon (põe na coleção do usuário).
 *
 * O `fetchAndCachePokemon` faz duas coisas de uma vez, e as duas importam:
 *  1. VALIDA — sem isso, um POST com pokemonId: 99999 criaria uma carta de um
 *     pokémon que não existe, e a coleção quebraria pra sempre na leitura.
 *  2. AQUECE O CACHE — é o que faz a página da coleção não precisar da rede.
 *     Antes, esse fetch acontecia aqui e o resultado era JOGADO FORA; a tela
 *     da coleção ia buscar o mesmo pokémon de novo, do browser, um por um.
 *
 * `upsert` na constraint @unique([userId, pokemonId]), não findFirst+create:
 * duplo-clique no "Capturar" não cria duas cartas.
 */
export async function addCard(userId: string, pokemonId: number): Promise<AddCardResult> {
  if (!Number.isInteger(pokemonId) || pokemonId < 1 || pokemonId > MAX_POKEMON) {
    return { ok: false, error: "invalid_id" };
  }

  const pokemon = await fetchAndCachePokemon(pokemonId);
  if (!pokemon) return { ok: false, error: "not_found" };

  const userCard = await prisma.userCard.upsert({
    where: { userId_pokemonId: { userId, pokemonId } },
    update: {},
    create: { userId, pokemonId },
    select: { id: true, pokemonId: true },
  });

  return { ok: true, userCardId: userCard.id, pokemonId: userCard.pokemonId };
}
