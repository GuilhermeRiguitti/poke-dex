-- Deny-all RLS em TODA tabela do schema public. O app fala com o banco via
-- Prisma como role `postgres` (dono + BYPASSRLS → não passa por RLS); a API
-- PostgREST pública (anon/authenticated), sim. RLS sem policy = deny-all pra ela.
--
-- ⚠️ DINÂMICO de propósito (não uma lista fixa): roda DEPOIS do `prisma migrate
-- deploy` (as tabelas já existem) e o schema EVOLUI — `UserCard`→`UserPokemon`,
-- `DeckCard`→`DeckSlot/DeckSlotCard`, `Pokemon`/`Move`/... entraram depois. Uma
-- lista fixa quebraria no rebuild ao referenciar tabela que não existe mais.
-- Aqui varremos o que existir. Idempotente: ligar RLS já-ligada é no-op, então
-- convive de boa com o RLS que as próprias migrations Prisma já ligam por tabela.
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
