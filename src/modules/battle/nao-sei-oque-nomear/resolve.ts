import { prisma } from "@/src/lib/prisma";
import { resolveTurn } from "./engine";
import { buildTypeChart, rowToBattlePokemonState } from "./snapshot";
import { BattleAction, BattleSideState } from "./types";
import type { BattleActionType } from "@prisma/client";

// Ponte entre o motor puro (engine.ts) e o mundo real (Prisma/HTTP). Tudo
// aqui é regra de produto nossa, sem relação com PokéAPI:
//  - cada jogador tem TURN_TIMEOUT_MS (90s) pra jogar; passou do tempo, o
//    turno resolve mesmo assim tratando quem não jogou como "sem ação"
//  - 3 turnos perdidos seguidos (MAX_CONSECUTIVE_MISSES) = derrota por
//    abandono (status ABANDONED), mesmo com pokémon vivos
export const TURN_TIMEOUT_MS = 90_000;
const MAX_CONSECUTIVE_MISSES = 3;

function toBattleAction(
  pending: { actionType: BattleActionType; moveSlot: number | null; switchToSlot: number | null } | undefined
): BattleAction {
  if (!pending) return { type: "NONE" };
  if (pending.actionType === "MOVE") {
    if (pending.moveSlot == null) return { type: "NONE" };
    return { type: "MOVE", moveSlot: pending.moveSlot };
  }
  if (pending.switchToSlot == null) return { type: "NONE" };
  return { type: "SWITCH", toSlot: pending.switchToSlot };
}

const fullBattleInclude = {
  participants: { include: { pokemons: { orderBy: { slot: "asc" as const } } } },
  turnLogs: { orderBy: { turnNumber: "desc" as const }, take: 10 },
};

/**
 * Resolve o turno atual se os dois lados já jogaram, ou se o timeout do
 * turno estourou (nesse caso quem não jogou é tratado como "sem ação").
 * Chamada tanto por POST /move (depois de registrar a jogada) quanto por
 * GET /status (polling) — a resolução não depende de nenhum worker/cron,
 * só de alguém consultar a partida depois que os dois lados agiram.
 */
export async function tryResolveTurn(battleId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { ...fullBattleInclude, pendingMoves: true },
  });
  if (!battle || battle.status !== "IN_PROGRESS") return battle;

  // Ordem determinística por userId — "A"/"B" não pode depender da ordem
  // de retorno do Prisma pra essa relação (não garantida sem orderBy), já
  // que o rótulo do lado fica persistido nos eventos do BattleTurnLog e
  // precisa ser reconstruível de forma estável depois, pelo client.
  const [pA, pB] = [...battle.participants].sort((a, b) => a.userId.localeCompare(b.userId));
  const pendingA = battle.pendingMoves.find((m) => m.userId === pA.userId && m.turnNumber === battle.currentTurn);
  const pendingB = battle.pendingMoves.find((m) => m.userId === pB.userId && m.turnNumber === battle.currentTurn);

  const timedOut = Date.now() - battle.turnStartedAt.getTime() > TURN_TIMEOUT_MS;
  const bothSubmitted = Boolean(pendingA && pendingB);
  if (!bothSubmitted && !timedOut) return battle;

  // Trava otimista: só quem conseguir avançar currentTurn de fato resolve;
  // requests concorrentes que perderem a corrida só leem o resultado.
  const claim = await prisma.battle.updateMany({
    where: { id: battleId, currentTurn: battle.currentTurn },
    data: { currentTurn: { increment: 1 }, turnStartedAt: new Date() },
  });
  if (claim.count === 0) {
    return prisma.battle.findUnique({ where: { id: battleId }, include: fullBattleInclude });
  }

  const sideAState: BattleSideState = {
    userId: pA.userId,
    activeSlot: pA.activeSlot,
    team: pA.pokemons.map(rowToBattlePokemonState),
  };
  const sideBState: BattleSideState = {
    userId: pB.userId,
    activeSlot: pB.activeSlot,
    team: pB.pokemons.map(rowToBattlePokemonState),
  };

  const typeChart = await buildTypeChart([...sideAState.team, ...sideBState.team]);

  const result = resolveTurn({
    state: { turnNumber: battle.currentTurn, sideA: sideAState, sideB: sideBState },
    actionA: toBattleAction(pendingA),
    actionB: toBattleAction(pendingB),
    typeChart,
    rng: Math.random,
  });

  await prisma.$transaction([
    ...result.state.sideA.team.map((mon) =>
      prisma.battlePokemon.updateMany({
        where: { participantId: pA.id, slot: mon.slot },
        data: { currentHp: mon.currentHp, fainted: mon.fainted },
      })
    ),
    ...result.state.sideB.team.map((mon) =>
      prisma.battlePokemon.updateMany({
        where: { participantId: pB.id, slot: mon.slot },
        data: { currentHp: mon.currentHp, fainted: mon.fainted },
      })
    ),
    prisma.battleParticipant.update({
      where: { id: pA.id },
      data: { activeSlot: result.state.sideA.activeSlot, missedTurns: pendingA ? 0 : { increment: 1 } },
    }),
    prisma.battleParticipant.update({
      where: { id: pB.id },
      data: { activeSlot: result.state.sideB.activeSlot, missedTurns: pendingB ? 0 : { increment: 1 } },
    }),
    prisma.battleTurnLog.create({
      data: { battleId, turnNumber: battle.currentTurn, events: result.events },
    }),
    prisma.battlePendingMove.deleteMany({ where: { battleId, turnNumber: battle.currentTurn } }),
  ]);

  const [freshA, freshB] = await Promise.all([
    prisma.battleParticipant.findUnique({ where: { id: pA.id } }),
    prisma.battleParticipant.findUnique({ where: { id: pB.id } }),
  ]);

  let finalStatus: "FINISHED" | "ABANDONED" | null = null;
  let winnerId: string | null = result.winner === "A" ? pA.userId : result.winner === "B" ? pB.userId : null;

  if (result.winner) {
    finalStatus = "FINISHED";
  } else if ((freshA?.missedTurns ?? 0) >= MAX_CONSECUTIVE_MISSES) {
    finalStatus = "ABANDONED";
    winnerId = pB.userId;
  } else if ((freshB?.missedTurns ?? 0) >= MAX_CONSECUTIVE_MISSES) {
    finalStatus = "ABANDONED";
    winnerId = pA.userId;
  }

  if (finalStatus) {
    await prisma.battle.update({
      where: { id: battleId },
      data: { status: finalStatus, winnerId, finishedAt: new Date() },
    });
  }

  return prisma.battle.findUnique({ where: { id: battleId }, include: fullBattleInclude });
}
