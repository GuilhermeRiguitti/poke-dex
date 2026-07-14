import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { fetchPokemon } from "@/src/lib/pokeapi";
import { prisma } from "@/src/lib/prisma";

// GET /api/cards — lista as cartas do usuário autenticado
// (só id/pokemonId — nome/sprite/stats o client busca em /api/pokeapi/[id])
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userCards = await prisma.userCard.findMany({
    where: { userId: session.user.id },
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json(userCards);
}

// POST /api/cards — adiciona um Pokémon à coleção do usuário
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pokemonId } = body as { pokemonId: number };

  if (!pokemonId) {
    return NextResponse.json({ error: "pokemonId is required" }, { status: 400 });
  }

  const pokemon = await fetchPokemon(pokemonId);
  if (!pokemon) {
    return NextResponse.json({ error: "Pokemon not found in PokéAPI" }, { status: 404 });
  }

  const userCard = await prisma.userCard.upsert({
    where: { userId_pokemonId: { userId: session.user.id, pokemonId } },
    update: {},
    create: { userId: session.user.id, pokemonId },
  });

  return NextResponse.json(userCard, { status: 201 });
}
