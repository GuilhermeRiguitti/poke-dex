-- Evolução por nível no espelho (pokedex/domain/evolution.ts). Aditiva: duas
-- colunas nullable em Pokemon, populadas pelo próximo `npm run seed`. Nenhuma
-- tabela nova (Pokemon já tem RLS), então não há ALTER ... ENABLE RLS aqui.
ALTER TABLE "Pokemon" ADD COLUMN "evolvesToApiId" INTEGER;
ALTER TABLE "Pokemon" ADD COLUMN "evolvesToLevel" INTEGER;
