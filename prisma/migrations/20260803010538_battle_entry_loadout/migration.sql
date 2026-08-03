-- AlterEnum
ALTER TYPE "BattleActionType" ADD VALUE 'LEAD';

-- AlterTable
ALTER TABLE "Battle" ALTER COLUMN "round" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "BattleAction" ADD COLUMN     "loadout" JSONB;
