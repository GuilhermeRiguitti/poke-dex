# Refatoração do turno de batalha — proposta (Supabase-only)

> **Status: PROPOSTA, não implementado.** A batalha hoje roda como está descrito
> no `CLAUDE.md` (regra 5): turno resolvido na leitura, polling de 2s do cliente.
> Isso **não é dívida** — é a única opção do Vercel Hobby *sem* mais nenhuma
> peça de infra. Este documento descreve a peça que muda esse quadro **usando só
> Supabase**, e por que ela é uma evolução de verdade — não um "conserto" do que
> o CLAUDE.md manda não consertar.

## O que trava hoje, em uma frase

**O cliente é o motor do jogo.** `resolveTurn()` só roda quando um `GET
/api/battle/[id]/status` chega, e esse GET é o polling de 2s do browser
(`useBattleRoom.ts`). Consequência literal do CLAUDE.md: *"o tempo só passa
quando alguém olha."* Disso saem três problemas reais, não estéticos:

- **Integridade.** Se os dois fecham a aba, ninguém resolve nada: a partida
  vira zumbi e fica `IN_PROGRESS` pra sempre. Toda a lógica de timeout
  retroativo (`expiredTurnWindows`) e de faxina no `enqueueBattle` existe só
  pra compensar a ausência de um relógio do servidor.
- **Segurança.** Quem dispara a resolução é o browser do jogador. O ritmo do
  jogo depende de um agente não-confiável continuar batendo na rota. Não é
  exploração hoje (o claim otimista protege a escrita), mas a *cadência* do
  jogo estar na mão do cliente é uma fraqueza de projeto.
- **Performance / cota.** 2s × 2 jogadores = ~1 invocação/segundo por partida
  na Vercel, só pra descobrir que "nada mudou" na maioria dos ticks. E a
  latência de ver o turno do oponente é de até 2s (o intervalo do poll).

## A virada: um relógio de servidor que é do Supabase, não da Vercel

