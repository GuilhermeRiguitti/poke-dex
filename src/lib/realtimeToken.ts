import { SignJWT } from "jose";

// Quanto tempo o token do Realtime vale. Curto o bastante pra não virar
// credencial de longa vida, longo o bastante pra cobrir uma partida inteira
// sem o cliente precisar renovar no meio.
export const REALTIME_TOKEN_TTL_SECONDS = 60 * 60;

// Assina o JWT que o Supabase Realtime valida (HS256 com o legacy JWT secret,
// usado como string crua — NÃO é base64-decodado). Claims mínimas:
// - sub:  o id do usuário (cuid — a policy em realtime.messages lê como TEXTO)
// - role: "authenticated" — o role Postgres que a policy autoriza
//
// Não é o token de sessão do better-auth: é um token derivado, só pro
// WebSocket do Realtime. Ele NÃO abre o PostgREST (tabelas do app = deny-all).
export async function signRealtimeToken(
  userId: string,
  secret: string,
  nowMs: number = Date.now()
): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + REALTIME_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
}
