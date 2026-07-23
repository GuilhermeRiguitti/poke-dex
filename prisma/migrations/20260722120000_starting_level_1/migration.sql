-- Todo pokémon nasce em nível 1 (STARTING_LEVEL = 1), não mais 5.
-- Só o DEFAULT muda: o openPack já grava level/xp explícitos, então nenhuma
-- linha existente é reescrita aqui. É alinhamento do schema com a regra nova
-- (pokedex/domain/leveling.ts).
ALTER TABLE "UserPokemon" ALTER COLUMN "level" SET DEFAULT 1;
ALTER TABLE "UserPokemon" ALTER COLUMN "xp" SET DEFAULT 1;
