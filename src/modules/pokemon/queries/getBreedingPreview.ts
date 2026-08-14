import { prisma } from "@/src/lib/prisma";
import { resolveBreedingEitherWay } from "../domain/breeding";
import { getUnlockedMoveIds } from "./getUnlockedMoveIds";
import { readEggMoveIds } from "./readEggMoveIds";

// O que SAIRIA deste cruzamento, sem gastar o dia. SÓ LÊ.
//
// Existe porque o limite é um por dia UTC: descobrir que dois pais são
// incompatíveis QUEIMANDO a tentativa seria punir o jogador por não conhecer uma
// tabela que o jogo não mostra. Aqui ele testa à vontade e só confirma quando
// vale.
//
// Repete a mesma resolução do command de propósito — a regra é a mesma função
// pura (`resolveBreedingEitherWay`), então preview e resultado não têm como
// divergir. O que o command tem a mais é o claim e a escrita.

export interface BreedingPreviewDTO {
  compatible: boolean;
  /** Nome da espécie que nasceria. null quando incompatível. */
  childName: string | null;
  childSpriteUrl: string | null;
  /** Nome do egg move que o filhote já saberia. */
  moveName: string | null;
}

export async function getBreedingPreview(
  userId: string,
  parentAId: string,
  parentBId: string,
): Promise<BreedingPreviewDTO | null> {
  if (parentAId === parentBId) return { compatible: false, childName: null, childSpriteUrl: null, moveName: null };

  const parents = await prisma.userPokemon.findMany({
    where: { id: { in: [parentAId, parentBId] }, userId },
    select: { id: true, pokemonId: true, level: true },
  });
  // `null` = não são suas (ou não existem). Quem traduz em 404 é a rota.
  if (parents.length !== 2) return null;

  const a = parents.find((p) => p.id === parentAId)!;
  const b = parents.find((p) => p.id === parentBId)!;

  const [aPlayable, bPlayable, aEgg, bEgg] = await Promise.all([
    getUnlockedMoveIds({ userPokemonId: a.id, pokemonId: a.pokemonId, level: a.level }),
    getUnlockedMoveIds({ userPokemonId: b.id, pokemonId: b.pokemonId, level: b.level }),
    readEggMoveIds(a.pokemonId),
    readEggMoveIds(b.pokemonId),
  ]);

  const match = resolveBreedingEitherWay(
    { userPokemonId: a.id, pokemonId: a.pokemonId, playableMoveIds: [...aPlayable], eggMoveIds: aEgg },
    { userPokemonId: b.id, pokemonId: b.pokemonId, playableMoveIds: [...bPlayable], eggMoveIds: bEgg },
  );
  if (!match) return { compatible: false, childName: null, childSpriteUrl: null, moveName: null };

  const [especie, golpe] = await Promise.all([
    prisma.pokemon.findUnique({
      where: { id: match.childSpeciesId },
      select: { name: true, spriteUrl: true },
    }),
    prisma.move.findUnique({ where: { id: match.moveId }, select: { name: true } }),
  ]);

  return {
    compatible: true,
    childName: especie?.name ?? null,
    childSpriteUrl: especie?.spriteUrl ?? null,
    moveName: golpe?.name ?? null,
  };
}
