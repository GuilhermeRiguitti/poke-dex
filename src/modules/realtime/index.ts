// API pública do module realtime — a rota app/api/realtime/token só deve
// importar daqui, nunca de domain/ direto.
//
// Só entra aqui código de SERVIDOR. O cliente do WebSocket e o hook de
// assinatura ficam em ui/ e são importados por caminho direto (ex.:
// @/src/modules/realtime/ui/useRealtimeChannel) — reexportá-los deste barrel
// arrastaria @supabase/supabase-js pra toda rota que importa createRealtimeToken.
//
// Este módulo NÃO toca o banco: não há queries/ nem commands/. Emitir o token é
// ler o secret do ambiente e delegar a assinatura pura pro domain/ — a fronteira
// de servidor é fina, então mora aqui mesmo.

import { signRealtimeToken, REALTIME_TOKEN_TTL_SECONDS } from "./domain/signRealtimeToken";

export { REALTIME_TOKEN_TTL_SECONDS };

export interface RealtimeToken {
  token: string;
  expiresIn: number;
}

// Troca um userId autenticado por um JWT curto que o Supabase Realtime aceita.
// Devolve null quando o secret não está configurado — o chamador traduz isso
// pra 503 e o cliente segue no polling (fail-safe, não fail-broken).
export async function createRealtimeToken(userId: string): Promise<RealtimeToken | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;

  const token = await signRealtimeToken(userId, secret);
  return { token, expiresIn: REALTIME_TOKEN_TTL_SECONDS };
}
