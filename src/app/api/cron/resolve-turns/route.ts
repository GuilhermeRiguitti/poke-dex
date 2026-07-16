import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { resolveDueBattles } from "@/src/modules/battle";

// POST /api/cron/resolve-turns — o "worker" da batalha.
//
// Quem chama NÃO é um jogador: é o `pg_cron` do Supabase, via `pg_net`, a cada
// poucos segundos (ver PLANO_JOGO.md §8). A rota é casca fina: autentica pelo
// segredo e delega pra resolveDueBattles, que varre as partidas com turno
// vencido e resolve cada uma. O motor de batalha continua num lugar só (o
// módulo battle) — o cron só DISPARA, não reimplementa nada.
//
// force-dynamic: nunca cachear; cada POST tem que rodar a varredura de verdade.
export const dynamic = "force-dynamic";

/**
 * Autoriza pelo header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Fail-closed: sem `CRON_SECRET` no ambiente, ninguém entra. Melhor a rota ficar
 * 401 (o cron não roda, o polling do cliente ainda segura o jogo) do que abrir
 * um endpoint que resolve turnos pra qualquer um da internet.
 *
 * Comparação timing-safe: o segredo vem de fora a cada request; `===` vazaria o
 * tamanho/prefixo do segredo pelo tempo de resposta.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  // timingSafeEqual exige o mesmo tamanho; tamanhos diferentes já é "errado".
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await resolveDueBattles();
  return NextResponse.json(summary);
}
