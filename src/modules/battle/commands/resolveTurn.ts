import { prisma } from "@/src/lib/prisma";
import { resolveRound } from "../domain/duelEngine";
import { rowToBattlePokemonState } from "../domain/rowToBattlePokemonState";
import type { DuelAction, DuelSide, DuelState } from "../domain/duelTypes";
import { buildTypeChart } from "./buildDuelSnapshot";
import { awardBattleXp, loadXpContext, type XpContext } from "./awardBattleXp";
import type { Prisma } from "@prisma/client";

// Ponte entre o motor PURO do duelo (domain/duelEngine.ts) e o mundo real
// (Prisma/HTTP). Tudo aqui é regra de produto nossa, sem PokéAPI:
//  - os DOIS jogadores têm TURN_TIMEOUT_MS (90s) pra escolher a carta do round;
//    quando as duas cartas estão na mesa, o turno resolve na hora.
//  - passou o tempo, o turno resolve mesmo assim: quem não escolheu HESITA.
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
 * punição por abandono NÃO ser retroativa (o turno resolvido reseta turnStartedAt).
 */
export function expiredTurnWindows(turnStartedAt: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - turnStartedAt.getTime()) / TURN_TIMEOUT_MS));
}

/**
 * Faltas de um lado depois deste turno: escolheu → −1, hesitou → +janelas.
 *
 * Simétrico entre os dois lados, ao contrário do modelo alternado (lá só o
 * jogador da vez podia hesitar, e o oponente precisava de uma regra à parte pra
 * partida zumbi). No simultâneo os dois estão sempre em turno, então a mesma
 * conta serve pros dois — e uma zumbi (ninguém jogando por muitas janelas) leva
 * OS DOIS a MAX_MISSES, encerrando sem vencedor, que é o desfecho justo.
 */
export function nextMisses(current: number, played: boolean, expiredWindows: number): number {
  if (played) return Math.max(0, current - 1);
  return Math.min(MAX_MISSES, current + Math.max(1, expiredWindows));
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

// A partida como a UI precisa dela. `actions` entra com um SELECT ESTREITO —
// só quem já jogou neste round, NUNCA o `cardSlot`. É o "oponente já escolheu"
// da tela; o cardSlot fica no banco até o turno resolver. Whitelist aqui, na
// leitura, além da whitelist do DTO: duas cercas, e a de fora é a mais barata.
const fullBattleInclude = {
  participants: { include: { pokemons: { orderBy: { slot: "asc" as const } } } },
  turnLogs: { orderBy: { turnNumber: "desc" as const }, take: 10 },
  actions: { select: { userId: true, round: true } },
};

/**
 * A partida como resolveIfDue precisa dela. SÓ LÊ. Separada de resolveIfDue pelo
 * custo em serverless: o polling de /status (dos DOIS jogadores) autoriza e
 * resolve na MESMA leitura. Ver getBattleStatus.
 */
export async function loadBattleForResolve(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    include: { ...fullBattleInclude, actions: true },
  });
}

export type BattleForResolve = NonNullable<Awaited<ReturnType<typeof loadBattleForResolve>>>;

