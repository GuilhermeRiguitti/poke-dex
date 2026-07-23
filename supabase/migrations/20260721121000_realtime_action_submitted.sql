-- Realtime do turno SIMULTÂNEO: avisar que o oponente trancou a carta.
--
-- ⚠️ Não é migration Prisma de propósito (schema `realtime` só existe na
-- plataforma). Par das 20260717055314/…055605, que criaram a policy em
-- realtime.messages e o trigger de UPDATE no Battle.
--
-- POR QUE UM TRIGGER NOVO: o trigger existente dispara em UPDATE do `Battle`,
-- que só acontece quando o turno RESOLVE. No simultâneo, o oponente escolher a
-- carta não toca no `Battle` — insere uma linha em `BattleAction`. Sem este
-- trigger, "oponente pronto" só apareceria no próximo poll: até 20s de atraso
-- justamente com o canal de pé (o polling relaxa quando o Realtime funciona).
--
-- O PAYLOAD É MÍNIMO E ISSO É REGRA, NÃO ECONOMIA: vai `userId` e `round`,
-- **nunca** o `cardSlot`. A carta escolhida é segredo até o turno resolver — um
-- broadcast com o cardSlot entregaria a jogada do adversário no WebSocket, que
-- é exatamente o vazamento que o DTO fecha do outro lado (CLAUDE.md regra 3).
-- O cliente ignora o payload de qualquer forma e refaz o GET que passa pelo DTO.
--
-- A policy de leitura já existente cobre este evento: ela autoriza por TOPIC
-- (battle:<id> ↔ participante), não por evento.

create or replace function private.broadcast_battle_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'battleId', new."battleId",
      'userId',   new."userId",
      'round',    new."round"
    ),
    'battle_action_submitted',
    'battle:' || new."battleId",
    true
  );
  return new;
end;
$$;

revoke all on function private.broadcast_battle_action() from public;

drop trigger if exists battle_action_broadcast_insert on public."BattleAction";
create trigger battle_action_broadcast_insert
after insert on public."BattleAction"
for each row
execute function private.broadcast_battle_action();
