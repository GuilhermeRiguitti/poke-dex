import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { reorderDeck } from "@/src/modules/deck";

// PATCH /api/deck/order — grava a nova ordem do time depois do arrastar.
//
// Rota própria, e não um PATCH em /api/deck: aquele endereço é o loadout (um
// pokémon + as cartas dele), este é o time inteiro. Corpo: { slotIds: [...] },
// os ids do DeckSlot na ordem final — a posição de cada um é o índice.
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { slotIds?: unknown };
  if (!Array.isArray(body.slotIds) || !body.slotIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "slotIds deve ser uma lista de ids" }, { status: 400 });
  }

  const result = await reorderDeck(session.user.id, body.slotIds);

  if (!result.ok) {
    // stale_order é 409: a lista não bate mais com o deck (a outra aba mexeu no
    // time enquanto este arrastava). O cliente recarrega e mostra o time real.
    return NextResponse.json({ error: result.error }, { status: result.error === "stale_order" ? 409 : 404 });
  }

  return new NextResponse(null, { status: 204 });
}
