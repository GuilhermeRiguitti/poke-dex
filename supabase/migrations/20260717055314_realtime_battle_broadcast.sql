-- Fatia A3 — Realtime do duelo (PLANO_JOGO.md §3.3 + §8.1).
--
-- ⚠️ Esta migration NÃO é Prisma de propósito: toca o schema `realtime`, que só
-- existe na plataforma Supabase (e no stack local do CLI). É aplicada pelo
-- `supabase db push` (ver .github/workflows/deploy.yml), nunca pelo Prisma.
--
-- Versão inicial: funções em `public`. A migration IRMÃ 20260717055605 endurece
-- isso movendo-as pra um schema `private` (o PostgREST expõe `public` como RPC).
-- As duas juntas = o estado final; ambas rodam em ordem num ambiente novo.

-- ── 1a. Checagem de participação (SECURITY DEFINER) ──────────────────────
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

-- ── 1b. Policy em realtime.messages (sub como TEXTO — cuid, não uuid) ─────
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

-- ── 2. Trigger de broadcast no Battle (payload mínimo — sinal, não dado) ──
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
    'battle_updated',
    'battle:' || new.id,
    true
  );
  return new;
end;
$$;

drop trigger if exists battle_broadcast_update on public."Battle";
create trigger battle_broadcast_update
after update on public."Battle"
for each row
execute function public.broadcast_battle_update();
