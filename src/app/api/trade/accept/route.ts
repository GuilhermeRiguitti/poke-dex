import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { acceptTradeOffer, type AcceptTradeOfferInput } from "@/src/modules/trade";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// POST /api/trade/accept — aceita a oferta de um código e recebe a carta.
//
// O freio aqui NÃO é cortesia: esta é a única rota do jogo em que acertar um
// valor que você não tem entrega um prêmio. Ele vem ANTES de qualquer ida ao
// banco, pra uma varredura nem chegar a consultar.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("tradeAccept", session.user.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Partial<AcceptTradeOfferInput>;
  if (typeof body.code !== "string") {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const result = await acceptTradeOffer(session.user.id, { code: body.code });

  if (!result.ok) {
    // 404 pra invalid_code — e ele cobre inexistente, vencido E já aceito de
    // propósito (ver acceptTradeOffer). Status diferente por caso seria o mesmo
    // oráculo que a mensagem única evita.
    const status = result.error === "own_offer" ? 400 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ userPokemonId: result.userPokemonId });
}
