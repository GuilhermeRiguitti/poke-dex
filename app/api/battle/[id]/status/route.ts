import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { tryResolveTurn } from "@/lib/battle/resolve";

// GET /api/battle/[id]/status — polling leve; também é quem "empurra" a
// resolução do turno quando o timeout estoura (não há worker/cron).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;
  const battle = await tryResolveTurn(id);
  if (!battle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = battle.participants.find((p) => p.userId === userId);
  if (!me) return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  const opponent = battle.participants.find((p) => p.userId !== userId)!;

  let waitingOn: "you" | "opponent" | "both" | null = null;
  if (battle.status === "IN_PROGRESS") {
    const pendingMoves = await prisma.battlePendingMove.findMany({
      where: { battleId: id, turnNumber: battle.currentTurn },
      select: { userId: true },
    });
    const submitted = new Set(pendingMoves.map((m) => m.userId));
    const meSubmitted = submitted.has(userId);
    const oppSubmitted = submitted.has(opponent.userId);
    waitingOn = !meSubmitted && !oppSubmitted ? "both" : !meSubmitted ? "you" : !oppSubmitted ? "opponent" : null;
  }

  return NextResponse.json({
    status: battle.status,
    turnNumber: battle.currentTurn,
    winnerId: battle.winnerId,
    waitingOn,
  });
}
