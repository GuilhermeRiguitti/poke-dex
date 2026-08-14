import type { Prisma } from "@prisma/client";
import { utcDayIndex } from "@/src/lib/utcDay";
import { QUEST_CATALOG, questsForDay, type QuestEvent } from "../domain/questCatalog";

// Conta +1 nas quests do dia que escutam este evento.
//
// ⚠️ RECEBE O `tx` E NÃO ABRE A PRÓPRIA TRANSAÇÃO — mesma forma do `grantXp`, e
// pelo MESMO motivo, que é a lição mais cara do projeto: quem chama é o
// `commit()` do `resolveTurn`, DENTRO do claim otimista que garante que só uma
// lambda encerra a partida. Fora dele, o polling de 2s dos dois jogadores
// pagaria a quest a cada leitura — o jogador completaria "vença 3 batalhas" sem
// jogar, só deixando a aba aberta.
//
// Não lança nunca: uma quest que falha não pode derrubar a transação que
// encerra a partida (o XP e o resultado importam mais que a barrinha).

export async function trackQuestEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  event: QuestEvent,
  now: Date = new Date(),
): Promise<void> {
  const dayIndex = utcDayIndex(now);
  const ativas = questsForDay(dayIndex).filter((q) => q.event === event);
  if (ativas.length === 0) return;

  for (const quest of ativas) {
    // `upsert` sobre a @@id fecha o findFirst→create, que seria corrida
    // (CLAUDE.md regra 6). O `increment` é atômico no banco: duas lambdas não
    // leem-e-escrevem o mesmo valor velho.
    await tx.questProgress.upsert({
      where: { userId_questId_dayIndex: { userId, questId: quest.id, dayIndex } },
      create: { userId, questId: quest.id, dayIndex, progress: 1 },
      update: { progress: { increment: 1 } },
    });
  }
}

/**
 * Os dois lados de uma partida encerrada, numa chamada só.
 *
 * Existe pra o `commit()` não precisar saber quais eventos existem — ele sabe
 * quem jogou e quem venceu, que é o que a partida tem a dizer.
 */
export async function trackBattleFinished(
  tx: Prisma.TransactionClient,
  params: { userIds: string[]; winnerId: string | null },
  now: Date = new Date(),
): Promise<void> {
  for (const userId of params.userIds) {
    await trackQuestEvent(tx, userId, "battle_played", now);
  }
  if (params.winnerId) {
    await trackQuestEvent(tx, params.winnerId, "battle_won", now);
  }
}

/** Exportado pro teste conferir que todo evento do catálogo tem quem o dispare. */
export const KNOWN_EVENTS: QuestEvent[] = [...new Set(QUEST_CATALOG.map((q) => q.event))];
