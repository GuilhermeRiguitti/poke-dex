-- Fatia A3 — Realtime do duelo (PLANO_JOGO.md §3.3 + §8.1).
--
-- ⚠️ Esta migration NÃO é Prisma de propósito: ela toca o schema `realtime`,
-- que só existe na plataforma Supabase (e no stack local do CLI). Ela vive em
-- supabase/migrations e é aplicada:
--   - local: `prisma db execute --schema prisma/schema.prisma --file <este>`
--            (as tabelas do app precisam existir antes do trigger/função);
--   - prod:  MCP `apply_migration` (mesmo conteúdo).
--
-- Três peças:
--   1. Funções num schema `private` — NÃO em `public`. O PostgREST expõe
--      `public` como RPC (/rest/v1/rpc/...); pôr as funções lá deixava-as
--      chamáveis pela API pública (o advisor acusa: WARN
--      anon/authenticated_security_definer_function_executable). `private` não
--      é exposto → some o buraco, e o Realtime segue chamando por dentro.
--   2. Policy em realtime.messages — a ÚNICA policy do projeto (AGENTS.md).
--      Autoriza participante ↔ topic `battle:<id>` a RECEBER broadcast.
--      "Abrir o Realtime ≠ abrir o PostgREST": as tabelas do app seguem
--      deny-all; a key no browser só destrava o WebSocket.
--   3. Trigger de Broadcast from Database no Battle — payload MÍNIMO
--      {battleId, round, status}. Realtime é SINAL, não DADO: o cliente
--      refaz o GET que passa pelo DTO. NUNCA Postgres Changes (streamaria a
--      linha crua e reabriria o vazamento que o DTO fecha).

create schema if not exists private;
grant usage on schema private to authenticated;

-- ── 1. Checagem de participação (SECURITY DEFINER, em private) ────────────
-- A policy roda como `authenticated`, e BattleParticipant é deny-all (RLS sem
-- policy). SECURITY DEFINER faz a checagem rodar como o DONO da função
-- (postgres, que bypassa RLS) — sem isso a policy nega tudo em silêncio.
create or replace function private.is_battle_participant(topic text, uid text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."BattleParticipant" bp
    where bp."battleId" = split_part(topic, ':', 2)
      and bp."userId" = uid
  );
$$;

revoke all on function private.is_battle_participant(text, text) from public;
grant execute on function private.is_battle_participant(text, text) to authenticated;

-- ── 2. A policy ──────────────────────────────────────────────────────────
-- ⚠️ Gotcha documentado (AGENTS.md): os ids são cuid (TEXTO), não uuid.
-- `auth.uid()` casta pra uuid e NEGA TUDO em silêncio. O `sub` do JWT é lido
-- como texto via request.jwt.claims.
drop policy if exists "battle_participants_can_receive_broadcast" on realtime.messages;
create policy "battle_participants_can_receive_broadcast"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'battle:%'
  and private.is_battle_participant(
    realtime.topic(),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  )
);

-- ── 3. Trigger de broadcast no Battle (função em private) ─────────────────
-- Dispara em QUALQUER update da linha (claim, ação resolvida, fim de jogo).
-- Sinal duplicado não importa: o refetch do cliente é idempotente.
create or replace function private.broadcast_battle_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'battleId', new.id,
      'round',    new.round,
      'status',   new.status
    ),
    'battle_updated',      -- event
    'battle:' || new.id,   -- topic (casa com a policy acima)
    true                   -- private: exige a policy pra receber
  );
  return new;
end;
$$;
revoke all on function private.broadcast_battle_update() from public;

drop trigger if exists battle_broadcast_update on public."Battle";
create trigger battle_broadcast_update
after update on public."Battle"
for each row
execute function private.broadcast_battle_update();

-- Higiene: se uma versão anterior criou as funções em `public`, remove.
drop function if exists public.is_battle_participant(text, text);
drop function if exists public.broadcast_battle_update();