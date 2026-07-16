-- CreateTable
CREATE TABLE "Pokemon" (
    "id" TEXT NOT NULL,
    "pokemonApiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "types" JSONB NOT NULL,
    "baseStats" JSONB NOT NULL,
    "spriteUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "moveApiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "power" INTEGER,
    "accuracy" INTEGER,
    "pp" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "damageClass" TEXT NOT NULL,
    "effect" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonMove" (
    "pokemonId" TEXT NOT NULL,
    "moveId" TEXT NOT NULL,

    CONSTRAINT "PokemonMove_pkey" PRIMARY KEY ("pokemonId","moveId")
);

-- CreateTable
CREATE TABLE "UserPokemon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPokemon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pokemon_pokemonApiId_key" ON "Pokemon"("pokemonApiId");

-- CreateIndex
CREATE UNIQUE INDEX "Move_moveApiId_key" ON "Move"("moveApiId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPokemon_userId_pokemonId_key" ON "UserPokemon"("userId", "pokemonId");

-- AddForeignKey
ALTER TABLE "PokemonMove" ADD CONSTRAINT "PokemonMove_pokemonId_fkey" FOREIGN KEY ("pokemonId") REFERENCES "Pokemon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokemonMove" ADD CONSTRAINT "PokemonMove_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "Move"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPokemon" ADD CONSTRAINT "UserPokemon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPokemon" ADD CONSTRAINT "UserPokemon_pokemonId_fkey" FOREIGN KEY ("pokemonId") REFERENCES "Pokemon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS: tabela nova nasce com Row-Level Security ligada (AGENTS.md / CLAUDE.md
-- consequência #5). Sem policies = deny-all pra API PostgREST pública
-- (anon/authenticated), transparente pro runtime (Prisma como `postgres`, dono
-- das tabelas + BYPASSRLS). NUNCA FORCE — FORCE sujeitaria o dono à RLS e, sem
-- policy, derrubaria o app.
ALTER TABLE "Pokemon"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Move"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PokemonMove" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPokemon" ENABLE ROW LEVEL SECURITY;
