import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/src/lib/cronAuth";
import { refreshPokedex } from "@/src/modules/pokemon";

// POST /api/cron/refresh-pokedex — mantém o espelho da PokéAPI fresco
// (CLAUDE.md consequência #4). Mesmo motor de cron do resolve-turns: o pg_cron do
// Supabase dispara com `Authorization: Bearer <CRON_SECRET>`; a rota autentica
// e delega pro command, que re-sincroniza o lote mais antigo.
//
// `?batch=N` (opcional) diz o tamanho do lote. Fica na URL, e não fixo no
// código, porque quem decide o ritmo é o AGENDAMENTO (quantos disparos por mês),
// e ele vive no `cron.job` do Supabase — fora do repo. O valor é preso a
// MAX_REFRESH_BATCH no command: a rota é autenticada, mas o teto é da lambda e
// não do chamador, então quem manda `batch=500` recebe o teto, não um timeout.
//
// force-dynamic: nunca cachear; cada POST tem que rodar a sincronização.
export const dynamic = "force-dynamic";

// 60s é o teto do plano Hobby, e o refresh precisa dele: o default (bem menor)
// mata a função no meio do lote, e espécie morta no meio não recebe `fetchedAt`
// novo — a passada seguinte pegaria as MESMAS, e o cron nunca avançaria.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pedido = Number(req.nextUrl.searchParams.get("batch"));
  const summary = await refreshPokedex(Number.isFinite(pedido) ? { batch: pedido } : {});
  return NextResponse.json(summary);
}
