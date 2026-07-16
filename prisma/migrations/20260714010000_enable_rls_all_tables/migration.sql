-- Fecha a API PostgREST pública do Supabase (anon key) ligando RLS em todas as
-- tabelas. O app acessa o banco só via Prisma, que conecta como a role `postgres`
-- (BYPASSRLS + dona das tabelas), então RLS sem policies = deny-all para
-- anon/authenticated sem afetar o runtime. Ver alerta rls_disabled_in_public.

-- `_prisma_migrations` é criada pelo PRÓPRIO Prisma, não por uma migration —
-- então ela NÃO existe no shadow database que o `migrate dev` usa pra validar,
-- e um ALTER direto quebra ali (P1014). No banco real ela existe e a RLS aplica;
-- o guard só pula a linha no shadow (throwaway), preservando a segurança em prod.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations') THEN
    EXECUTE 'ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
ALTER TABLE "User"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Verification"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserCard"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deck"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeckCard"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PokeApiCache"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Battle"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BattleParticipant"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BattlePokemon"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BattlePendingMove"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BattleTurnLog"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchmakingQueueEntry"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PackState"              ENABLE ROW LEVEL SECURITY;
