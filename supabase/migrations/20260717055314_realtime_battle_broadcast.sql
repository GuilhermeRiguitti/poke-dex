-- Fatia A3 — Realtime do duelo (PLANO_JOGO.md §3.3 + §8.1).
--
-- ⚠️ Esta migration NÃO é Prisma de propósito: toca o schema `realtime`, que só
-- existe na plataforma Supabase (e no stack local do CLI). É aplicada pelo
-- `supabase db push` (ver .github/workflows/deploy.yml), nunca pelo Prisma.
--
-- ⚠️ O conteúdo aqui NÃO é o que rodou no prod. O que rodou criava as funções em
-- `public`, e a migration irmã 20260717055605 as movia pra `private`. O problema
-- desse par: num ambiente novo, se o push aplicasse esta e falhasse na irmã, o
-- banco ficava com as funções expostas como RPC do PostgREST (os 3 WARN do
-- advisor). Reescrita pra já criar em `private` — assim qualquer ponto de parada
-- é um estado seguro. No prod isso é invisível: a versão já está no ledger
-- `supabase_migrations` e o `db push` nunca reaplica o que já rodou.
--
-- A irmã 20260717055605 continua necessária (ela é quem está no ledger do prod, e
-- é quem derrubou as funções de `public` lá). Depois desta, ela vira reforço
-- idempotente. Estado final das duas, em qualquer ordem de parada: `private`.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ── 1a. Checagem de participação (SECURITY DEFINER) ──────────────────────
-- SECURITY DEFINER é obrigatório: a policy roda como `authenticated`, que é
-- deny-all nas tabelas do app — sem isso o EXISTS volta vazio sempre, em silêncio.
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

-- ── 1b. Policy em realtime.messages (sub como TEXTO — cuid, não uuid) ─────
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

-- ── 2. Trigger de broadcast no Battle (payload mínimo — sinal, não dado) ──
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
