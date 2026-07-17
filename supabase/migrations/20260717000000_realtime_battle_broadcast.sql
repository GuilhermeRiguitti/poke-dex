-- Fatia A3 — Realtime do duelo (PLANO_JOGO.md §3.3 + §8.1).
--
-- ⚠️ Esta migration NÃO é Prisma de propósito: ela toca o schema `realtime`,
-- que só existe na plataforma Supabase (e no stack local do CLI). Ela vive em
-- supabase/migrations e é aplicada:
--   - local: `prisma db execute --file` DEPOIS do `prisma migrate deploy`
--            (as tabelas do app precisam existir antes do trigger/função);
--   - prod:  MCP `apply_migration` (mesmo conteúdo).
--
-- Duas peças:
--   1. Policy em realtime.messages — a ÚNICA policy do projeto (AGENTS.md).
--      Autoriza participante ↔ topic `battle:<id>` a RECEBER broadcast.
--      "Abrir o Realtime ≠ abrir o PostgREST": as tabelas do app seguem
--      deny-all; a key no browser só destrava o WebSocket.
--   2. Trigger de Broadcast from Database no Battle — payload MÍNIMO
--      {battleId, round, status}. Realtime é SINAL, não DADO: o cliente
--      refaz o GET que passa pelo DTO. NUNCA Postgres Changes (streamaria a
--      linha crua e reabriria o vazamento que o DTO fecha).

-- ── 1a. Checagem de participação ─────────────────────────────────────────
-- A policy roda como `authenticated`, e BattleParticipant é deny-all (RLS sem
-- policy). SECURITY DEFINER faz a checagem rodar como o DONO da função
-- (postgres, que bypassa RLS) — sem isso a policy nega tudo em silêncio.
create or replace function public.is_battle_participant(topic text, uid text)
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

revoke all on function public.is_battle_participant(text, text) from public;
grant execute on function public.is_battle_participant(text, text) to authenticated;

-- ── 1b. A policy ─────────────────────────────────────────────────────────
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
  and public.is_battle_participant(
    realtime.topic(),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  )
);

-- ── 2. Trigger de broadcast no Battle ────────────────────────────────────
-- Dispara em QUALQUER update da linha (claim, ação resolvida, fim de jogo).
-- Sinal duplicado não importa: o refetch do cliente é idempotente.
create or replace function public.broadcast_battle_update()
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

drop trigger if exists battle_broadcast_update on public."Battle";
create trigger battle_broadcast_update
after update on public."Battle"
for each row
execute function public.broadcast_battle_update();
