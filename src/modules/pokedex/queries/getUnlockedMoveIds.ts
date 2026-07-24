import { prisma } from "@/src/lib/prisma";
import { PLAYABLE_LEARN_METHOD, mergePlayableMoveIds } from "../domain/learnset";

/**
 * O conjunto de `moveId` que um Pokémon do jogador PODE usar: os de level-up já
 * destravados pelo nível ∪ os concedidos por fora (TM/tutor/ovo). Só leitura.
 *
 * Recebe `pokemonId`/`level` já resolvidos (quem chama já leu o UserPokemon pra
 * checar o dono), então não relê a linha à toa. A união é decidida pela regra
 * pura mergePlayableMoveIds — aqui é só o I/O das duas fontes.
 *
 * Usado por deck/addToDeck (trava do servidor) e battle/pruneLoadoutForSpecies
 * (poda pós-evolução). readLearnset NÃO usa esta função porque precisa dos
 * flags por-carta (destravada? ensinável por TM?), não só do conjunto.
 */
export async function getUnlockedMoveIds(params: {
  userPokemonId: string;
  pokemonId: string;
  level: number;
}): Promise<Set<string>> {
  const [levelUp, granted] = await Promise.all([
    prisma.pokemonMove.findMany({
      where: {
        pokemonId: params.pokemonId,
        learnMethod: PLAYABLE_LEARN_METHOD,
        levelLearnedAt: { lte: params.level },
      },
      select: { moveId: true },
    }),
    prisma.userPokemonMove.findMany({
      where: { userPokemonId: params.userPokemonId },
      select: { moveId: true },
    }),
  ]);

  return mergePlayableMoveIds(
    levelUp.map((r) => r.moveId),
    granted.map((r) => r.moveId),
  );
}
