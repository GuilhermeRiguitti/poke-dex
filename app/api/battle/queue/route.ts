import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { buildTeamSnapshot } from "@/lib/battle/snapshot";
import { BattlePokemonState } from "@/lib/battle/types";
import type { Prisma } from "@prisma/client";

const MAX_MATCH_ATTEMPTS = 3;

function toPokemonCreateInput(
  state: BattlePokemonState,
  spriteUrl: string | null
): Prisma.BattlePokemonCreateWithoutParticipantInput {
  return {
    slot: state.slot,
    pokemonId: state.pokemonId,
    name: state.name,
    spriteUrl,
    types: state.types as unknown as Prisma.InputJsonValue,
    level: state.level,
    stats: state.stats as unknown as Prisma.InputJsonValue,
    maxHp: state.maxHp,
    currentHp: state.currentHp,
    fainted: state.fainted,
    moves: state.moves as unknown as Prisma.InputJsonValue,
  };
}

// POST /api/battle/queue — entra na fila de matchmaking; pareia na hora se possível
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { deckId } = (await req.json()) as { deckId?: string };
  if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });

  const deck = await prisma.deck.findFirst({ where: { id: deckId, userId }, include: { deckCards: true } });
  if (!deck || deck.deckCards.length === 0) {
    return NextResponse.json({ error: "Deck vazio ou não encontrado" }, { status: 400 });
  }

  const existingBattle = await prisma.battleParticipant.findFirst({
    where: { userId, battle: { status: "IN_PROGRESS" } },
    select: { battleId: true },
  });
  if (existingBattle) {
    return NextResponse.json({ matched: true, battleId: existingBattle.battleId });
  }

  let opponent: { userId: string; deckId: string } | null = null;

  for (let attempt = 0; attempt < MAX_MATCH_ATTEMPTS && !opponent; attempt++) {
    opponent = await prisma.$transaction(async (tx) => {
      const candidate = await tx.matchmakingQueueEntry.findFirst({
        where: { userId: { not: userId } },
        orderBy: { enqueuedAt: "asc" },
      });
      if (!candidate) return null;

      const deleted = await tx.matchmakingQueueEntry.deleteMany({ where: { id: candidate.id } });
      if (deleted.count === 0) return null; // outro request já pegou esse candidato, tenta de novo

      return { userId: candidate.userId, deckId: candidate.deckId };
    });
  }

  if (!opponent) {
    await prisma.matchmakingQueueEntry.upsert({
      where: { userId },
      update: { deckId, enqueuedAt: new Date() },
      create: { userId, deckId },
    });
    return NextResponse.json({ matched: false, queued: true });
  }

  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId } });

  let teamA: Awaited<ReturnType<typeof buildTeamSnapshot>>;
  let teamB: Awaited<ReturnType<typeof buildTeamSnapshot>>;
  try {
    [teamA, teamB] = await Promise.all([
      buildTeamSnapshot(userId, deckId),
      buildTeamSnapshot(opponent.userId, opponent.deckId),
    ]);
  } catch (err) {
    console.error("buildTeamSnapshot failed:", err);
    // Devolve o oponente pra fila pra não deixar ele travado esperando.
    await prisma.matchmakingQueueEntry.upsert({
      where: { userId: opponent.userId },
      update: { deckId: opponent.deckId, enqueuedAt: new Date() },
      create: { userId: opponent.userId, deckId: opponent.deckId },
    });
    return NextResponse.json({ error: "Falha ao montar o time de batalha" }, { status: 500 });
  }

  const battle = await prisma.battle.create({
    data: {
      participants: {
        create: [
          {
            userId,
            activeSlot: 1,
            pokemons: { create: teamA.map(({ state, spriteUrl }) => toPokemonCreateInput(state, spriteUrl)) },
          },
          {
            userId: opponent.userId,
            activeSlot: 1,
            pokemons: { create: teamB.map(({ state, spriteUrl }) => toPokemonCreateInput(state, spriteUrl)) },
          },
        ],
      },
    },
  });

  return NextResponse.json({ matched: true, battleId: battle.id }, { status: 201 });
}

// DELETE /api/battle/queue — sai da fila
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ success: true });
}
