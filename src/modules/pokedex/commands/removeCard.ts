import { prisma } from "@/src/lib/prisma";

export type RemoveCardResult = { ok: true } | { ok: false; error: "not_found" };

/**
 * Solta um pokémon (tira da coleção). Recebe o id do UserPokemon.
 *
 * O DeckSlot correspondente cai junto por onDelete: Cascade — soltar um pokémon
 * que está num loadout tira ele do deck também, que é o que o jogador espera.
 *
 * O `userId` vai no próprio where do delete (não num findUnique antes): impede
 * soltar a carta de outro jogador com um id qualquer, sem ida extra ao banco nem
 * janela de corrida. count === 0 cobre "não existe" e "não é seu".
 */
export async function removeCard(userId: string, userPokemonId: string): Promise<RemoveCardResult> {
  const { count } = await prisma.userPokemon.deleteMany({
    where: { id: userPokemonId, userId },
  });

  return count > 0 ? { ok: true } : { ok: false, error: "not_found" };
}
