import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { DECK_LIMIT, readDeckRoster } from "@/src/modules/deck";
import type { BattlePokemonState } from "../domain/types";
import { buildTeamSnapshot } from "./buildTeamSnapshot";
import { tryResolveTurn } from "./resolveTurn";

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

// Entra na fila de matchmaking; pareia na hora se possível (POST /api/battle/queue)
export async function enqueueBattle(userId: string, deckId: string) {
  const roster = await readDeckRoster(userId, deckId, DECK_LIMIT);
  if (roster.length === 0) return { error: "empty_deck" as const };

  // Já estou numa partida em andamento? Então é pra lá que eu volto — não entro
  // na fila de novo.
  //
  // MAS: essa partida pode estar ZUMBI. Se os dois jogadores fecharam a aba,
  // ninguém faz polling, e sem polling nada resolve o turno (não há worker —
  // CLAUDE.md, regra 5). A partida fica IN_PROGRESS pra sempre, e como este
  // check devolve ela, os DOIS ficam presos: nunca mais conseguem entrar numa
  // fila. Não existe cron pra limpar isso (Hobby roda 1x por dia).
  //
  // Então este request é a única coisa viva que pode encerrá-la — e encerra:
  // tryResolveTurn conta as janelas de timeout vencidas de forma retroativa, e
  // uma partida abandonada há tempo suficiente morre aqui, em ABANDONED. Se ela
  // morrer, o jogador segue direto pro matchmaking, sem esperar 3×90s.
  const existingBattle = await prisma.battleParticipant.findFirst({
    where: { userId, battle: { status: "IN_PROGRESS" } },
    select: { battleId: true },
  });
  if (existingBattle) {
    const resolved = await tryResolveTurn(existingBattle.battleId);
    if (resolved?.status === "IN_PROGRESS") {
      return { matched: true as const, battleId: existingBattle.battleId };
    }
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
    return { matched: false as const, queued: true as const };
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
    return { error: "snapshot_failed" as const };
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

  return { matched: true as const, battleId: battle.id, created: true as const };
}
