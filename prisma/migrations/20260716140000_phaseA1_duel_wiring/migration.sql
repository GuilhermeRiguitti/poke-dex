-- Fase A1-wiring (PLANO_JOGO.md §9): corta o jogo simultâneo antigo e liga o
-- duelo tático 1×1 por turnos ALTERNADOS.
--
-- DESTRUTIVA de propósito (reset autorizado, F3): remove UserCard/DeckCard
-- (coleção/deck antigos, substituídos por UserPokemon + DeckSlot/DeckSlotCard) e
-- BattlePendingMove (par de jogadas do simultâneo, substituído por BattleAction,
-- a carta única do jogador da vez). Battle ganha round + activeUserId.

-- As partidas do modelo antigo são incompatíveis (ficariam com activeUserId
-- nulo e presariam o jogador). Sob F3 (sem dado a preservar) elas caem aqui;
-- cascata limpa participantes/pokémons/ações/logs.
DELETE FROM "Battle";

-- DropForeignKey
ALTER TABLE "BattlePendingMove" DROP CONSTRAINT "BattlePendingMove_battleId_fkey";

-- DropForeignKey
ALTER TABLE "DeckCard" DROP CONSTRAINT "DeckCard_deckId_fkey";

-- DropForeignKey
ALTER TABLE "DeckCard" DROP CONSTRAINT "DeckCard_userCardId_fkey";

-- DropForeignKey
ALTER TABLE "UserCard" DROP CONSTRAINT "UserCard_userId_fkey";

-- AlterTable
ALTER TABLE "Battle" DROP COLUMN "currentTurn",
ADD COLUMN     "activeUserId" TEXT,
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "BattlePokemon" ALTER COLUMN "level" DROP DEFAULT;

-- DropTable
DROP TABLE "BattlePendingMove";

-- DropTable
DROP TABLE "DeckCard";

-- DropTable
DROP TABLE "UserCard";

-- DropEnum
DROP TYPE "BattleActionType";

-- CreateTable
CREATE TABLE "DeckSlot" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userPokemonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DeckSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckSlotCard" (
    "id" TEXT NOT NULL,
    "deckSlotId" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DeckSlotCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleAction" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "cardSlot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeckSlot_deckId_order_key" ON "DeckSlot"("deckId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DeckSlot_deckId_userPokemonId_key" ON "DeckSlot"("deckId", "userPokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckSlotCard_deckSlotId_order_key" ON "DeckSlotCard"("deckSlotId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "DeckSlotCard_deckSlotId_moveId_key" ON "DeckSlotCard"("deckSlotId", "moveId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleAction_battleId_round_userId_key" ON "BattleAction"("battleId", "round", "userId");

-- AddForeignKey
ALTER TABLE "DeckSlot" ADD CONSTRAINT "DeckSlot_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSlot" ADD CONSTRAINT "DeckSlot_userPokemonId_fkey" FOREIGN KEY ("userPokemonId") REFERENCES "UserPokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSlotCard" ADD CONSTRAINT "DeckSlotCard_deckSlotId_fkey" FOREIGN KEY ("deckSlotId") REFERENCES "DeckSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSlotCard" ADD CONSTRAINT "DeckSlotCard_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleAction" ADD CONSTRAINT "BattleAction_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────
-- RLS nas tabelas NOVAS, na MESMA migration (AGENTS.md): deny-all pra API
-- PostgREST pública, transparente pro runtime (Prisma como `postgres`, dono +
-- BYPASSRLS). SEM policies de propósito — o app não usa a anon key. NUNCA FORCE.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "DeckSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckSlotCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BattleAction" ENABLE ROW LEVEL SECURITY;
