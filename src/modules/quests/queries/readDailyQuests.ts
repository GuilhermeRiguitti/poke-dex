import { prisma } from "@/src/lib/prisma";
import { utcDayIndex } from "@/src/lib/utcDay";
import { questsForDay } from "../domain/questCatalog";
import { toQuestDTO } from "./toQuestDTO";
import type { QuestBoardDTO } from "../ui/types";

// SÓ LÊ — pode ser chamada do render de uma page (CLAUDE.md regra 2).
//
// As quests do dia são DERIVADAS do dayIndex (função pura), não lidas do banco:
// o banco só guarda o PROGRESSO. Por isso não existe "criar as quests de hoje" —
// não há worker pra fazer isso à meia-noite, e um jogador que só abrisse o app
// dia 3 não teria quest nenhuma se elas precisassem ser criadas no dia 1.

export async function readDailyQuests(
  userId: string,
  now: Date = new Date(),
): Promise<QuestBoardDTO> {
  const dayIndex = utcDayIndex(now);
  const doDia = questsForDay(dayIndex);

  const [rows, packState] = await Promise.all([
    prisma.questProgress.findMany({
      where: { userId, dayIndex, questId: { in: doDia.map((q) => q.id) } },
      select: { questId: true, progress: true, claimedAt: true },
    }),
    prisma.packState.findUnique({ where: { userId }, select: { tutorTokens: true } }),
  ]);

  const porId = new Map(rows.map((r) => [r.questId, r]));

  return {
    quests: doDia.map((quest) => toQuestDTO(quest, porId.get(quest.id))),
    // `?? 0`: conta que nunca abriu pacote não tem linha em PackState.
    tutorTokens: packState?.tutorTokens ?? 0,
  };
}
