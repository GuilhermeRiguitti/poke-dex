-- Estado alterado do combatente (status, stat stages, confusão, semente).
-- Aditiva e anulável de propósito: as partidas EM ANDAMENTO ficam com NULL, que
-- `normalizeConditions` (battle/domain/conditions.ts) lê como "estado limpo" —
-- ninguém precisa de backfill nem trava no deploy.

-- AlterTable
ALTER TABLE "BattlePokemon" ADD COLUMN     "conditions" JSONB;
