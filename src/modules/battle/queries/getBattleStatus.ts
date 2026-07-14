import { prisma } from "@/src/lib/prisma";
import { tryResolveTurn } from "../commands/resolveTurn";

// GET /api/battle/[id]/status — polling leve; também é quem "empurra" a
// resolução do turno quando o timeout estoura (não há worker/cron).
export async function getBattleStatus(battleId: string, userId: string) {
  const battle = await tryResolveTurn(battleId);
  if (!battle) return { error: "not_found" as const };

  const me = battle.participants.find((p) => p.userId === userId);
  if (!me) return { error: "forbidden" as const };
  const opponent = battle.participants.find((p) => p.userId !== userId)!;

  let waitingOn: "you" | "opponent" | "both" | null = null;
  if (battle.status === "IN_PROGRESS") {
    const pendingMoves = await prisma.battlePendingMove.findMany({
      where: { battleId, turnNumber: battle.currentTurn },
      select: { userId: true },
    });
    const submitted = new Set(pendingMoves.map((m) => m.userId));
    const meSubmitted = submitted.has(userId);
    const oppSubmitted = submitted.has(opponent.userId);
    waitingOn = !meSubmitted && !oppSubmitted ? "both" : !meSubmitted ? "you" : !oppSubmitted ? "opponent" : null;
  }

  return {
    status: battle.status,
    turnNumber: battle.currentTurn,
    winnerId: battle.winnerId,
    waitingOn,
  };
}
