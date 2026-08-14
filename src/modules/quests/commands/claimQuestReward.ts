import { prisma } from "@/src/lib/prisma";
import { utcDayIndex } from "@/src/lib/utcDay";
import { questById } from "../domain/questCatalog";

// Resgata o token de tutor de uma quest completa. ESCREVE — só rota de API.
//
// Concorrência (CLAUDE.md regra 6): dois cliques no "Resgatar" chegam juntos. O
// claim é o `updateMany` que carimba `claimedAt` — e ele já EXIGE
// `claimedAt: null` e `progress >= goal` no próprio where, então quem chega
// depois sai com count 0 e NÃO credita token. Sem isso, cada clique daria um
// token.

export interface ClaimQuestRewardInput {
  questId: string;
}

export type ClaimQuestRewardResult =
  | { ok: true; tutorTokens: number }
  | { ok: false; error: "not_found" | "not_complete" | "already_claimed" };

export async function claimQuestReward(
  userId: string,
  input: ClaimQuestRewardInput,
  now: Date = new Date(),
): Promise<ClaimQuestRewardResult> {
  const quest = questById(input.questId);
  // Id que não está no catálogo: pedido inválido, sem ida ao banco.
  if (!quest) return { ok: false, error: "not_found" };

  const dayIndex = utcDayIndex(now);

  return prisma.$transaction(
    async (tx) => {
      // ── CLAIM (1ª operação).
      const claim = await tx.questProgress.updateMany({
        where: {
          userId,
          questId: quest.id,
          dayIndex,
          claimedAt: null,
          progress: { gte: quest.goal },
        },
        data: { claimedAt: now },
      });

      if (claim.count === 0) {
        // Perdeu o claim. Relemos SÓ pra escolher a mensagem — a decisão de não
        // creditar já foi tomada acima, e esta leitura não pode mudá-la.
        const row = await tx.questProgress.findUnique({
          where: { userId_questId_dayIndex: { userId, questId: quest.id, dayIndex } },
          select: { progress: true, claimedAt: true },
        });
        if (!row) return { ok: false as const, error: "not_complete" as const };
        if (row.claimedAt) return { ok: false as const, error: "already_claimed" as const };
        return { ok: false as const, error: "not_complete" as const };
      }

      // `upsert` e não `update`: a linha do PackState pode não existir (conta que
      // nunca abriu pacote nem fez check-in), e aí um `update` lançaria.
      const state = await tx.packState.upsert({
        where: { userId },
        create: { userId, tutorTokens: 1 },
        update: { tutorTokens: { increment: 1 } },
        select: { tutorTokens: true },
      });

      return { ok: true as const, tutorTokens: state.tutorTokens };
    },
    { timeout: 15_000, maxWait: 5_000 },
  );
}
