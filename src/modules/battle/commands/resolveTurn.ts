import { prisma } from "@/src/lib/prisma";
import { applyDuelAction } from "../domain/duelEngine";
import { computeInitiative } from "../domain/duelInitiative";
import { rowToBattlePokemonState } from "../domain/rowToBattlePokemonState";
import type { DuelAction, DuelSide, DuelState } from "../domain/duelTypes";
import { buildTypeChart } from "./buildDuelSnapshot";
import type { Prisma } from "@prisma/client";

// Ponte entre o motor PURO do duelo (domain/duelEngine.ts) e o mundo real
// (Prisma/HTTP). Tudo aqui é regra de produto nossa, sem PokéAPI:
//  - o jogador da vez (activeUserId) tem TURN_TIMEOUT_MS (90s) pra jogar sua
//    carta; passou do tempo, o turno resolve como HESITAÇÃO (§4.4) e a vez passa.
//  - MAX_MISSES hesitações acumuladas por um lado = derrota por abandono.
export const TURN_TIMEOUT_MS = 90_000;
export const MAX_MISSES = 3;

/**
 * Quantas janelas de TURN_TIMEOUT_MS já venceram desde que o turno começou.
 * 0 = ainda dá tempo de jogar.
 *
 * É `floor`, e não booleano, DE PROPÓSITO. O turno só resolve quando alguém faz
 * request (não há worker — CLAUDE.md regra 5), então "estourou o tempo" e
 * "alguém apareceu pra notar" são coisas diferentes. Se os dois fecharam a aba e
 * alguém volta 1h depois, venceram ~40 janelas, não 1: contar só 1 fazia a
 * punição por abandono NÃO ser retroativa (o claim reseta turnStartedAt).
 */
export function expiredTurnWindows(turnStartedAt: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - turnStartedAt.getTime()) / TURN_TIMEOUT_MS));
}

/** Faltas do jogador da VEZ depois deste turno: jogou → −1, hesitou → +janelas. */
function nextActiveMisses(current: number, played: boolean, expiredWindows: number): number {
  if (played) return Math.max(0, current - 1);
  return Math.min(MAX_MISSES, current + Math.max(1, expiredWindows));
}

/**
 * Faltas do OPONENTE (que não age neste turno). Normalmente não muda — só o
 * ativo pode hesitar. Mas numa lacuna LONGA (partida zumbi: os dois sumiram),
 * as janelas venceram pra ele também; propagar (expiredWindows − 1) faz uma
 * zumbi de fresh state encerrar SEM vencedor em vez de premiar um ausente,
 * enquanto o timeout de UMA janela (oponente presente que acabou de jogar) não
 * o pune. Só conta quando o ativo hesitou (played = false).
 */
function nextOpponentMisses(current: number, activePlayed: boolean, expiredWindows: number): number {
  if (activePlayed) return current;
  return Math.min(MAX_MISSES, current + Math.max(0, expiredWindows - 1));
}

/** O que muda num pokémon quando o turno resolve (HP, faint e o PP na coluna moves). */
function writeMonState(mon: {
  currentHp: number;
  fainted: boolean;
  moves: unknown;
}): Prisma.BattlePokemonUpdateManyMutationInput {
  return {
    currentHp: mon.currentHp,
    fainted: mon.fainted,
    moves: mon.moves as Prisma.InputJsonValue,
  };
}

const fullBattleInclude = {
  participants: { include: { pokemons: { orderBy: { slot: "asc" as const } } } },
  turnLogs: { orderBy: { turnNumber: "desc" as const }, take: 10 },
};

/**
 * A partida como resolveIfDue precisa dela. SÓ LÊ. Separada de resolveIfDue pelo
 * custo em serverless: o polling de /status (dos DOIS jogadores, a cada 2s)
 * autoriza e resolve na MESMA leitura. Ver getBattleStatus.
 */
export async function loadBattleForResolve(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    include: { ...fullBattleInclude, actions: true },
  });
}

export type BattleForResolve = NonNullable<Awaited<ReturnType<typeof loadBattleForResolve>>>;

// Ordem determinística por userId — quem é sideA/sideB não pode depender da
// ordem de retorno do Prisma (não garantida), já que a iniciativa e os eventos
// do log precisam ser reconstruíveis igual nas duas lambdas concorrentes.
function orderedSides(battle: BattleForResolve): [BattleForResolve["participants"][number], BattleForResolve["participants"][number]] {
  const [a, b] = [...battle.participants].sort((x, y) => x.userId.localeCompare(y.userId));
  return [a, b];
}

function activePokemonRow(participant: BattleForResolve["participants"][number]) {
  return participant.pokemons.find((p) => p.slot === participant.activeSlot) ?? participant.pokemons[0];
}

function toDuelSide(participant: BattleForResolve["participants"][number]): DuelSide {
  return { userId: participant.userId, active: rowToBattlePokemonState(activePokemonRow(participant)) };
}

/**
 * Resolve UMA ação do jogador da vez, se houver o que resolver:
 *  - se ele já mandou a carta (BattleAction do round) → aplica a carta;
 *  - senão, se o timeout estourou → HESITAÇÃO (passa a vez em branco);
 *  - senão → nada a fazer (ainda é a vez dele e dá tempo).
 *
 * Recebe a partida JÁ LIDA. A leitura pode estar velha (outra lambda resolveu no
 * meio), e isso é seguro POR CONSTRUÇÃO: o claim otimista é condicionado a
 * (activeUserId, round, status) — quem chega com leitura velha perde o claim e
 * não escreve nada.
 */
