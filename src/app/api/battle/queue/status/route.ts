import { NextResponse } from "next/server";

import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

// GET /api/battle/queue/status — polling leve enquanto espera pareamento
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const matchedBattle = await prisma.battleParticipant.findFirst({
    where: { userId, battle: { status: "IN_PROGRESS" } },
    select: { battleId: true },
  });
  if (matchedBattle) {
    return NextResponse.json({ queued: false, matched: true, battleId: matchedBattle.battleId });
  }

  const queued = await prisma.matchmakingQueueEntry.findUnique({ where: { userId } });
  return NextResponse.json({ queued: Boolean(queued), matched: false });
}
