import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

// GET /api/cards — lista as cartas do usuário autenticado
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userCards = await prisma.userCard.findMany({
    where: { userId: session.user.id },
    include: {
      pokemon: {
        include: {
          types: { include: { type: true }, orderBy: { slot: "asc" } },
          stats: { include: { stat: true } },
        },
      },
    },
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

  const pokemon = await prisma.pokemon.findUnique({ where: { id: pokemonId } });
  if (!pokemon) {
    return NextResponse.json({ error: "Pokemon not found in database" }, { status: 404 });
  }

  const userCard = await prisma.userCard.upsert({
    where: { userId_pokemonId: { userId: session.user.id, pokemonId } },
    update: {},
    create: { userId: session.user.id, pokemonId },
    include: { pokemon: true },
  });

  return NextResponse.json(userCard, { status: 201 });
}
