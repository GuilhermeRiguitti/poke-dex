-- Endurece a fatia A3: tira as funções do schema `public` (exposto como RPC
-- pelo PostgREST) e põe num schema `private` que a API pública não enxerga.
-- Fecha os 3 WARN do advisor (anon/authenticated podendo chamar via /rest/v1/rpc).
--
-- Espelha o que rodou no prod (ledger supabase_migrations, v20260717055605).
-- Irmã de 20260717055314 (versão inicial em `public`). Estado final = private.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ── checagem de participação (SECURITY DEFINER) → private ─────────────────
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

-- ── policy re-apontada pra função em private ─────────────────────────────
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

-- ── trigger de broadcast → private ───────────────────────────────────────
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
    'battle_updated',
    'battle:' || new.id,
    true
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

-- ── remove as versões antigas do schema público ──────────────────────────
drop function if exists public.is_battle_participant(text, text);
drop function if exists public.broadcast_battle_update();
