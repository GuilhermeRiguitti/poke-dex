import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { tryResolveTurn } from "@/lib/battle/resolve";

// GET /api/battle/[id] — estado completo (times dos dois lados). Só deve ser
// buscado pelo client quando o turnNumber avança (GET /status é o polling leve).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const battle = await tryResolveTurn(id);
  if (!battle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParticipant = battle.participants.some((p) => p.userId === session.user.id);
  if (!isParticipant) return NextResponse.json({ error: "Not a participant" }, { status: 403 });

  return NextResponse.json(battle);
}
