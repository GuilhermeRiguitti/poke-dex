import { prisma } from "@/src/lib/prisma";
import { resolveTurn } from "../domain/engine";
import { rowToBattlePokemonState } from "../domain/rowToBattlePokemonState";
import { BattleAction, BattleSideState } from "../domain/types";
import { buildTypeChart } from "./buildTeamSnapshot";
import type { BattleActionType } from "@prisma/client";

// Ponte entre o motor puro (domain/engine.ts) e o mundo real (Prisma/HTTP).
// Tudo aqui é regra de produto nossa, sem relação com PokéAPI:
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
 * Chamada tanto por submitMove (depois de registrar a jogada) quanto pelas
 * queries de leitura (polling) — a resolução não depende de nenhum
 * worker/cron, só de alguém consultar a partida depois que os dois lados
 * agiram.
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

  const turnNumber = battle.currentTurn;

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

  // O trecho LENTO fica aqui, antes de qualquer escrita: buildTypeChart pode
  // bater na PokéAPI num cache miss, e o motor é puro. Se a função morrer
  // (timeout da Vercel, cold start ruim) em qualquer ponto daqui pra cima, a
  // partida continua intacta — nada foi escrito.
  const typeChart = await buildTypeChart([...sideAState.team, ...sideBState.team]);

  const result = resolveTurn({
    state: { turnNumber, sideA: sideAState, sideB: sideBState },
    actionA: toBattleAction(pendingA),
    actionB: toBattleAction(pendingB),
    typeChart,
    rng: Math.random,
  });

  // missedTurns só é escrito aqui dentro, e o claim abaixo garante que um
  // único request resolve o turno — então o valor final é calculável em
  // memória, sem precisar reler os participantes depois de gravar.
  const missedA = pendingA ? 0 : pA.missedTurns + 1;
  const missedB = pendingB ? 0 : pB.missedTurns + 1;

  let finalStatus: "FINISHED" | "ABANDONED" | null = null;
  let winnerId: string | null = null;
  if (result.winner) {
    finalStatus = "FINISHED";
    winnerId = result.winner === "A" ? pA.userId : pB.userId;
  } else if (missedA >= MAX_CONSECUTIVE_MISSES) {
    finalStatus = "ABANDONED";
    winnerId = pB.userId;
  } else if (missedB >= MAX_CONSECUTIVE_MISSES) {
    finalStatus = "ABANDONED";
    winnerId = pA.userId;
  }

  // Turno resolve INTEIRO ou não resolve nada.
  //
  // O claim (avançar currentTurn) era uma escrita solta, fora da transação,
  // com o buildTypeChart no meio do caminho. Em serverless isso perde partida:
  // se a função morresse entre o claim e as escritas, o turno avançava sem
  // log, sem aplicar dano e sem limpar as jogadas pendentes — turno sumido,
  // silenciosamente, e sem worker/cron pra reparar depois (o plano Hobby da
  // Vercel não tem cron de minuto). Agora o claim é a primeira operação DENTRO
  // da transação: quem perder a corrida não escreve nada e só lê o resultado.
  await prisma.$transaction(
    async (tx) => {
      // Trava otimista: só um request consegue avançar este turno.
      const claim = await tx.battle.updateMany({
        where: { id: battleId, currentTurn: turnNumber },
        data: { currentTurn: { increment: 1 }, turnStartedAt: new Date() },
      });
      if (claim.count === 0) return; // outro request já resolveu este turno

      await Promise.all([
        ...result.state.sideA.team.map((mon) =>
          tx.battlePokemon.updateMany({
            where: { participantId: pA.id, slot: mon.slot },
            data: { currentHp: mon.currentHp, fainted: mon.fainted },
          })
        ),
        ...result.state.sideB.team.map((mon) =>
          tx.battlePokemon.updateMany({
            where: { participantId: pB.id, slot: mon.slot },
            data: { currentHp: mon.currentHp, fainted: mon.fainted },
          })
        ),
      ]);

      await tx.battleParticipant.update({
        where: { id: pA.id },
        data: { activeSlot: result.state.sideA.activeSlot, missedTurns: missedA },
      });
      await tx.battleParticipant.update({
        where: { id: pB.id },
        data: { activeSlot: result.state.sideB.activeSlot, missedTurns: missedB },
      });

      await tx.battleTurnLog.create({
        data: { battleId, turnNumber, events: result.events },
      });
      await tx.battlePendingMove.deleteMany({ where: { battleId, turnNumber } });

      // O fim da partida entra na MESMA transação: não existe estado onde o
      // dano do golpe final foi aplicado mas a partida ficou IN_PROGRESS.
      if (finalStatus) {
        await tx.battle.update({
          where: { id: battleId },
          data: { status: finalStatus, winnerId, finishedAt: new Date() },
        });
      }
    },
    // Folga pro cold start / latência do pooler: o default do Prisma (5s) é
    // apertado pra lambda fria, e estourar aqui aborta o turno inteiro.
    { timeout: 15_000, maxWait: 5_000 }
  );

  return prisma.battle.findUnique({ where: { id: battleId }, include: fullBattleInclude });
}
