import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/src/lib/cronAuth";
import { resolveDueBattles } from "@/src/modules/battle";

// POST /api/cron/resolve-turns — o "worker" da batalha.
//
// Quem chama NÃO é um jogador: é o `pg_cron` do Supabase, via `pg_net`, a cada
// poucos segundos (ver PLANO_JOGO.md §8). A rota é casca fina: autentica pelo
// segredo (authorizeCron) e delega pra resolveDueBattles, que varre as partidas
// com turno vencido e resolve cada uma. O motor de batalha continua num lugar só
// (o módulo battle) — o cron só DISPARA, não reimplementa nada.
//
// force-dynamic: nunca cachear; cada POST tem que rodar a varredura de verdade.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await resolveDueBattles();
  return NextResponse.json(summary);
}
