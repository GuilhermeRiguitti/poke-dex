import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase do BROWSER — existe SÓ pro Realtime (WebSocket).
//
// A publishable key é pública por definição e NÃO abre nada além do socket:
// as tabelas do app têm RLS deny-all, então PostgREST continua fechado
// ("abrir o Realtime ≠ abrir o PostgREST", AGENTS.md). A autorização real do
// canal vem do JWT curto de /api/realtime/token via realtime.setAuth().
//
// Singleton de módulo: 1 socket por aba, não 1 por componente montado.
let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Sem env → sem Realtime; quem consome trata null caindo pro polling.
  if (!url || !key) return null;

  if (!client) {
    client = createClient(url, key, {
      // Não usamos Supabase Auth — nada de sessão em localStorage.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
