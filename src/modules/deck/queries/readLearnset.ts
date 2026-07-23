import { prisma } from "@/src/lib/prisma";
import { isUnlockedAt, PLAYABLE_LEARN_METHOD } from "@/src/modules/pokedex";
import type { LearnsetMoveDTO } from "../ui/types";

const DAMAGE_CLASSES = new Set(["physical", "special", "status"]);

/**
 * O learnset da espécie de um UserPokemon do jogador — as cartas que ele pode
 * escolher pro loadout. Só leitura. Devolve `null` se o UserPokemon não é dele
 * (id de outro dono responde igual a inexistente).
 *
 * FIEL À SÉRIE (a virada desta fatia): só entram moves de LEVEL-UP, e cada um
 * vem com o nível em que é aprendido + se já está destravado pro nível ATUAL
 * daquele pokémon. Antes, todo pokémon tinha o learnset inteiro desde sempre —
 * o que fazia o nível não significar nada além de stat.
 *
 * Devolvemos também os ainda TRAVADOS (com `unlocked: false`) de propósito: ver
 * "aprende no nv. 22" é metade da progressão. Quem impede de montar não é esta
 * query e sim addToDeck — a UI é conveniência, a regra é do servidor.
 *
 * Ordena por nível de aprendizado (o mais cedo primeiro) e, empatando, pelo
 * mais forte: é a ordem em que o jogador realmente ganha as cartas.
 */
export async function readLearnset(userId: string, userPokemonId: string): Promise<LearnsetMoveDTO[] | null> {
  const up = await prisma.userPokemon.findUnique({
    where: { id: userPokemonId },
    select: { userId: true, pokemonId: true, level: true },
  });
  if (!up || up.userId !== userId) return null;

  const learnset = await prisma.pokemonMove.findMany({
    where: { pokemonId: up.pokemonId, learnMethod: PLAYABLE_LEARN_METHOD },
    select: {
      levelLearnedAt: true,
      learnMethod: true,
      move: { select: { id: true, name: true, type: true, power: true, damageClass: true } },
    },
  });

  return learnset
    .map(({ move, levelLearnedAt, learnMethod }) => ({
      moveId: move.id,
      name: move.name,
      type: move.type,
      power: move.power,
      damageClass: (DAMAGE_CLASSES.has(move.damageClass) ? move.damageClass : "physical") as LearnsetMoveDTO["damageClass"],
      levelLearnedAt,
      unlocked: isUnlockedAt({ learnMethod, levelLearnedAt }, up.level),
    }))
    .sort(
      (a, b) =>
        a.levelLearnedAt - b.levelLearnedAt ||
        (b.power ?? -1) - (a.power ?? -1) ||
        a.name.localeCompare(b.name)
    );
}
