# Realtime Broadcast do Supabase — resumo
Pra quê: empurrar um sinal ("a partida X mudou") pros 2 jogadores na hora, pra não depender só do polling. Ele é SINAL, não DADO — o payload é mínimo ({battleId, round, status}) e o cliente reage refazendo o GET que passa pelo DTO. Nunca é autoritativo; quem resolve o turno continua sendo o request de leitura (não há worker no Vercel Hobby).

Efeito prático: com o canal assinado, o polling relaxa de 2s → 20s (rede de segurança); se o canal cair, volta pros 2s.

# Arquivos
supabase/migrations/20260717055314_realtime_battle_broadcast.sql	trigger no Battle + policy em realtime.messages + 2 funções SECURITY DEFINER (versão inicial em public). Não é Prisma (toca o schema realtime)
supabase/migrations/20260717055605_realtime_harden_functions_private_schema.sql	endurece: move as funções pro schema private (fecha os WARN do advisor de RPC). Estado final
src/modules/realtime/domain/signRealtimeToken.ts	assina o JWT curto (HS256) que o Realtime valida — sub=userId, role=authenticated
src/modules/realtime/index.ts	API de servidor do módulo (createRealtimeToken)
src/modules/realtime/ui/supabaseBrowser.ts	cliente do browser, existe só pro WebSocket (singleton, 1 socket/aba)
src/modules/realtime/ui/useRealtimeChannel.ts	hook do canal: assina battle:<id>, no broadcast dispara o refetch
src/app/api/realtime/token/route.ts	troca a sessão better-auth pelo JWT; sem secret → 503 (degrada pro polling)
src/modules/battle/ui/useBattleRoom.ts	usa useRealtimeChannel; controla o ritmo do polling (2s ↔ 20s)
Fluxo em 1 linha
UPDATE Battle → trigger broadcast_battle_update → realtime.send() no topic battle:<id> → policy checa participante ↔ topic → WebSocket entrega o sinal → cliente refaz GET /api/battle/[id] → DTO.

# Ponto-chave de segurança
"Abrir o Realtime ≠ abrir o PostgREST": a publishable key só destrava o socket; as tabelas do app seguem deny-all (RLS sem policy). A única policy do projeto vive em realtime.messages, e lê o sub como texto (ids são cuid, não uuid — auth.uid() quebraria).

# Docs pra olhar
Broadcast (visão geral): https://supabase.com/docs/guides/realtime/broadcast
Broadcast from Database (o trigger realtime.send, que é o que usamos): https://supabase.com/docs/guides/realtime/broadcast#trigger-broadcast-messages-from-your-database
Authorization / RLS em realtime.messages (a policy): https://supabase.com/docs/guides/realtime/authorization
realtime.setAuth() e canal private (JS client): https://supabase.com/docs/reference/javascript/subscribe
Realtime no dev local (CLI): https://supabase.com/docs/guides/local-development
Referência interna do projeto: PLANO_JOGO.md §3.3 + §8.1