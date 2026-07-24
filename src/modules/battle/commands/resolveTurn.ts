import { prisma } from "@/src/lib/prisma";
import { applyForcedSwitch, resolveRound, type DuelResult } from "../domain/duelEngine";
import { rowToBattlePokemonState } from "../domain/rowToBattlePokemonState";
import {
  activeOf,
  needsForcedSwitch,
  type DuelAction,
  type DuelSide,
  type DuelState,
} from "../domain/duelTypes";
import { buildTypeChart } from "./buildDuelSnapshot";
import { awardBattleXp, loadXpContext, type XpContext } from "./awardBattleXp";
import type { Prisma } from "@prisma/client";

// Ponte entre o motor PURO do duelo (domain/duelEngine.ts) e o mundo real
// (Prisma/HTTP). Tudo aqui é regra de produto nossa, sem PokéAPI:
//  - os DOIS jogadores têm TURN_TIMEOUT_MS (90s) pra escolher a jogada do round;
//    quando as duas estão na mesa, o turno resolve na hora.
//  - passou o tempo, o turno resolve mesmo assim: quem não escolheu HESITA.
//  - MAX_MISSES hesitações acumuladas por um lado = derrota por abandono.
//
// Com TIME de 6: um round pode ser NORMAL (os dois com ativo vivo escolhem golpe
// ou troca) ou de TROCA FORÇADA (o ativo de alguém desmaiou e há reserva viva —
// só o dono do desmaio age, escolhendo o substituto; timeout auto-promove).
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
 * Simétrico entre os dois lados, ao contrário do modelo alternado. Uma zumbi
 * (ninguém jogando por muitas janelas) leva OS DOIS a MAX_MISSES, encerrando sem
 * vencedor, que é o desfecho justo.
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
// só quem já jogou neste round, NUNCA o `cardSlot`/`type`. É o "oponente já
// escolheu" da tela; o payload da jogada fica no banco até o turno resolver.
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
type ParticipantRow = BattleForResolve["participants"][number];
type ActionRow = BattleForResolve["actions"][number];

// Ordem determinística por userId — quem é sideA/sideB não pode depender da
// ordem de retorno do Prisma (não garantida), já que os eventos do log precisam
// ser reconstruíveis igual nas duas lambdas concorrentes.
function orderedSides(battle: BattleForResolve): [ParticipantRow, ParticipantRow] {
  const [a, b] = [...battle.participants].sort((x, y) => x.userId.localeCompare(y.userId));
  return [a, b];
}

/** Lado do duelo com o TIME inteiro (ordenado por slot) — o motor precisa das reservas. */
function toDuelSide(participant: ParticipantRow): DuelSide {
  return {
    userId: participant.userId,
    activeSlot: participant.activeSlot,
    team: [...participant.pokemons]
      .sort((a, b) => a.slot - b.slot)
      .map(rowToBattlePokemonState),
  };
}

/** Traduz a linha da jogada (BattleAction) pra ação do motor. */
function toDuelAction(userId: string, row: ActionRow | undefined): DuelAction {
  if (!row) return { userId, type: "NONE" };
  if (row.type === "SWITCH") return { userId, type: "SWITCH", targetSlot: row.cardSlot };
  return { userId, type: "MOVE", cardSlot: row.cardSlot };
}

/** O ativo de um lado no formato que loadXpContext espera. */
function toCombatant(side: DuelSide) {
  const mon = activeOf(side);
  return { userPokemonId: mon.userPokemonId ?? null, pokemonId: mon.pokemonId, level: mon.level };
}

/**
 * Grava as mudanças de um lado depois da resolução: o activeSlot (se trocou) e
 * cada pokémon cujo HP/fainted/PP mudou. No 1×1 era sempre o ativo; com time, a
 * troca voluntária muda o activeSlot e quem entrou pode ter tomado dano.
 */
async function persistSide(
  tx: Prisma.TransactionClient,
  participant: ParticipantRow,
  before: DuelSide,
  after: DuelSide
): Promise<void> {
  if (after.activeSlot !== participant.activeSlot) {
    await tx.battleParticipant.update({ where: { id: participant.id }, data: { activeSlot: after.activeSlot } });
  }
  const beforeBySlot = new Map(before.team.map((m) => [m.slot, m]));
  for (const m of after.team) {
    const b = beforeBySlot.get(m.slot);
    if (!b) continue;
    const same =
      b.currentHp === m.currentHp &&
      b.fainted === m.fainted &&
      JSON.stringify(b.moves) === JSON.stringify(m.moves);
    if (same) continue;
    await tx.battlePokemon.updateMany({
      where: { participantId: participant.id, slot: m.slot },
      data: writeMonState(m),
    });
  }
}

