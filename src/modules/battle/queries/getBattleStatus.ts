import { loadBattleForResolve, resolveIfDue } from "../commands/resolveTurn";
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
