-- Turno SIMULTÂNEO (volta ao modelo da série) + learnset liberado por NÍVEL.
--
-- Nenhuma tabela nova → nenhuma RLS a ligar aqui (AGENTS.md). As 16 tabelas já
-- estão com RLS ligada desde 20260714010000_enable_rls_all_tables.
--
-- ⚠️ DEPOIS DESTA MIGRATION É OBRIGATÓRIO RODAR `npm run seed`.
-- O learnset antigo não tem como ser convertido: ele era um par
-- (pokemon, move) sem nível nem método, e o dado que falta só existe na
-- PokéAPI. Preencher com default seria pior que apagar — todo move viraria
-- "aprendido no nível 0", ou seja, o gating nasceria desligado em silêncio.

-- ── 1. Espelho: quanto vale derrotar cada espécie (fórmula de XP da série) ──
ALTER TABLE "Pokemon" ADD COLUMN "baseExperience" INTEGER;

-- ── 2. Learnset fiel: nível, método e jogo de referência ───────────────────
DELETE FROM "PokemonMove";

ALTER TABLE "PokemonMove"
  ADD COLUMN "levelLearnedAt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "learnMethod"    TEXT    NOT NULL DEFAULT 'level-up',
  ADD COLUMN "versionGroup"   TEXT    NOT NULL DEFAULT '';

CREATE INDEX "PokemonMove_pokemonId_learnMethod_levelLearnedAt_idx"
  ON "PokemonMove"("pokemonId", "learnMethod", "levelLearnedAt");

-- ── 3. Coleção: nível inicial 5 e xp como TOTAL acumulado (curva n³) ────────
-- `xp` era o progresso DENTRO do nível; agora é o total (level == cbrt(xp)).
-- A conversão reescreve as duas colunas pra manter a invariante.
ALTER TABLE "UserPokemon"
  ALTER COLUMN "level" SET DEFAULT 5,
  ALTER COLUMN "xp"    SET DEFAULT 125;

UPDATE "UserPokemon" SET "level" = GREATEST("level", 5);
UPDATE "UserPokemon" SET "xp" = POWER("level", 3);

-- ── 4. Batalha simultânea ──────────────────────────────────────────────────
-- Partidas em andamento não migram: a semântica do turno mudou (não existe
-- mais "de quem é a vez"), e uma partida a meio caminho ficaria travada. Como
-- não há worker pra consertar depois (CLAUDE.md §5), encerram aqui.
UPDATE "Battle"
   SET "status" = 'ABANDONED', "finishedAt" = now()
 WHERE "status" = 'IN_PROGRESS';

DELETE FROM "BattleAction";

ALTER TABLE "Battle" DROP COLUMN "activeUserId";

-- De onde veio o combatente, pra creditar XP no fim da partida. Nullable e SEM
-- foreign key de propósito: o snapshot é congelado e tem que sobreviver ao
-- jogador soltar o pokémon da coleção no meio do duelo.
ALTER TABLE "BattlePokemon" ADD COLUMN "userPokemonId" TEXT;
