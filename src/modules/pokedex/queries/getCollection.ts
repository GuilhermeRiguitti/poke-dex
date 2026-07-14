import { fetchPokemon } from "@/src/lib/pokeapi";
import { readCachedPokemons } from "@/src/lib/pokeapiCache";
import { prisma } from "@/src/lib/prisma";
import { readDeck } from "@/src/modules/deck";
import type { CollectionCardDTO, CollectionDTO } from "../ui/types";
import { toPokemonCardDTO } from "./toPokemonDTO";

/**
 * A coleção do usuário + o deck dele, prontos pra tela. Não escreve nada.
 *
 * ─── era aqui o N+1 ───────────────────────────────────────────────────────
 * A página fazia isto no CLIENTE: fetch("/api/cards"), e então UM
 * fetch("/api/pokeapi/{id}") POR POKÉMON da coleção, todos serializados atrás
 * do primeiro. Uma coleção de 30 cartas eram 32 requisições do browser antes
 * de pintar qualquer coisa.
 *
 * Agora são 3 queries no banco (cartas, deck, cache) e — no caminho normal —
 * ZERO requisições de rede. O truque não é "fazer o N+1 no servidor": é que
 * capturar um pokémon é um command que JÁ o busca na PokéAPI pra validar, e
 * agora grava o resultado no PokeApiCache. Tudo que está na coleção foi posto
 * lá no momento da captura, então esta leitura é hit por construção.
 *
 * O fallback de rede abaixo cobre o resto: cartas capturadas ANTES desta
 * mudança (cache frio). Ele só LÊ (fetchPokemon, cache do Next) — não grava,
 * porque isto roda no render de uma page e render de page não escreve.
 */
export async function getCollection(userId: string): Promise<CollectionDTO> {
  const [userCards, deck] = await Promise.all([
    prisma.userCard.findMany({
      where: { userId },
      select: { id: true, pokemonId: true },
      orderBy: { addedAt: "asc" },
    }),
    readDeck(userId),
  ]);

  const pokemonIds = userCards.map((c) => c.pokemonId);
  const cached = await readCachedPokemons(pokemonIds);

  const missing = pokemonIds.filter((id) => !cached.has(id));
  const fetched = await Promise.all(missing.map((id) => fetchPokemon(id)));
  for (const pokemon of fetched) {
    if (pokemon) cached.set(pokemon.id, pokemon);
  }

  const cards: CollectionCardDTO[] = userCards.map((uc) => {
    const pokemon = cached.get(uc.pokemonId);
    return {
      userCardId: uc.id,
      pokemonId: uc.pokemonId,
      pokemon: pokemon ? toPokemonCardDTO(pokemon) : null,
    };
  });

  return {
    cards,
    deck: deck ? { id: deck.id, cards: deck.cards.map((c) => ({ id: c.id, userCardId: c.userCardId })) } : null,
  };
}
