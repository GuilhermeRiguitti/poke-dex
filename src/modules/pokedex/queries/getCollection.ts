import { prisma } from "@/src/lib/prisma";
import { readDeck } from "@/src/modules/deck";
import type { CollectionCardDTO, CollectionDTO, PokemonCardDTO } from "../ui/types";

/**
 * A coleção do usuário + o deck dele, prontos pra tela. Não escreve nada.
 *
 * Agora tudo vem do ESPELHO LOCAL (UserPokemon → Pokemon): ZERO chamadas de
 * rede. O antigo N+1 (um fetch por pokémon) morreu de vez — a Fase 0 semeou
 * nome/sprite/tipos no nosso banco, então a carta desenha direto da linha.
 */
export async function getCollection(userId: string): Promise<CollectionDTO> {
  const [userPokemons, deck] = await Promise.all([
    prisma.userPokemon.findMany({
      where: { userId },
      orderBy: { capturedAt: "asc" },
      select: {
        id: true,
        level: true,
        xp: true,
        pokemon: { select: { pokemonApiId: true, name: true, spriteUrl: true, types: true } },
      },
    }),
    readDeck(userId),
  ]);

  const cards: CollectionCardDTO[] = userPokemons.map((up) => {
    const card: PokemonCardDTO = {
      id: up.pokemon.pokemonApiId,
      name: up.pokemon.name,
      artworkUrl: up.pokemon.spriteUrl,
      iconUrl: up.pokemon.spriteUrl,
      types: up.pokemon.types as string[],
    };
    return {
      userPokemonId: up.id,
      pokemonId: up.pokemon.pokemonApiId,
      level: up.level,
      xp: up.xp,
      pokemon: card,
    };
  });

  return {
    cards,
    deck: deck
      ? { id: deck.id, slots: deck.slots.map((s) => ({ id: s.id, userPokemonId: s.userPokemonId })) }
      : null,
  };
}
