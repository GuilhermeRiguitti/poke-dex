import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { breedPokemon, getBreedingPreview, type BreedPokemonInput } from "@/src/modules/pokemon";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// GET  /api/breeding?a=<id>&b=<id> — o que SAIRIA (não gasta o dia).
// POST /api/breeding               — cruza de verdade.
//
// Casca fina: sessão → freio → command/query → HTTP. O GET não tem freio porque
// só lê e é o que a tela usa pra testar combinações — pôr teto ali empurraria o
// jogador a chutar no POST, que é o que custa o dia.

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "a e b são obrigatórios" }, { status: 400 });

  const preview = await getBreedingPreview(session.user.id, a, b);
  if (!preview) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(preview);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("breed", session.user.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Partial<BreedPokemonInput>;
  if (!body.parentAId || !body.parentBId) {
    return NextResponse.json({ error: "parentAId e parentBId são obrigatórios" }, { status: 400 });
  }

  const result = await breedPokemon(session.user.id, {
    parentAId: body.parentAId,
    parentBId: body.parentBId,
  });

  if (!result.ok) {
    // already_bred_today = 409 (o pedido está certo, o ESTADO é que não deixa).
    // not_found = 404. same_card/no_egg_move = 400 (pedido inválido).
    const status =
      result.error === "not_found" ? 404 : result.error === "already_bred_today" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