A limitação de "cron 1x/dia" é da **Vercel Hobby**, não do banco. O **Supabase
tem `pg_cron` no plano free**, rodando de **1 a 59 segundos**
([docs](https://supabase.com/docs/guides/cron)). Isso é exatamente o worker que
o CLAUDE.md diz não existir — e ele existe **dentro da infra que já pagamos
(R$0)**, sem sair da Vercel Hobby pro resto do app.

Duas peças, as duas do Supabase:

### 1. `pg_cron` + `pg_net` → resolve turnos vencidos (o motor sai do cliente)

Um job de `pg_cron` roda a cada N segundos e, via `pg_net`, faz um `POST` numa
rota nova e protegida do nosso app — ex. `POST /api/cron/resolve-turns` com um
header secreto (`CRON_SECRET`). Essa rota varre as partidas `IN_PROGRESS` com
turno vencido e chama o **mesmo `resolveIfDue`/`resolveTurn` que já temos**. O
motor de batalha continua num lugar só (nosso repo, TypeScript) — não é portado
pra Edge Function, não é duplicado.

O que isso muda, ponto a ponto:

- **Integridade:** o turno resolve mesmo com as duas abas fechadas. Acaba a
  partida zumbi. `expiredTurnWindows` (a contagem retroativa) e a faxina no
  `enqueueBattle` deixam de ser *necessárias* — viram, no máximo, um cinto de
  segurança. O timeout passa a ser um relógio de verdade.
- **Segurança:** a resolução é disparada por um agente **confiável** (o cron,
  autenticado por segredo), não pelo browser do jogador. O cliente deixa de ser
  o motor. O claim otimista de `resolveTurn` continua valendo — agora ele
  protege contra "dois ticks do cron se cruzando", que é uma corrida controlada,
  não contra o cliente.
- **Recomendações do Supabase a respeitar:** no máximo ~8 jobs concorrentes e
  cada job < 10 min. Um job só, curto (varre e dispara HTTP), cabe folgado.

### 2. Supabase Realtime → o cliente para de pollar (push no lugar de pull)

Com o turno resolvendo no servidor, o cliente não precisa mais *perguntar* de 2
em 2s — ele **assina** as mudanças. Supabase Realtime
([docs](https://supabase.com/docs/guides/realtime)) tem o que serve aqui:

- **Postgres Changes**: o cliente escuta alterações em `Battle` /
  `BattleTurnLog` da sua partida. Quando o cron grava o turno resolvido, os dois
  browsers recebem o push — sem polling, e a latência cai de "até 2s" pra
  ~instantâneo.
- **Broadcast / Presence** (fase posterior): "oponente está online / digitando /
  saiu", e eventos de partida de baixa latência sem passar pelo banco.

**Limites do plano free** ([limits](https://supabase.com/docs/guides/realtime/limits)),
e por que cabem no nosso tamanho:

- **200 conexões simultâneas.** Cada jogador numa batalha = 1 conexão. Teto de
  ~100 partidas simultâneas antes de precisar de plano pago. Muito acima do
  nosso uso hoje.
- **2 milhões de mensagens/mês.** Uma mensagem por mudança de estado empurrada.
  Comparado a ~1 invocação/segundo/partida de polling hoje, é **menos** tráfego,
  não mais.

## Saldo: por que isso é evolução, não "conserto proibido"

O CLAUDE.md proíbe trocar o polling por WebSocket/job/cron **enquanto a única
infra for a Vercel Hobby** — porque lá nada disso existe. Este plano **não viola
isso**: ele adiciona uma peça de infra nova (Supabase `pg_cron` + Realtime, que
já temos no banco), e nesse novo mundo a decisão deixa de ser gambiarra e passa
a ser arquitetura consciente — exatamente a condição que o próprio CLAUDE.md
coloca ("Se um dia sair do Hobby, isso vira uma decisão de arquitetura
consciente"). Aqui não saímos do Hobby na Vercel; trouxemos o worker pelo lado
do banco.

| eixo | hoje (polling) | com pg_cron + Realtime |
|---|---|---|
| quem resolve o turno | browser do jogador (não-confiável) | cron do Supabase (confiável) |
| tempo passa sem ninguém olhando? | não → partida zumbi | sim |
| latência pra ver o turno | até 2s | ~instantâneo (push) |
| invocações Vercel | ~1/s por partida | só quando há turno a resolver |
| timeout retroativo / faxina | **necessários** | viram cinto de segurança |

## Custo da migração (o que precisa ser feito)

1. **Migration / config no Supabase:** habilitar `pg_cron` e `pg_net`; criar o
   job que faz `POST` na rota de resolução. Guardar `CRON_SECRET`.
2. **Rota nova `POST /api/cron/resolve-turns`:** casca fina, autentica pelo
   segredo, varre `IN_PROGRESS` com turno vencido, chama `tryResolveTurn` por
   partida. É a mesma lógica de `resolveIfDue` — reaproveitada, não reescrita.
3. **Cliente:** trocar o `setInterval` de 2s do `useBattleRoom.ts` por uma
   assinatura Realtime (Postgres Changes na partida). Manter um fallback de
   polling lento (ex. 15s) caso a conexão Realtime caia — cinto de segurança.
4. **Guardas que hoje compensam a falta de worker** (`expiredTurnWindows`,
   faxina no `enqueueBattle`): **não remover na mesma PR.** Elas passam a ser
   redundância barata; tirar é um passo posterior, com a nova via já provada em
   produção.

## O que NÃO fazer

- **Não** portar o motor de batalha (`domain/engine.ts`) pra uma Edge Function
  em Deno. O motor fica num lugar só (nosso repo). O cron só *dispara* a rota
  que já sabe resolver.
- **Não** usar Realtime como se fosse o worker. Realtime **empurra** mudança pro
  cliente; ele **não executa** `resolveTurn`. Quem executa é a rota chamada pelo
  `pg_cron`. Confundir os dois é o erro clássico aqui.
- **Não** adicionar Firebase. Já rodamos Supabase; um segundo backend parte o
  estado e a auth em dois lugares, sem ganho.