export async function resolveIfDue(battle: BattleForResolve) {
  const battleId = battle.id;
  if (battle.status !== "IN_PROGRESS") return battle;
  if (battle.participants.length < 2 || !battle.activeUserId) return battle;

  const [pA, pB] = orderedSides(battle);
  const sideA = toDuelSide(pA);
  const sideB = toDuelSide(pB);
  const order = computeInitiative(sideA, sideB);

  const activeUserId = battle.activeUserId;
  if (activeUserId !== order[0] && activeUserId !== order[1]) return battle;
  const actedThisRound = activeUserId === order[0] ? 0 : 1;

  const pending = battle.actions.find((x) => x.round === battle.round && x.userId === activeUserId);
  const expiredWindows = expiredTurnWindows(battle.turnStartedAt);
  const played = Boolean(pending);
  if (!played && expiredWindows === 0) return battle; // ainda é a vez dele e dá tempo

  const state: DuelState = {
    round: battle.round,
    order,
    activeUserId,
    actedThisRound,
    sideA,
    sideB,
  };

  const action: DuelAction = played
    ? { userId: activeUserId, type: "CARD", cardSlot: pending!.cardSlot }
    : { userId: activeUserId, type: "NONE" };

  // Trecho LENTO (buildTypeChart pode bater na PokéAPI num cache miss) ANTES de
  // qualquer escrita: se a função morrer aqui, a partida fica intacta.
  const typeChart = await buildTypeChart([sideA.active, sideB.active]);

  const result = applyDuelAction({ state, action, typeChart, rng: Math.random });

  // Contador monotônico e único por AÇÃO (BattleTurnLog @@unique[battleId,
  // turnNumber]): a rodada tem 2 ações, então chavear por round colidiria. É
  // reconstruível (round + qual ação da rodada), como o resto.
  const turnNumber = (battle.round - 1) * 2 + actedThisRound;

  // Faltas: só o ativo é avaliado (só ele podia agir). O oponente só sobe numa
  // lacuna longa (zumbi) — ver nextOpponentMisses.
  const activeIsA = activeUserId === pA.userId;
  const activePart = activeIsA ? pA : pB;
  const oppPart = activeIsA ? pB : pA;
  const activeMisses = nextActiveMisses(activePart.missedTurns, played, expiredWindows);
  const oppMisses = nextOpponentMisses(oppPart.missedTurns, played, expiredWindows);

  const abandonedActive = activeMisses >= MAX_MISSES;
  const abandonedOpp = oppMisses >= MAX_MISSES;

  let finalStatus: "FINISHED" | "ABANDONED" | null = null;
  let winnerId: string | null = null;
  if (result.winnerId) {
    finalStatus = "FINISHED";
    winnerId = result.winnerId;
  } else if (abandonedActive && abandonedOpp) {
    finalStatus = "ABANDONED"; // os dois sumiram — sem vencedor
    winnerId = null;
  } else if (abandonedActive) {
    finalStatus = "ABANDONED";
    winnerId = oppPart.userId;
  } else if (abandonedOpp) {
    finalStatus = "ABANDONED";
    winnerId = activePart.userId;
  }

  // Turno resolve INTEIRO ou nada. O claim é a 1ª operação e guarda por
  // (activeUserId, round, status IN_PROGRESS): numa ação que NÃO encerra ele
  // avança activeUserId/round; numa que encerra ele flipa o status. Nos dois
  // casos, a lambda concorrente que chega com o mesmo estado não casa mais o
  // where → count 0 → não escreve nada. Fim de jogo entra na MESMA transação.
  const now = new Date();
  const monA = result.state.sideA.active;
  const monB = result.state.sideB.active;

  await prisma.$transaction(
    async (tx) => {
      const claim = await tx.battle.updateMany({
        where: { id: battleId, status: "IN_PROGRESS", activeUserId, round: battle.round },
        data: finalStatus
          ? {
              status: finalStatus,
              winnerId,
              finishedAt: now,
              turnStartedAt: now,
              activeUserId: result.state.activeUserId,
              round: result.state.round,
            }
          : {
              activeUserId: result.state.activeUserId,
              round: result.state.round,
              turnStartedAt: now,
            },
      });
      if (claim.count === 0) return; // perdeu a corrida

      await Promise.all([
        tx.battlePokemon.updateMany({
          where: { participantId: pA.id, slot: pA.activeSlot },
          data: writeMonState(monA),
        }),
        tx.battlePokemon.updateMany({
          where: { participantId: pB.id, slot: pB.activeSlot },
          data: writeMonState(monB),
        }),
      ]);

      await tx.battleParticipant.update({ where: { id: activePart.id }, data: { missedTurns: activeMisses } });
      if (oppMisses !== oppPart.missedTurns) {
        await tx.battleParticipant.update({ where: { id: oppPart.id }, data: { missedTurns: oppMisses } });
      }

      await tx.battleTurnLog.create({ data: { battleId, turnNumber, events: result.events as Prisma.InputJsonValue } });
      // Consome a carta do ativo (a hesitação por timeout não tem linha a apagar).
      await tx.battleAction.deleteMany({ where: { battleId, round: battle.round, userId: activeUserId } });
    },
    { timeout: 15_000, maxWait: 5_000 }
  );

  return prisma.battle.findUnique({ where: { id: battleId }, include: fullBattleInclude });
}

/**
 * Lê a partida e resolve se for a hora. Composição das duas acima, pra quem NÃO
 * tem a partida em mãos (submitAction, o reaper de zumbi do enqueueBattle).
 */
export async function tryResolveTurn(battleId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return null;
  return resolveIfDue(battle);
}
