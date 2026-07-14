import { NextRequest, NextResponse } from "next/server";


import { headers } from "next/headers";

import type { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { tryResolveTurn } from "@/src/modules/battle/nao-sei-oque-nomear/resolve";
import { prisma } from "@/src/lib/prisma";

type MoveBody = {
  turnNumber: number;
  actionType: "MOVE" | "SWITCH";
  moveSlot?: number;
  switchToSlot?: number;
};

type ParticipantWithPokemons = Prisma.BattleParticipantGetPayload<{ include: { pokemons: true } }>;

function validateAction(body: MoveBody, participant: ParticipantWithPokemons): string | null {
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
  const moves = (active?.moves as { name: string }[] | undefined) ?? [];
  if (!moves[body.moveSlot]) return "Esse move não existe pra esse pokémon";
  return null;
}

// POST /api/battle/[id]/move — registra a jogada do turno e tenta resolver
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id: battleId } = await params;
  const body = (await req.json()) as MoveBody;

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { participants: { include: { pokemons: true } } },
  });
  if (!battle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (battle.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Essa partida já terminou" }, { status: 400 });
  }

  const me = battle.participants.find((p) => p.userId === userId);
  if (!me) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  if (body.turnNumber !== battle.currentTurn) {
    return NextResponse.json({ error: "Turno desatualizado", currentTurn: battle.currentTurn }, { status: 409 });
  }

  const validationError = validateAction(body, me);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

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
  return NextResponse.json(resolved);
}
