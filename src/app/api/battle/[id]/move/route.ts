import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { submitAction, type SubmitActionInput } from "@/src/modules/battle";

// POST /api/battle/[id]/move — registra a carta do jogador no round e resolve o
// turno se o oponente também já jogou (simultâneo: quem chega por último resolve)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: battleId } = await params;
  const body = (await req.json()) as SubmitActionInput;

  const result = await submitAction(battleId, session.user.id, body);
  if ("error" in result) {
    switch (result.error) {
      case "not_found":
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "finished":
        return NextResponse.json({ error: "Essa partida já terminou" }, { status: 400 });
      case "forbidden":
        return NextResponse.json({ error: "Not a participant" }, { status: 403 });
      case "stale_turn":
        return NextResponse.json({ error: "Turno desatualizado", round: result.round }, { status: 409 });
      case "validation":
        return NextResponse.json({ error: result.message }, { status: 400 });
    }
  }

  return NextResponse.json(result.battle);
}
