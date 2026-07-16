import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/src/lib/cronAuth";
import { refreshPokedex } from "@/src/modules/pokedex";

// POST /api/cron/refresh-pokedex — mantém o espelho da PokéAPI fresco
// (PLANO_JOGO.md §7). Mesmo motor de cron do resolve-turns: o pg_cron do
// Supabase dispara com `Authorization: Bearer <CRON_SECRET>`; a rota autentica
// e delega pro command, que re-sincroniza o lote mais antigo. 1×/dia sobra —
// dado de geração já lançada quase não muda.
//
// force-dynamic: nunca cachear; cada POST tem que rodar a sincronização.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await refreshPokedex();
  return NextResponse.json(summary);
}
