/*
  Warnings:

  - You are about to drop the `PokeApiCache` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "PokeApiCache";

-- CreateTable
CREATE TABLE "Type" (
    "id" TEXT NOT NULL,
    "typeApiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "doubleDamageTo" JSONB NOT NULL,
    "halfDamageTo" JSONB NOT NULL,
    "noDamageTo" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Type_typeApiId_key" ON "Type"("typeApiId");

-- CreateIndex
CREATE UNIQUE INDEX "Type_name_key" ON "Type"("name");

-- RLS na MESMA migration que cria a tabela (AGENTS.md). Sem isso a tabela nasce
-- aberta na API PostgREST pública. Sem policies de propósito: é deny-all, e o
-- runtime não passa por RLS (Prisma conecta como `postgres`, dono + BYPASSRLS).
-- Nunca FORCE — FORCE sujeitaria o dono à RLS e derrubaria o app.
ALTER TABLE "Type" ENABLE ROW LEVEL SECURITY;
