import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { enqueueBattle, leaveQueue } from "@/src/modules/battle";

// POST /api/battle/queue — entra na fila de matchmaking; pareia na hora se possível
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deckId } = (await req.json()) as { deckId?: string };
  if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });

  const result = await enqueueBattle(session.user.id, deckId);
  if ("error" in result) {
    if (result.error === "empty_deck") {
      return NextResponse.json({ error: "Deck vazio ou não encontrado" }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao montar o time de batalha" }, { status: 500 });
  }

  if ("created" in result) {
    return NextResponse.json({ matched: result.matched, battleId: result.battleId }, { status: 201 });
  }
  return NextResponse.json(result);
}

// DELETE /api/battle/queue — sai da fila
export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await leaveQueue(session.user.id);
  return NextResponse.json({ success: true });
}
