import { prisma } from "@/src/lib/prisma";

// GET /api/battle/queue/status — polling leve enquanto espera pareamento
export async function getQueueStatus(userId: string) {
  const matchedBattle = await prisma.battleParticipant.findFirst({
    where: { userId, battle: { status: "IN_PROGRESS" } },
    select: { battleId: true },
  });
  if (matchedBattle) return { queued: false, matched: true as const, battleId: matchedBattle.battleId };

  const queued = await prisma.matchmakingQueueEntry.findUnique({ where: { userId } });
  return { queued: Boolean(queued), matched: false as const };
}
