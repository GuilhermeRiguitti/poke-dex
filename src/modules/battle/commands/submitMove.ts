import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import type { BattleMoveDef } from "../domain/types";
import { toBattleDTO } from "../queries/toBattleDTO";
import { tryResolveTurn } from "./resolveTurn";

export type SubmitMoveInput = {
  turnNumber: number;
  actionType: "MOVE" | "SWITCH";
  moveSlot?: number;
  switchToSlot?: number;
};

type ParticipantWithPokemons = Prisma.BattleParticipantGetPayload<{ include: { pokemons: true } }>;

function validateAction(body: SubmitMoveInput, participant: ParticipantWithPokemons): string | null {
  const active = participant.pokemons.find((p) => p.slot === participant.activeSlot);

  if (body.actionType === "SWITCH") {
    if (body.switchToSlot == null) return "switchToSlot is required for SWITCH";
    const target = participant.pokemons.find((p) => p.slot === body.switchToSlot);
    if (!target) return "Slot de troca inválido";
    if (target.fainted) return "Não é possível trocar para um pokémon desmaiado";
    if (target.slot === participant.activeSlot) return "Esse pokémon já está em campo";
    return null;
  }

  // MOVE
  if (active?.fainted) return "Seu pokémon ativo desmaiou — troque antes de atacar";
  if (body.moveSlot == null || body.moveSlot < 0 || body.moveSlot > 3) return "moveSlot inválido";
  const moves = (active?.moves as BattleMoveDef[] | undefined) ?? [];
  const move = moves[body.moveSlot];
  if (!move) return "Esse move não existe pra esse pokémon";

  // PP zerado só é jogada válida quando NENHUM golpe tem PP — aí o engine usa
  // struggle (ver domain/engine.ts). Enquanto sobrar outro golpe com PP, mandar
  // o slot esgotado é recusado aqui: o PP é limite de verdade, e ele não pode
  // ser burlado por quem chama a rota direto, sem passar pelos botões da UI.
  if (move.currentPp <= 0 && moves.some((m) => m.currentPp > 0)) {
    return "Esse golpe está sem PP";
  }
  return null;
}

// Registra a jogada do turno e tenta resolver (POST /api/battle/[id]/move)
export async function submitMove(battleId: string, userId: string, body: SubmitMoveInput) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { participants: { include: { pokemons: true } } },
  });
  if (!battle) return { error: "not_found" as const };
  if (battle.status !== "IN_PROGRESS") return { error: "finished" as const };

  const me = battle.participants.find((p) => p.userId === userId);
  if (!me) return { error: "forbidden" as const };

  if (body.turnNumber !== battle.currentTurn) {
    return { error: "stale_turn" as const, currentTurn: battle.currentTurn };
  }

  const validationError = validateAction(body, me);
  if (validationError) return { error: "validation" as const, message: validationError };

  await prisma.battlePendingMove.upsert({
    where: { battleId_userId_turnNumber: { battleId, userId, turnNumber: battle.currentTurn } },
    update: {
      actionType: body.actionType,
      moveSlot: body.actionType === "MOVE" ? body.moveSlot : null,
      switchToSlot: body.actionType === "SWITCH" ? body.switchToSlot : null,
    },
    create: {
      battleId,
      userId,
      turnNumber: battle.currentTurn,
      actionType: body.actionType,
      moveSlot: body.actionType === "MOVE" ? body.moveSlot : null,
      switchToSlot: body.actionType === "SWITCH" ? body.switchToSlot : null,
    },
  });

  const resolved = await tryResolveTurn(battleId);
  if (!resolved) return { error: "not_found" as const };

  // Mesmo DTO que getBattleState devolve: a resposta do POST /move é o que o
  // client usa pra atualizar a tela, então ela não pode vazar o que a linha
  // crua carrega (pendingMoves = a jogada do oponente neste turno).
  return { battle: toBattleDTO(resolved) };
}
