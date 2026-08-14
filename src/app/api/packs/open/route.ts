import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { openPack } from "@/src/modules/packs";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// POST /api/packs/open — abre um pacote (a ÚNICA forma de obter pokémon).
//
// Casca fina: valida a sessão, chama o command, traduz o resultado em HTTP.
// Nenhuma regra mora aqui — sorteio, cooldown, claim atômico e aquecimento de
// cache são tudo do command openPack.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("openPack", session.user.id);
  if (limited) return limited;

  const result = await openPack(session.user.id);

  if (!result.ok) {
    // on_cooldown: sem pacote disponível (cooldown ativo e sem extras).
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ cards: result.cards, packState: result.packState }, { status: 201 });
}