interface CommitParams {
  battle: BattleForResolve;
  pA: ParticipantRow;
  pB: ParticipantRow;
  sideA: DuelSide;
  sideB: DuelSide;
  result: DuelResult;
  finalStatus: "FINISHED" | "ABANDONED" | null;
  winnerId: string | null;
  missesA?: number;
  missesB?: number;
  xpContext?: XpContext | null;
}

/**
 * Fecha a resolução numa única transação tudo-ou-nada. O claim otimista guarda
 * por (round, status IN_PROGRESS) e é a 1ª operação: a lambda concorrente que
 * chega com o mesmo estado não casa o where → count 0 → não escreve nada. Fim de
 * jogo e crédito de XP entram na MESMA transação — é o claim que garante XP uma
 * vez só.
 */
async function commit(params: CommitParams) {
  const { battle, pA, pB, sideA, sideB, result, finalStatus, winnerId } = params;
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      const claim = await tx.battle.updateMany({
        where: { id: battle.id, status: "IN_PROGRESS", round: battle.round },
        data: finalStatus
          ? { status: finalStatus, winnerId, finishedAt: now, turnStartedAt: now, round: result.state.round }
          : { round: result.state.round, turnStartedAt: now },
      });
      if (claim.count === 0) return; // perdeu a corrida

      await persistSide(tx, pA, sideA, result.state.sideA);
      await persistSide(tx, pB, sideB, result.state.sideB);

      if (params.missesA !== undefined && params.missesA !== pA.missedTurns) {
        await tx.battleParticipant.update({ where: { id: pA.id }, data: { missedTurns: params.missesA } });
      }
      if (params.missesB !== undefined && params.missesB !== pB.missedTurns) {
        await tx.battleParticipant.update({ where: { id: pB.id }, data: { missedTurns: params.missesB } });
      }

      await tx.battleTurnLog.create({
        data: { battleId: battle.id, turnNumber: battle.round, events: result.events as Prisma.InputJsonValue },
      });
      await tx.battleAction.deleteMany({ where: { battleId: battle.id, round: battle.round } });

      if (params.xpContext) await awardBattleXp(tx, params.xpContext);
    },
    { timeout: 15_000, maxWait: 5_000 }
  );

  return prisma.battle.findUnique({ where: { id: battle.id }, include: fullBattleInclude });
}

/**
 * Resolve o round, se houver o que resolver. Recebe a partida JÁ LIDA. A leitura
 * pode estar velha (outra lambda resolveu no meio), e isso é seguro POR
 * CONSTRUÇÃO: o claim otimista condicionado a (round, status).
 */
export async function resolveIfDue(battle: BattleForResolve) {
  if (battle.status !== "IN_PROGRESS") return battle;
  if (battle.participants.length < 2) return battle;

  const [pA, pB] = orderedSides(battle);
  const sideA = toDuelSide(pA);
  const sideB = toDuelSide(pB);
  const state: DuelState = { round: battle.round, sideA, sideB };

  const rowOf = (userId: string) => battle.actions.find((x) => x.round === battle.round && x.userId === userId);
  const rowA = rowOf(pA.userId);
  const rowB = rowOf(pB.userId);
  const expiredWindows = expiredTurnWindows(battle.turnStartedAt);

  // TROCA FORÇADA tem prioridade sobre o round normal: se o ativo de alguém
  // desmaiou (com reserva viva), o jogo espera a escolha do substituto antes de
  // seguir. Só o dono do desmaio age; o outro apenas aguarda.
  if (needsForcedSwitch(sideA) || needsForcedSwitch(sideB)) {
    return resolveForcedSwitchRound({ battle, pA, pB, sideA, sideB, state, rowA, rowB, expiredWindows });
  }

  return resolveNormalRound({ battle, pA, pB, sideA, sideB, state, rowA, rowB, expiredWindows });
}

interface RoundParams {
  battle: BattleForResolve;
  pA: ParticipantRow;
  pB: ParticipantRow;
  sideA: DuelSide;
  sideB: DuelSide;
  state: DuelState;
  rowA: ActionRow | undefined;
  rowB: ActionRow | undefined;
  expiredWindows: number;
}

