import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { getLoadoutOptions } from "@/src/modules/battle";

// GET /api/battle/[id]/loadout?slot=N — as skills que EU posso montar no meu
// pokémon do slot N nesta partida.
//
// Só LÊ (regra 2). E só devolve o MEU time: o servidor resolve quem é o jogador
// pela sessão, então não há como pedir o repertório do oponente por aqui.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: battleId } = await params;
  const slot = Number(req.nextUrl.searchParams.get("slot"));
  if (!Number.isInteger(slot) || slot < 1) {
    return NextResponse.json({ error: "slot inválido" }, { status: 400 });
  }

  const options = await getLoadoutOptions(battleId, session.user.id, slot);
  if (!options) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(options);
}