// Ordem determinística por userId — quem é sideA/sideB não pode depender da
// ordem de retorno do Prisma (não garantida), já que os eventos do log precisam
// ser reconstruíveis igual nas duas lambdas concorrentes.
function orderedSides(
  battle: BattleForResolve
): [BattleForResolve["participants"][number], BattleForResolve["participants"][number]] {
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
 * Resolve o round, se houver o que resolver:
 *  - os DOIS já escolheram a carta → resolve na hora (o caso normal);
 *  - o timeout estourou → resolve mesmo assim, e quem não escolheu HESITA;
 *  - senão → nada a fazer (ainda dá tempo de escolher).
 *
 * Recebe a partida JÁ LIDA. A leitura pode estar velha (outra lambda resolveu no
 * meio), e isso é seguro POR CONSTRUÇÃO: o claim otimista é condicionado a
 * (round, status) — quem chega com leitura velha perde o claim e não escreve nada.
 */
export async function resolveIfDue(battle: BattleForResolve) {
  const battleId = battle.id;
  if (battle.status !== "IN_PROGRESS") return battle;
  if (battle.participants.length < 2) return battle;

  const [pA, pB] = orderedSides(battle);
  const sideA = toDuelSide(pA);
  const sideB = toDuelSide(pB);

  const actionOf = (userId: string) =>
    battle.actions.find((x) => x.round === battle.round && x.userId === userId);
  const rowA = actionOf(pA.userId);
  const rowB = actionOf(pB.userId);

  const expiredWindows = expiredTurnWindows(battle.turnStartedAt);
  const playedA = Boolean(rowA);
  const playedB = Boolean(rowB);

  // O coração do simultâneo: só resolve com as DUAS cartas na mesa. Enquanto
  // falta uma e ainda há tempo, o round fica aberto — é essa espera que faz a
  // escolha ser às cegas.
  if (!(playedA && playedB) && expiredWindows === 0) return battle;

  const state: DuelState = { round: battle.round, sideA, sideB };

  const toAction = (
    userId: string,
    row: { cardSlot: number } | undefined
  ): DuelAction => (row ? { userId, type: "CARD", cardSlot: row.cardSlot } : { userId, type: "NONE" });

  // Trecho LENTO (buildTypeChart pode bater na PokéAPI num cache miss) ANTES de
  // qualquer escrita: se a função morrer aqui, a partida fica intacta.
  const typeChart = await buildTypeChart([sideA.active, sideB.active]);

  const result = resolveRound({
    state,
    actionA: toAction(pA.userId, rowA),
    actionB: toAction(pB.userId, rowB),
    typeChart,
    rng: Math.random,
  });

  // Um log por RODADA (no simultâneo a rodada é a unidade), o que casa com o
  // @@unique([battleId, turnNumber]).
  const turnNumber = battle.round;

  const missesA = nextMisses(pA.missedTurns, playedA, expiredWindows);
  const missesB = nextMisses(pB.missedTurns, playedB, expiredWindows);
  const abandonedA = missesA >= MAX_MISSES;
  const abandonedB = missesB >= MAX_MISSES;

  let finalStatus: "FINISHED" | "ABANDONED" | null = null;
  let winnerId: string | null = null;
  if (result.winnerId) {
    finalStatus = "FINISHED";
    winnerId = result.winnerId;
  } else if (abandonedA && abandonedB) {
    finalStatus = "ABANDONED"; // os dois sumiram — sem vencedor
    winnerId = null;
  } else if (abandonedA) {
    finalStatus = "ABANDONED";
    winnerId = pB.userId;
  } else if (abandonedB) {
    finalStatus = "ABANDONED";
    winnerId = pA.userId;
  }

  // XP só existe quando há vencedor. O contexto (baseExperience das espécies)
  // é LIDO AQUI, fora da transação: é I/O que não precisa da trava, e transação
  // aberta esperando leitura é conexão do pool presa (CLAUDE.md consequência #2).
  let xpContext: XpContext | null = null;
  if (winnerId) {
    const winnerPart = winnerId === pA.userId ? pA : pB;
    const loserPart = winnerId === pA.userId ? pB : pA;
    xpContext = await loadXpContext(activePokemonRow(winnerPart), activePokemonRow(loserPart));
  }

  // Turno resolve INTEIRO ou nada. O claim é a 1ª operação e guarda por
  // (round, status IN_PROGRESS): num round que NÃO encerra ele avança o round;
  // num que encerra ele flipa o status. Nos dois casos, a lambda concorrente que
  // chega com o mesmo estado não casa mais o where → count 0 → não escreve nada.
  // Fim de jogo e crédito de XP entram na MESMA transação — é o claim que
  // garante que o XP é pago UMA vez só.
  const now = new Date();
  const monA = result.state.sideA.active;
  const monB = result.state.sideB.active;

  await prisma.$transaction(
    async (tx) => {
      const claim = await tx.battle.updateMany({
        where: { id: battleId, status: "IN_PROGRESS", round: battle.round },
        data: finalStatus
          ? {
              status: finalStatus,
              winnerId,
              finishedAt: now,
              turnStartedAt: now,
              round: result.state.round,
            }
          : {
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

      if (missesA !== pA.missedTurns) {
        await tx.battleParticipant.update({ where: { id: pA.id }, data: { missedTurns: missesA } });
      }
      if (missesB !== pB.missedTurns) {
        await tx.battleParticipant.update({ where: { id: pB.id }, data: { missedTurns: missesB } });
      }

      await tx.battleTurnLog.create({
        data: { battleId, turnNumber, events: result.events as Prisma.InputJsonValue },
      });
      // Consome as cartas do round (a hesitação não tem linha a apagar).
      await tx.battleAction.deleteMany({ where: { battleId, round: battle.round } });

      if (xpContext) await awardBattleXp(tx, xpContext);
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
