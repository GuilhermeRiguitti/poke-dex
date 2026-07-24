import { prisma } from "@/src/lib/prisma";
import type { BattleMoveDef } from "../domain/types";
import { toBattleDTO } from "../queries/toBattleDTO";
import { tryResolveTurn } from "./resolveTurn";

// A jogada de um round: um GOLPE (MOVE) ou uma TROCA (SWITCH). `cardSlot` é o
// índice do golpe (0..5); `targetSlot` é o slot do pokémon alvo da troca (1..6).
export type SubmitActionInput = {
  round: number;
  type?: "MOVE" | "SWITCH"; // ausente = MOVE (compat com o cliente antigo)
  cardSlot?: number;
  targetSlot?: number;
};

type ParticipantWithMons = {
  userId: string;
  activeSlot: number;
  pokemons: { slot: number; fainted: boolean; moves: unknown }[];
};

/** true se o ativo do participante desmaiou mas ainda há reserva viva → precisa trocar. */
function mustSwitch(p: ParticipantWithMons): boolean {
  const active = p.pokemons.find((m) => m.slot === p.activeSlot);
  return Boolean(active?.fainted) && p.pokemons.some((m) => !m.fainted);
}

// Registra a jogada de UM jogador no round (POST /api/battle/[id]/move).
//
// Simultâneo: não existe "é a sua vez" — os dois podem submeter a qualquer
// momento do round, e a jogada fica GUARDADA (segredo) até o outro submeter ou o
// tempo estourar. Por isso `tryResolveTurn` é chamado aqui: quem submete por
// ÚLTIMO é quem, no mesmo request, faz o turno resolver.
//
// TROCA FORÇADA (o ativo de alguém desmaiou): o jogo pausa até o dono do desmaio
// escolher o substituto. Nesse round só ELE joga (e só SWITCH); o oponente
// espera. Trocar de ideia é permitido enquanto o round não resolveu (upsert).
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

  const type = body.type ?? "MOVE";
  const iMustSwitch = mustSwitch(me);
  const someoneMustSwitch = battle.participants.some(mustSwitch);

  // Round de troca forçada: só o dono do desmaio joga, e só SWITCH.
  if (someoneMustSwitch) {
    if (!iMustSwitch) {
      return { error: "validation" as const, message: "Aguardando o oponente escolher um substituto" };
    }
    if (type !== "SWITCH") {
      return { error: "validation" as const, message: "Seu pokémon desmaiou — escolha um substituto" };
    }
    const target = validSwitchTarget(me, body.targetSlot);
    if (!target.ok) return { error: "validation" as const, message: target.message };
    return persist(battleId, userId, battle.round, "SWITCH", target.slot);
  }

  // Round normal: MOVE (golpe) ou SWITCH (troca voluntária, gasta o turno).
  if (type === "SWITCH") {
    const target = validSwitchTarget(me, body.targetSlot);
    if (!target.ok) return { error: "validation" as const, message: target.message };
    return persist(battleId, userId, battle.round, "SWITCH", target.slot);
  }

  const active = me.pokemons.find((p) => p.slot === me.activeSlot);
  if (!active || active.fainted) {
    return { error: "validation" as const, message: "Seu pokémon ativo desmaiou" };
  }

  const moves = (active.moves as unknown as BattleMoveDef[] | null) ?? [];
  const cardSlot = body.cardSlot;
  if (cardSlot == null || cardSlot < 0 || cardSlot >= moves.length) {
    return { error: "validation" as const, message: "Carta inválida" };
  }
  const card = moves[cardSlot];
  // PP zerado só é jogada válida quando NENHUMA carta tem PP (o engine usa
  // STRUGGLE). Enquanto sobrar outra com PP, o slot esgotado é recusado aqui.
  if (card.currentPp <= 0 && moves.some((m) => m.currentPp > 0)) {
    return { error: "validation" as const, message: "Essa carta está sem PP" };
  }

  return persist(battleId, userId, battle.round, "MOVE", cardSlot);
}

/** Valida o alvo de uma troca: existe, está vivo e não é o próprio ativo. */
function validSwitchTarget(
  me: ParticipantWithMons,
  targetSlot: number | undefined
): { ok: true; slot: number } | { ok: false; message: string } {
  if (targetSlot == null) return { ok: false, message: "Escolha um pokémon" };
  const target = me.pokemons.find((p) => p.slot === targetSlot);
  if (!target) return { ok: false, message: "Pokémon inválido" };
  if (target.fainted) return { ok: false, message: "Esse pokémon está desmaiado" };
  if (target.slot === me.activeSlot) return { ok: false, message: "Esse pokémon já está em campo" };
  return { ok: true, slot: targetSlot };
}

/** Grava a jogada (upsert do segredo) e tenta resolver o turno. */
async function persist(
  battleId: string,
  userId: string,
  round: number,
  type: "MOVE" | "SWITCH",
  cardSlot: number
) {
  await prisma.battleAction.upsert({
    where: { battleId_round_userId: { battleId, round, userId } },
    update: { type, cardSlot },
    create: { battleId, userId, round, type, cardSlot },
  });

  const resolved = await tryResolveTurn(battleId);
  if (!resolved) return { error: "not_found" as const };

  // Mesmo DTO que readBattleState devolve: a resposta do POST não pode vazar a
  // jogada que o oponente já escolheu neste round. Ver toBattleDTO.
  return { battle: toBattleDTO(resolved) };
}
