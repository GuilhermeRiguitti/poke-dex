-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "userPokemonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeLog" (
    "id" TEXT NOT NULL,
    "userPokemonId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "tradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeOffer_code_key" ON "TradeOffer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOffer_userPokemonId_key" ON "TradeOffer"("userPokemonId");

-- CreateIndex
CREATE INDEX "TradeOffer_fromUserId_idx" ON "TradeOffer"("fromUserId");

-- CreateIndex
CREATE INDEX "TradeOffer_expiresAt_idx" ON "TradeOffer"("expiresAt");

-- CreateIndex
CREATE INDEX "TradeLog_userPokemonId_idx" ON "TradeLog"("userPokemonId");

-- CreateIndex
CREATE INDEX "TradeLog_toUserId_idx" ON "TradeLog"("toUserId");

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_userPokemonId_fkey" FOREIGN KEY ("userPokemonId") REFERENCES "UserPokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: tabela nova nasce com Row-Level Security ligada, na MESMA migration que a
-- cria (AGENTS.md). Sem policies = deny-all pra API PostgREST pública
-- (anon/authenticated), transparente pro runtime (Prisma como `postgres`, dono
-- das tabelas + BYPASSRLS). NUNCA FORCE — FORCE sujeitaria o dono à RLS e, sem
-- policy, derrubaria o app.
--
-- Aqui a RLS vale ouro: `TradeOffer` guarda os CÓDIGOS. Exposta na API pública,
-- um `select code from "TradeOffer"` entregaria todas as ofertas vivas do jogo
-- de uma vez — o freio de força bruta viraria enfeite, porque não haveria nada
-- pra adivinhar. `TradeLog` guarda quem trocou com quem, que é justamente a
-- identidade que a troca por código existe pra não expor.
ALTER TABLE "TradeOffer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TradeLog"   ENABLE ROW LEVEL SECURITY;
