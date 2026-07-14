import { prisma } from "@/src/lib/prisma";
import { resolveTurn } from "../domain/engine";
import { rowToBattlePokemonState } from "../domain/rowToBattlePokemonState";
import { BattleAction, BattlePokemonState, BattleSideState } from "../domain/types";
import { buildTypeChart } from "./buildTeamSnapshot";
import type { BattleActionType, Prisma } from "@prisma/client";

// Ponte entre o motor puro (domain/engine.ts) e o mundo real (Prisma/HTTP).
// Tudo aqui é regra de produto nossa, sem relação com PokéAPI:
//  - cada jogador tem TURN_TIMEOUT_MS (90s) pra jogar; passou do tempo, o
//    turno resolve mesmo assim tratando quem não jogou como "sem ação"
//  - MAX_MISSES faltas = derrota por abandono (ABANDONED), mesmo com pokémon vivos
export const TURN_TIMEOUT_MS = 90_000;
export const MAX_MISSES = 3;

/**
 * Quantas janelas de TURN_TIMEOUT_MS já venceram desde que o turno começou.
 * 0 = ainda dá tempo de jogar.
 *
 * É `floor`, e não um booleano, DE PROPÓSITO. O turno só resolve quando alguém
 * faz um request (não há worker — CLAUDE.md, regra 5), então "estourou o tempo"
 * e "alguém apareceu pra notar" são coisas diferentes. Se os DOIS fecharam a aba
 * e alguém volta 1h depois, venceram ~40 janelas, não 1: contar só 1 fazia a
 * punição por abandono NÃO ser retroativa — quem voltasse precisaria ficar 3×90s
 * olhando a tela pra ganhar de um oponente que sumiu há uma hora, porque o claim
 * reseta `turnStartedAt` pra agora a cada resolução. Com o floor, o tempo que
 * passou de verdade conta, e a partida zumbi morre no primeiro request.
 */
export function expiredTurnWindows(turnStartedAt: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - turnStartedAt.getTime()) / TURN_TIMEOUT_MS));
}

/**
 * O contador de faltas depois deste turno.
 *
 * Jogou → **-1**, não zero. Zerar a cada jogada fazia o contador ser de faltas
 * SEGUIDAS, e isso é burlável de graça: bastava mandar uma jogada a cada 3
 * turnos pra nunca cair em ABANDONED e arrastar a partida a 90s por turno pra
 * sempre. Decaindo de 1 em 1, quem enrola acumula mais falta do que perdoa e
 * acaba abandonando de verdade; quem só demorou num turno difícil se recupera.
 */
function nextMisses(current: number, submitted: boolean, expiredWindows: number): number {
  if (submitted) return Math.max(0, current - 1);
  return Math.min(MAX_MISSES, current + Math.max(1, expiredWindows));
}

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

/**
 * O que muda num pokémon quando o turno resolve.
 *
 * `moves` entra aqui porque é ONDE O PP MORA (coluna Json, montada por
 * buildTeamSnapshot). O engine gasta o PP no estado em memória; se este write
 * não gravasse `moves` de volta, o PP recarregaria sozinho a cada turno — que
 * era exatamente o bug: o golpe mais forte podia ser usado infinitamente.
 *
 * Não há chamada de rede nenhuma neste caminho: o snapshot dos moves foi
 * congelado no início da partida e desde então a batalha roda só sobre o nosso
 * banco. Gastar PP não fala com a PokéAPI.
 */
function writeMonState(mon: BattlePokemonState): Prisma.BattlePokemonUpdateManyMutationInput {
  return {
    currentHp: mon.currentHp,
    fainted: mon.fainted,
    moves: mon.moves as unknown as Prisma.InputJsonValue,
  };
}

const fullBattleInclude = {
  participants: { include: { pokemons: { orderBy: { slot: "asc" as const } } } },
  turnLogs: { orderBy: { turnNumber: "desc" as const }, take: 10 },
};

/**
 * A partida como resolveIfDue precisa dela. SÓ LÊ.
 *
 * Existe separada de resolveIfDue por causa do custo em serverless: as queries
 * de polling (/status a cada 2s, dos DOIS jogadores) precisam autorizar antes
 * de deixar qualquer escrita acontecer, e a autorização precisa de... a mesma
 * linha que a resolução já ia ler. Juntas num só `tryResolveTurn(battleId)`,
 * autorizar antes custava um SELECT extra por poll, por jogador. Separadas, o
 * caminho de polling lê UMA vez, decide se pode, e só então resolve.
 */
