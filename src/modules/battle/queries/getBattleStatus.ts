import { prisma } from "@/src/lib/prisma";
import { loadBattleForResolve, resolveIfDue } from "../commands/resolveTurn";
import { PRESENCE_HEARTBEAT_MS } from "../domain/presence";
import { isParticipant } from "./battleAccess";

// GET /api/battle/[id]/status — polling leve; também é quem "empurra" a
// resolução do turno quando o timeout estoura (não há worker/cron).
//
// Este é O caminho quente: os DOIS jogadores batem aqui a cada 2s enquanto a
// partida corre. Por isso a leitura é UMA só — serve pra autorizar E pra
// resolver o turno. Ver isParticipant.
export async function getBattleStatus(battleId: string, userId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return { error: "not_found" as const };
  if (!isParticipant(battle, userId)) return { error: "forbidden" as const };

  // HEARTBEAT — depois de AUTORIZAR e antes de RESOLVER.
  //
  // A ordem não é detalhe: escrever antes de checar se o usuário é participante
  // foi um achado de auditoria real neste arquivo (mexia em partida alheia). E
  // vem antes do `resolveIfDue` porque é ele quem lê a ausência: carimbar depois
  // faria o jogador ser dado como ausente no mesmo request em que provou estar
  // presente.
  //
  // O próprio `where` é o throttle: só escreve se o último sinal já passou de
  // metade do intervalo. `count 0` significa "sinal fresco" — e quem perde essa
  // corrida não perde nada, porque o dado que ele ia gravar já está lá.
  const agora = Date.now();
  await prisma.battleParticipant.updateMany({
    where: {
      battleId,
      userId,
      OR: [
        { lastSeenAt: null },
        { lastSeenAt: { lt: new Date(agora - PRESENCE_HEARTBEAT_MS / 2) } },
      ],
    },
    data: { lastSeenAt: new Date(agora) },
  });
  // A partida já lida tem o `lastSeenAt` velho; atualizar em memória evita que
  // a resolução logo abaixo julgue ausente quem acabou de carimbar.
  const eu = battle.participants.find((p) => p.userId === userId);
  if (eu) eu.lastSeenAt = new Date(agora);

  const resolved = await resolveIfDue(battle);
  if (!resolved) return { error: "not_found" as const };

  // Quem ainda falta escolher a carta do round, do ponto de vista de quem
  // perguntou. No simultâneo os dois estão sempre em turno — o que a tela
  // precisa saber é se ela ainda deve mostrar a mão ("you") ou o "aguardando
  // oponente" ("opponent").
  const submitted = new Set(
    resolved.actions.filter((a) => a.round === resolved.round).map((a) => a.userId)
  );
  let waitingOn: "you" | "opponent" | null = null;
  if (resolved.status === "IN_PROGRESS") {
    if (!submitted.has(userId)) waitingOn = "you";
    else if (submitted.size < 2) waitingOn = "opponent";
  }

  return {
    status: resolved.status,
    round: resolved.round,
    winnerId: resolved.winnerId,
    // O tick do cliente compara isto pra saber se precisa refazer o GET pesado.
    iSubmitted: submitted.has(userId),
    opponentSubmitted: [...submitted].some((id) => id !== userId),
    waitingOn,
  };
}
