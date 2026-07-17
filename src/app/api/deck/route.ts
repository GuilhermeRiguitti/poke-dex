import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { addToDeck, type AddToDeckInput } from "@/src/modules/deck";

// POST /api/deck — monta um loadout no deck (1 UserPokemon + as cartas escolhidas).
//
// O deck nasce aqui, no command, quando o jogador monta o primeiro loadout. A
// página lê o deck no servidor (deck/queries/readDeck, que só lê e devolve null
// se não houver deck).
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Partial<AddToDeckInput>;
  if (!body.userPokemonId || !Array.isArray(body.moveIds)) {
    return NextResponse.json({ error: "userPokemonId e moveIds são obrigatórios" }, { status: 400 });
  }

  const result = await addToDeck(session.user.id, { userPokemonId: body.userPokemonId, moveIds: body.moveIds });

  if (!result.ok) {
    // deck_full é 409 (conflito com o estado atual). invalid_cards é 400 (pedido
    // malformado). not_found é 404.
    const status = result.error === "deck_full" ? 409 : result.error === "invalid_cards" ? 400 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.slot, { status: 201 });
}
