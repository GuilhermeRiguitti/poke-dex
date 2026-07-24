import { prisma } from "@/src/lib/prisma";
import { isUnlockedAt, PLAYABLE_LEARN_METHOD } from "@/src/modules/pokedex";
import type { LearnsetMoveDTO } from "../ui/types";

const DAMAGE_CLASSES = new Set(["physical", "special", "status"]);

/**
 * O learnset da espécie de um UserPokemon do jogador — as cartas que ele pode
 * escolher pro loadout. Só leitura. Devolve `null` se o UserPokemon não é dele
 * (id de outro dono responde igual a inexistente).
 *
 * FIEL À SÉRIE: entram os moves de LEVEL-UP (cada um com o nível em que é
 * aprendido + se já está destravado pro nível ATUAL) E os de MÁQUINA (TM), que
 * NÃO vêm por nível — são ensinados gastando 1 token de TM (training/applyTM).
 *
 * `unlocked` = já dá pra pôr no deck: level-up liberado pelo nível OU concedido
 * (o UserPokemonMove deste pokémon). `teachableViaTm` marca as de máquina, pra a
 * UI mostrar o botão "Ensinar (1 TM)" nas que ainda não foram concedidas.
 *
 * Devolvemos os TRAVADOS de propósito (ver "aprende no nv. 22" / "ensinável por
 * TM" é metade da progressão). Quem impede de montar não é esta query e sim
 * addToDeck — a UI é conveniência, a regra é do servidor.
 *
 * Ordena: level-up antes de TM; dentro, por nível de aprendizado e, empatando,
 * pelo mais forte.
 */
export async function readLearnset(userId: string, userPokemonId: string): Promise<LearnsetMoveDTO[] | null> {
  const up = await prisma.userPokemon.findUnique({
    where: { id: userPokemonId },
    select: { userId: true, pokemonId: true, level: true },
  });
  if (!up || up.userId !== userId) return null;

  const [learnset, granted] = await Promise.all([
    prisma.pokemonMove.findMany({
      where: { pokemonId: up.pokemonId, learnMethod: { in: [PLAYABLE_LEARN_METHOD, "machine"] } },
      select: {
        levelLearnedAt: true,
        learnMethod: true,
        move: { select: { id: true, name: true, type: true, power: true, damageClass: true } },
      },
    }),
    prisma.userPokemonMove.findMany({ where: { userPokemonId }, select: { moveId: true } }),
  ]);
  const grantedSet = new Set(granted.map((g) => g.moveId));

  return learnset
    .map(({ move, levelLearnedAt, learnMethod }) => {
      const teachableViaTm = learnMethod === "machine";
      // TM: só desbloqueia sendo concedida. Level-up: pelo nível OU concedida
      // (raro, mas mantém a regra única — mergePlayableMoveIds).
      const unlocked = teachableViaTm
        ? grantedSet.has(move.id)
        : isUnlockedAt({ learnMethod, levelLearnedAt }, up.level) || grantedSet.has(move.id);
      return {
        moveId: move.id,
        name: move.name,
        type: move.type,
        power: move.power,
        damageClass: (DAMAGE_CLASSES.has(move.damageClass) ? move.damageClass : "physical") as LearnsetMoveDTO["damageClass"],
        levelLearnedAt,
        unlocked,
        teachableViaTm,
      };
    })
    .sort(
      (a, b) =>
        Number(a.teachableViaTm) - Number(b.teachableViaTm) ||
        a.levelLearnedAt - b.levelLearnedAt ||
        (b.power ?? -1) - (a.power ?? -1) ||
        a.name.localeCompare(b.name)
    );
}
