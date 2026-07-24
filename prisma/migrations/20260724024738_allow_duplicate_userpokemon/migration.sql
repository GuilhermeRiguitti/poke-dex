-- DropIndex
DROP INDEX "UserPokemon_userId_pokemonId_key";

-- CreateIndex
CREATE INDEX "UserPokemon_userId_pokemonId_idx" ON "UserPokemon"("userId", "pokemonId");
