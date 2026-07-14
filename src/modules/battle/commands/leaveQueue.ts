import { prisma } from "@/src/lib/prisma";

// Sai da fila de matchmaking (DELETE /api/battle/queue)
export async function leaveQueue(userId: string) {
  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId } });
}
