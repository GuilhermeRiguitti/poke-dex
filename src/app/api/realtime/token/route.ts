import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { signRealtimeToken, REALTIME_TOKEN_TTL_SECONDS } from "@/src/lib/realtimeToken";

// GET /api/realtime/token — troca a sessão better-auth por um JWT curto que o
// Supabase Realtime aceita (PLANO_JOGO.md §8.1). O cliente usa esse token pra
// assinar o canal battle:<id>; a policy em realtime.messages checa o `sub`.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Sem secret configurado o Realtime simplesmente não liga — o cliente
    // segue no polling de 2s (fail-safe, não fail-broken).
    return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });
  }

  const token = await signRealtimeToken(session.user.id, secret);
  return NextResponse.json({ token, expiresIn: REALTIME_TOKEN_TTL_SECONDS });
}
