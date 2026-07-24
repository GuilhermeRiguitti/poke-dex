-- Desbloqueio de golpes por fora do nível (TM/tutor/ovo) + economia de TM.
-- PLANO_JOGO §7.1. Aditiva: tabela nova + uma coluna nullable-com-default no
-- PackState. Não converte nada — a coluna nasce zerada e o learnset base
-- (PokemonMove level-up) segue intacto.

-- CreateTable
CREATE TABLE "UserPokemonMove" (
    "id" TEXT NOT NULL,
    "userPokemonId" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPokemonMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPokemonMove_userPokemonId_idx" ON "UserPokemonMove"("userPokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPokemonMove_userPokemonId_moveId_key" ON "UserPokemonMove"("userPokemonId", "moveId");

-- AddForeignKey
ALTER TABLE "UserPokemonMove" ADD CONSTRAINT "UserPokemonMove_userPokemonId_fkey" FOREIGN KEY ("userPokemonId") REFERENCES "UserPokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPokemonMove" ADD CONSTRAINT "UserPokemonMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: economia de TM no PackState (junto de extraPacks).
ALTER TABLE "PackState" ADD COLUMN "tmTokens" INTEGER NOT NULL DEFAULT 0;

-- RLS: tabela nova nasce com Row-Level Security ligada (AGENTS.md / CLAUDE.md
-- consequência #5). Sem policies = deny-all pra API PostgREST pública
-- (anon/authenticated), transparente pro runtime (Prisma como `postgres`, dono
-- das tabelas + BYPASSRLS). NUNCA FORCE — FORCE sujeitaria o dono à RLS e, sem
-- policy, derrubaria o app.
ALTER TABLE "UserPokemonMove" ENABLE ROW LEVEL SECURITY;
