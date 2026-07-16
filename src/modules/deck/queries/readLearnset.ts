import { prisma } from "@/src/lib/prisma";
import type { LearnsetMoveDTO } from "../ui/types";

const DAMAGE_CLASSES = new Set(["physical", "special", "status"]);

/**
 * O learnset da espécie de um UserPokemon do jogador — as cartas que ele pode
 * escolher pro loadout. Só leitura. Devolve `null` se o UserPokemon não é dele
 * (id de outro dono responde igual a inexistente).
 *
 * Ordena cartas de DANO primeiro (maior power), depois as de status — é a ordem
 * que o seletor mostra, e faz os 6 slots caírem em algo jogável por padrão.
 */
export async function readLearnset(userId: string, userPokemonId: string): Promise<LearnsetMoveDTO[] | null> {
  const up = await prisma.userPokemon.findUnique({
    where: { id: userPokemonId },
    select: { userId: true, pokemonId: true },
  });
  if (!up || up.userId !== userId) return null;

  const learnset = await prisma.pokemonMove.findMany({
    where: { pokemonId: up.pokemonId },
    select: {
      move: { select: { id: true, name: true, type: true, power: true, damageClass: true } },
    },
  });

  return learnset
    .map(({ move }) => ({
      moveId: move.id,
      name: move.name,
      type: move.type,
      power: move.power,
      damageClass: (DAMAGE_CLASSES.has(move.damageClass) ? move.damageClass : "physical") as LearnsetMoveDTO["damageClass"],
    }))
    .sort((a, b) => (b.power ?? -1) - (a.power ?? -1) || a.name.localeCompare(b.name));
}
