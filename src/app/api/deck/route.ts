import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { addToDeck } from "@/src/modules/deck";

// POST /api/deck — põe um pokémon da coleção no deck.
//
// O GET que existia aqui foi removido, e ele era o pior dos três: um GET que
// CRIAVA um deck como efeito colateral (findFirst-ou-create). O único consumidor
// era o useEffect da coleção; agora a página lê o deck no servidor
// (deck/queries/readDeck, que só lê e devolve null se não houver deck), e o deck
// nasce aqui, no command, quando o jogador põe o primeiro pokémon nele.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userCardId } = (await req.json()) as { userCardId?: string };
  if (!userCardId) return NextResponse.json({ error: "userCardId is required" }, { status: 400 });

  const result = await addToDeck(session.user.id, userCardId);

  if (!result.ok) {
    // deck_full é 409 (conflito com o estado atual), não 400: o pedido está bem
    // formado, o deck é que está cheio.
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "deck_full" ? 409 : 404 }
    );
  }

  return NextResponse.json(result.card, { status: 201 });
}
