import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { applyTM, type ApplyTmInput } from "@/src/modules/training";

// POST /api/training/tm — ensina um golpe de MÁQUINA (TM) a um Pokémon do
// jogador, gastando 1 token de TM. Casca fina: sessão → command → HTTP.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<ApplyTmInput>;
  if (!body.userPokemonId || !body.moveId) {
    return NextResponse.json({ error: "userPokemonId e moveId são obrigatórios" }, { status: 400 });
  }

  const result = await applyTM(session.user.id, { userPokemonId: body.userPokemonId, moveId: body.moveId });

  if (!result.ok) {
    // no_tokens = 409 (conflito com o estado: sem saldo). not_found = 404. O
    // resto (not_machine_move / already_known) é pedido inválido = 400.
    const status = result.error === "not_found" ? 404 : result.error === "no_tokens" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ moveId: result.moveId, tmTokens: result.tmTokens });
}
