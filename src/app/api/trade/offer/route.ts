import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { createTradeOffer, type CreateTradeOfferInput } from "@/src/modules/trade";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// POST /api/trade/offer — põe uma carta à disposição e devolve o CÓDIGO.
// Casca fina: sessão → freio → command → HTTP. Nenhuma regra mora aqui.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("tradeOffer", session.user.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Partial<CreateTradeOfferInput>;
  if (!body.userPokemonId) {
    return NextResponse.json({ error: "userPokemonId é obrigatório" }, { status: 400 });
  }

  const result = await createTradeOffer(session.user.id, { userPokemonId: body.userPokemonId });

  if (!result.ok) {
    // not_found = 404 (não é sua, ou não existe). in_deck/in_battle/
    // already_offered = 409: o pedido está certo, o ESTADO é que não deixa.
    // code_collision = 500: 3 sorteios seguidos colidindo é falha nossa.
    const status =
      result.error === "not_found" ? 404 : result.error === "code_collision" ? 500 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(
    { id: result.id, code: result.code, expiresAt: result.expiresAt.toISOString() },
    { status: 201 },
  );
}
