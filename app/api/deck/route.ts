import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

// GET /api/deck — retorna o deck ativo do usuário (cria se não existir)
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let deck = await prisma.deck.findFirst({
    where: { userId: session.user.id },
    include: {
      deckCards: {
        include: { userCard: true },
        orderBy: { addedAt: "asc" },
      },
    },
  });

  if (!deck) {
    deck = await prisma.deck.create({
      data: { userId: session.user.id },
      include: {
        deckCards: {
          include: { userCard: true },
          orderBy: { addedAt: "asc" },
        },
      },
    });
  }

  return NextResponse.json(deck);
}

// POST /api/deck — adiciona um UserCard ao deck
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userCardId } = await req.json() as { userCardId: string };
  if (!userCardId) return NextResponse.json({ error: "userCardId is required" }, { status: 400 });

  // Verifica que o userCard pertence ao usuário
  const userCard = await prisma.userCard.findUnique({ where: { id: userCardId } });
  if (!userCard || userCard.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Busca ou cria o deck
  let deck = await prisma.deck.findFirst({ where: { userId: session.user.id } });
  if (!deck) {
    deck = await prisma.deck.create({ data: { userId: session.user.id } });
  }

  const deckCard = await prisma.deckCard.upsert({
    where: { deckId_userCardId: { deckId: deck.id, userCardId } },
    update: {},
    create: { deckId: deck.id, userCardId },
    include: { userCard: true },
  });

  return NextResponse.json(deckCard, { status: 201 });
}
