import { prisma } from "@/src/lib/prisma";
import { readLearnset } from "@/src/modules/deck";
import type { LearnsetMoveDTO } from "@/src/modules/deck";

/**
 * As skills que EU posso montar num pokémon do MEU time nesta partida.
 *
 * Rota própria em vez de mandar no `BattleDTO`: o DTO da partida leva os dois
 * lados, e pendurar o learnset nele entregaria ao oponente o repertório
 * possível do meu time inteiro — a mesma classe de vazamento que o `cardSlot`
 * (regra 3). Aqui o servidor resolve quem sou eu e devolve só o meu.
 *
 * O filtro usa o nível CONGELADO no snapshot, não o atual do UserPokemon: subir
 * de nível em outra aba não pode destravar carta pra partida em andamento. É a
 * mesma regra que o submitAction aplica ao validar — a tela mostra exatamente o
 * que o servidor vai aceitar.
 *
 * Devolve `null` quando a partida não é minha ou o slot não existe: id de outro
 * responde igual a inexistente.
 */
export async function getLoadoutOptions(
  battleId: string,
  userId: string,
  slot: number
): Promise<LearnsetMoveDTO[] | null> {
  const mon = await prisma.battlePokemon.findFirst({
    where: { slot, participant: { battleId, userId } },
    select: { userPokemonId: true, level: true },
  });
  if (!mon || !mon.userPokemonId) return null;

  const learnset = await readLearnset(userId, mon.userPokemonId);
  if (!learnset) return null;

  // `unlocked` do readLearnset olha o nível ATUAL do UserPokemon. Aqui o que
  // vale é o do snapshot, então recalculamos com ele.
  return learnset.map((c) => ({
    ...c,
    unlocked: c.teachableViaTm ? c.unlocked : c.unlocked && c.levelLearnedAt <= mon.level,
  }));
}
