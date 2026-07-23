import { prisma } from "@/src/lib/prisma";
import type { BattleMoveDef } from "../domain/types";
import { toBattleDTO } from "../queries/toBattleDTO";
import { tryResolveTurn } from "./resolveTurn";

export type SubmitActionInput = {
  round: number;
  cardSlot: number; // 0..5 na barra
};

// Registra a carta de UM jogador no round (POST /api/battle/[id]/move).
//
// Simultâneo: não existe "é a sua vez" — os dois podem submeter a qualquer
// momento do round, e a carta fica GUARDADA (segredo) até o outro submeter ou o
// tempo estourar. Por isso `tryResolveTurn` é chamado aqui mesmo: quem submete
// por ÚLTIMO é quem, no mesmo request, faz o turno resolver. Quem submeteu
// primeiro descobre pelo push do Realtime (ou pelo polling).
//
// Trocar de ideia é permitido enquanto o round não resolveu (o upsert
// sobrescreve o cardSlot) — e é seguro, porque a carta do oponente nunca sai do
// servidor antes da resolução (toBattleDTO).
export async function submitAction(battleId: string, userId: string, body: SubmitActionInput) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { participants: { include: { pokemons: true } } },
  });
  if (!battle) return { error: "not_found" as const };
  if (battle.status !== "IN_PROGRESS") return { error: "finished" as const };

  const me = battle.participants.find((p) => p.userId === userId);
  if (!me) return { error: "forbidden" as const };

  if (body.round !== battle.round) {
    return { error: "stale_turn" as const, round: battle.round };
  }

  const active = me.pokemons.find((p) => p.slot === me.activeSlot);
  if (!active || active.fainted) return { error: "validation" as const, message: "Seu pokémon ativo desmaiou" };

  const moves = (active.moves as unknown as BattleMoveDef[] | null) ?? [];
  if (body.cardSlot == null || body.cardSlot < 0 || body.cardSlot >= moves.length) {
    return { error: "validation" as const, message: "Carta inválida" };
  }
  const card = moves[body.cardSlot];
  // PP zerado só é jogada válida quando NENHUMA carta tem PP (o engine usa
  // STRUGGLE). Enquanto sobrar outra com PP, o slot esgotado é recusado aqui.
  if (card.currentPp <= 0 && moves.some((m) => m.currentPp > 0)) {
    return { error: "validation" as const, message: "Essa carta está sem PP" };
  }

  await prisma.battleAction.upsert({
    where: { battleId_round_userId: { battleId, round: battle.round, userId } },
    update: { cardSlot: body.cardSlot },
    create: { battleId, userId, round: battle.round, cardSlot: body.cardSlot },
  });

  const resolved = await tryResolveTurn(battleId);
  if (!resolved) return { error: "not_found" as const };

  // Mesmo DTO que readBattleState devolve: a resposta do POST não pode vazar a
  // carta que o oponente já escolheu neste round. Ver toBattleDTO.
  return { battle: toBattleDTO(resolved) };
}