export async function loadBattleForResolve(battleId: string) {
  return prisma.battle.findUnique({
    where: { id: battleId },
    include: { ...fullBattleInclude, pendingMoves: true },
  });
}

export type BattleForResolve = NonNullable<Awaited<ReturnType<typeof loadBattleForResolve>>>;

/**
 * Resolve o turno atual se os dois lados já jogaram, ou se o timeout do
 * turno estourou (nesse caso quem não jogou é tratado como "sem ação").
 * Recebe a partida JÁ LIDA (ver loadBattleForResolve) — não relê.
 *
 * A leitura pode estar velha quando chega aqui (outra lambda resolveu o turno
 * no meio do caminho), e isso é seguro POR CONSTRUÇÃO: o claim otimista lá
 * embaixo é condicionado a `currentTurn: turnNumber`. Quem chegou com uma
 * leitura velha perde o claim e não escreve nada. É a mesma proteção que já
 * existia — ela nunca dependeu da leitura ser fresca, só do claim.
 */
export async function resolveIfDue(battle: BattleForResolve) {
  const battleId = battle.id;
  if (battle.status !== "IN_PROGRESS") return battle;

  // Ordem determinística por userId — "A"/"B" não pode depender da ordem
  // de retorno do Prisma pra essa relação (não garantida sem orderBy), já
  // que o rótulo do lado fica persistido nos eventos do BattleTurnLog e
  // precisa ser reconstruível de forma estável depois, pelo client.
  const [pA, pB] = [...battle.participants].sort((a, b) => a.userId.localeCompare(b.userId));
  const pendingA = battle.pendingMoves.find((m) => m.userId === pA.userId && m.turnNumber === battle.currentTurn);
  const pendingB = battle.pendingMoves.find((m) => m.userId === pB.userId && m.turnNumber === battle.currentTurn);

  const expiredWindows = expiredTurnWindows(battle.turnStartedAt);
  const bothSubmitted = Boolean(pendingA && pendingB);
  if (!bothSubmitted && expiredWindows === 0) return battle;

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
  const missedA = nextMisses(pA.missedTurns, Boolean(pendingA), expiredWindows);
  const missedB = nextMisses(pB.missedTurns, Boolean(pendingB), expiredWindows);

  const abandonedA = missedA >= MAX_MISSES;
  const abandonedB = missedB >= MAX_MISSES;

  let finalStatus: "FINISHED" | "ABANDONED" | null = null;
  let winnerId: string | null = null;
  if (result.winner) {
    finalStatus = "FINISHED";
    winnerId = result.winner === "A" ? pA.userId : pB.userId;
  } else if (abandonedA && abandonedB) {
    // Os DOIS sumiram (o caso da partida zumbi: ninguém pollando, nada
    // resolvendo). Encerra sem vencedor — dar a vitória pro lado B só porque é
    // o segundo do sort seria premiar quem também abandonou.
    finalStatus = "ABANDONED";
    winnerId = null;
  } else if (abandonedA) {
    finalStatus = "ABANDONED";
    winnerId = pB.userId;
  } else if (abandonedB) {
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
            data: writeMonState(mon),
          })
        ),
        ...result.state.sideB.team.map((mon) =>
          tx.battlePokemon.updateMany({
            where: { participantId: pB.id, slot: mon.slot },
            data: writeMonState(mon),
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

/**
 * Lê a partida e resolve o turno se for a hora. É a composição das duas acima,
 * pra quem NÃO tem a partida em mãos.
 *
 * Quem usa: submitMove, que acabou de gravar o pending move e por isso precisa
 * reler de qualquer forma (a leitura anterior dele é velha por definição).
 *
 * Quem NÃO deve usar: as queries de polling. Elas precisam autorizar antes de
 * permitir escrita, e chamar isto aqui as obrigaria a um SELECT só pra isso —
 * elas usam loadBattleForResolve + resolveIfDue e aproveitam a mesma leitura
 * pras duas coisas.
 */
export async function tryResolveTurn(battleId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return null;

  return resolveIfDue(battle);
}
