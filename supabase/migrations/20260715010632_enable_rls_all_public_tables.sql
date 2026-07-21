-- App usa Prisma como role `postgres` (BYPASSRLS + dona das tabelas).
-- RLS sem policies = deny-all para anon/authenticated (PostgREST), Prisma segue intacto.
--
-- ⚠️ Depende das tabelas já existirem → em ambiente novo o `prisma migrate deploy`
-- roda ANTES do `supabase db push` (é a ordem do .github/workflows/deploy.yml).
-- Conteúdo fiel ao que foi aplicado no prod (ledger supabase_migrations, v20260715010632).
ALTER TABLE public."_prisma_migrations"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Account"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Verification"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserCard"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Deck"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DeckCard"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PokeApiCache"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Battle"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BattleParticipant"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BattlePokemon"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BattlePendingMove"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BattleTurnLog"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MatchmakingQueueEntry"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PackState"              ENABLE ROW LEVEL SECURITY;
