import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

// DELETE /api/deck/[id] — remove um DeckCard do deck do usuário
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const deckCard = await prisma.deckCard.findUnique({
    where: { id },
    include: { deck: true },
  });

  if (!deckCard || deckCard.deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.deckCard.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