async function resolveNormalRound(p: RoundParams) {
  const { battle, pA, pB, sideA, sideB, state, rowA, rowB, expiredWindows } = p;
  const playedA = Boolean(rowA);
  const playedB = Boolean(rowB);

  // O coração do simultâneo: só resolve com as DUAS jogadas na mesa. Enquanto
  // falta uma e ainda há tempo, o round fica aberto — é essa espera que faz a
  // escolha ser às cegas.
  if (!(playedA && playedB) && expiredWindows === 0) return battle;

  // Trecho LENTO (buildTypeChart pode bater na PokéAPI num cache miss) ANTES de
  // qualquer escrita: se a função morrer aqui, a partida fica intacta. Basta o
  // tipo do golpe do atacante estar na matriz — ele cobre qualquer tipo de alvo,
  // inclusive um pokémon que acabou de entrar por troca.
  const typeChart = await buildTypeChart([activeOf(sideA), activeOf(sideB)]);

  const result = resolveRound({
    state,
    actionA: toDuelAction(pA.userId, rowA),
    actionB: toDuelAction(pB.userId, rowB),
    typeChart,
    rng: Math.random,
  });

  const missesA = nextMisses(pA.missedTurns, playedA, expiredWindows);
  const missesB = nextMisses(pB.missedTurns, playedB, expiredWindows);
  const abandonedA = missesA >= MAX_MISSES;
  const abandonedB = missesB >= MAX_MISSES;

  let finalStatus: "FINISHED" | "ABANDONED" | null = null;
  let winnerId: string | null = null;
  if (result.finished) {
    // O motor encerrou: um lado zerou o time (winnerId) ou os dois zeraram (empate).
    finalStatus = "FINISHED";
    winnerId = result.winnerId;
  } else if (abandonedA && abandonedB) {
    finalStatus = "ABANDONED";
  } else if (abandonedA) {
    finalStatus = "ABANDONED";
    winnerId = pB.userId;
  } else if (abandonedB) {
    finalStatus = "ABANDONED";
    winnerId = pA.userId;
  }

  // XP só quando há vencedor POR NOCAUTE (não no abandono). O contexto é LIDO
  // AQUI, fora da transação: I/O que não precisa da trava.
  let xpContext: XpContext | null = null;
  if (finalStatus === "FINISHED" && winnerId) {
    const winnerSide = winnerId === pA.userId ? result.state.sideA : result.state.sideB;
    const loserSide = winnerId === pA.userId ? result.state.sideB : result.state.sideA;
    xpContext = await loadXpContext(toCombatant(winnerSide), toCombatant(loserSide));
  }

  return commit({ battle, pA, pB, sideA, sideB, result, finalStatus, winnerId, missesA, missesB, xpContext });
}

async function resolveForcedSwitchRound(p: RoundParams) {
  const { battle, pA, pB, sideA, sideB, state, rowA, rowB, expiredWindows } = p;

  // Só os lados que precisam trocar são esperados. A troca forçada resolve
  // quando TODOS eles escolheram, ou quando o tempo estourou (auto-promove o 1º
  // vivo). O lado que não precisa trocar não entra nessa conta.
  const requiredUsers = [
    needsForcedSwitch(sideA) ? pA.userId : null,
    needsForcedSwitch(sideB) ? pB.userId : null,
  ].filter((u): u is string => u !== null);

  const chose = (userId: string) =>
    battle.actions.some((a) => a.round === battle.round && a.userId === userId && a.type === "SWITCH");
  const allChosen = requiredUsers.every(chose);
  if (!allChosen && expiredWindows === 0) return battle;

  const choiceOf = (row: ActionRow | undefined) => (row && row.type === "SWITCH" ? row.cardSlot : null);

  const result = applyForcedSwitch({ state, choiceA: choiceOf(rowA), choiceB: choiceOf(rowB) });

  // A troca forçada não gera vencedor (só entra quando há reserva viva) e não
  // conta falta — o auto-promover já mantém o jogo andando sem abandono.
  return commit({
    battle,
    pA,
    pB,
    sideA,
    sideB,
    result,
    finalStatus: result.finished ? "FINISHED" : null,
    winnerId: result.winnerId,
  });
}

/**
 * Lê a partida e resolve se for a hora. Composição, pra quem NÃO tem a partida
 * em mãos (submitAction, o reaper de zumbi do enqueueBattle).
 */
export async function tryResolveTurn(battleId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return null;
  return resolveIfDue(battle);
}
