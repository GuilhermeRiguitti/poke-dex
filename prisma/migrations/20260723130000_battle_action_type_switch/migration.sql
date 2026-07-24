-- Troca de pokémon na batalha (time de 6): a jogada de um round agora pode ser
-- um GOLPE (MOVE) ou uma TROCA (SWITCH). O payload continua em cardSlot —
-- MOVE: índice do golpe 0..5; SWITCH: slot do pokémon alvo 1..6.
--
-- Aditiva: enum novo + coluna NOT NULL com DEFAULT 'MOVE' (qualquer linha antiga
-- vira MOVE). Nenhuma tabela nova — a RLS já está ligada em BattleAction, então
-- não há ENABLE ROW LEVEL SECURITY a repetir aqui (AGENTS.md / CLAUDE.md #5).

-- CreateEnum
CREATE TYPE "BattleActionType" AS ENUM ('MOVE', 'SWITCH');

-- AlterTable
ALTER TABLE "BattleAction" ADD COLUMN "type" "BattleActionType" NOT NULL DEFAULT 'MOVE';
