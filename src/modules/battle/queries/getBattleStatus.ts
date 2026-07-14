import { prisma } from "@/src/lib/prisma";
import { loadBattleForResolve, resolveIfDue } from "../commands/resolveTurn";
import { isParticipant } from "./battleAccess";

// GET /api/battle/[id]/status — polling leve; também é quem "empurra" a
// resolução do turno quando o timeout estoura (não há worker/cron).
//
// Este é O caminho quente da aplicação: os DOIS jogadores batem aqui a cada 2s
// enquanto a partida corre. Por isso a leitura é UMA só — ela serve pra
// autorizar E pra resolver o turno. Autorizar antes de escrever é obrigatório
// (resolveIfDue escreve e pode chamar a PokéAPI), mas não pode custar um SELECT
// extra por poll. Ver isParticipant.
export async function getBattleStatus(battleId: string, userId: string) {
  const battle = await loadBattleForResolve(battleId);
  if (!battle) return { error: "not_found" as const };
  if (!isParticipant(battle, userId)) return { error: "forbidden" as const };

  // resolveIfDue relê a partida depois da transação, e esse re-read é anulável:
  // a partida pode ter sumido no meio (cascade de um usuário deletado, p.ex.).
  const resolved = await resolveIfDue(battle);
  if (!resolved) return { error: "not_found" as const };

  const opponent = resolved.participants.find((p) => p.userId !== userId);

  let waitingOn: "you" | "opponent" | "both" | null = null;
  if (resolved.status === "IN_PROGRESS" && opponent) {
    const pendingMoves = await prisma.battlePendingMove.findMany({
      where: { battleId, turnNumber: resolved.currentTurn },
      select: { userId: true },
    });
    const submitted = new Set(pendingMoves.map((m) => m.userId));
    const meSubmitted = submitted.has(userId);
    const oppSubmitted = submitted.has(opponent.userId);
    waitingOn = !meSubmitted && !oppSubmitted ? "both" : !meSubmitted ? "you" : !oppSubmitted ? "opponent" : null;
  }

  return {
    status: resolved.status,
    turnNumber: resolved.currentTurn,
    winnerId: resolved.winnerId,
    waitingOn,
  };
}
