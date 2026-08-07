import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { saveDeck } from "@/src/modules/deck";

// PUT /api/deck — grava o TIME INTEIRO. Corpo: { slots: [{ userPokemonId, order }] }.
//
// É o único caminho de escrita do deck. Saíram daqui, quando montar o time virou
// rascunho de cliente com botão de salvar:
//   - POST /api/deck        (punha UM pokémon)
//   - DELETE /api/deck/[id] (tirava UM slot)
//   - PATCH /api/deck/order (regravava a ordem)
//
// PUT, e não POST/PATCH, porque a semântica é essa: o corpo é o time completo e
// substitui o que estava lá. Mandar uma lista vazia esvazia o deck — é como se
// desmonta o time, e o matchmaking é quem barra entrar em batalha sem pokémon.
export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // O corpo pode nem ser JSON. `saveDeck` recebe `unknown` e valida — nenhuma
  // asserção de tipo aqui estaria valendo alguma coisa.
  const body = (await req.json().catch(() => null)) as { slots?: unknown } | null;

  const result = await saveDeck(session.user.id, body?.slots);

  if (!result.ok) {
    // invalid_slots e invalid_cards são 400 (pedido malformado / time que não dá
    // pra jogar); not_found é 404 (pokémon que não é do jogador).
    if (result.error === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (result.error === "invalid_cards") {
      return NextResponse.json({ error: "invalid_cards", names: result.names }, { status: 400 });
    }
    return NextResponse.json({ error: "invalid_slots", issue: result.issue }, { status: 400 });
  }

  // O deck gravado volta no corpo: a tela substitui o rascunho pelo que o
  // servidor confirmou, sem uma segunda ida ao banco.
  return NextResponse.json(result.board);
}
