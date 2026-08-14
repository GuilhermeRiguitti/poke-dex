-- AlterTable
ALTER TABLE "PackState" ADD COLUMN     "tutorTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuestProgress" (
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("userId","questId","dayIndex")
);

-- CreateIndex
CREATE INDEX "QuestProgress_userId_dayIndex_idx" ON "QuestProgress"("userId", "dayIndex");

-- RLS na tabela nova, na MESMA migration que a cria (AGENTS.md). Sem policies =
-- deny-all pra API PostgREST pública; transparente pro runtime (Prisma como
-- `postgres`, dono + BYPASSRLS). NUNCA FORCE.
--
-- Aberta, esta tabela seria "escreva progress = 999 e resgate o token" — ela é
-- literalmente o contador que decide quem ganha recompensa.
ALTER TABLE "QuestProgress" ENABLE ROW LEVEL SECURITY;
