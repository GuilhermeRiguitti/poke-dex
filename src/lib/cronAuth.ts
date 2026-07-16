import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

// Autorização compartilhada das rotas de cron (PLANO_JOGO.md §8). Quem chama
// não é um jogador: é o pg_cron do Supabase, via pg_net, com
// `Authorization: Bearer <CRON_SECRET>`. O MESMO segredo está no Vault do
// Supabase e na Vercel.
//
// Fail-closed: sem CRON_SECRET no ambiente, NINGUÉM entra. Melhor a rota ficar
// 401 (o cron não roda) do que abrir um endpoint que mexe no banco pra qualquer
// um da internet.
//
// Comparação timing-safe: o segredo vem de fora a cada request; `===` vazaria o
// tamanho/prefixo pelo tempo de resposta.
export function authorizeCron(req: NextRequest): boolean {
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
