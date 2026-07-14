import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { getBattleStatus } from "@/src/modules/battle";

// GET /api/battle/[id]/status — polling leve; também é quem "empurra" a
// resolução do turno quando o timeout estoura (não há worker/cron).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getBattleStatus(id, session.user.id);
  if ("error" in result) {
    if (result.error === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  return NextResponse.json(result);
}
