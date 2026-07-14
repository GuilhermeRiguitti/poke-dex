import { NextRequest, NextResponse } from "next/server";

import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

// DELETE /api/cards/[id] — remove a carta da coleção do usuário
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const userCard = await prisma.userCard.findUnique({ where: { id } });
  if (!userCard || userCard.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.userCard.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
