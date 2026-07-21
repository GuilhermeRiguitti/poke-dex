@AGENTS.md

# Arquitetura

Sistema organizado em **módulos** com **separação command/query (CQRS "lite")**.
`src/modules/battle/` é a implementação de referência — na dúvida, copie o que
está lá.

> **CQRS aqui é separação de responsabilidade por pasta, não event sourcing.**
> Não existe event store, event bus, read model separado nem eventual
> consistency. Não introduza isso. `command` escreve, `query` lê. Só isso.

## Estrutura de um módulo

```
src/modules/<modulo>/
  index.ts        API pública. SÓ código de servidor.
  domain/         Regras puras. Sem Prisma, sem fetch, sem React.
  queries/        LEITURA. Recebe ids, devolve DTO.
  commands/       ESCRITA. Recebe intenção, aplica no banco.
  ui/             Apresentação. Componentes, hooks, view-model, DTOs.
```

| pasta | pode importar | NÃO pode importar |
|---|---|---|
| `domain/` | só a si mesma | Prisma, `fetch`, React |
| `queries/` | `domain/`, `lib/prisma`, `lib/pokeapi` | React, `commands/` |
| `commands/` | `domain/`, `queries/`, `lib/*` | React |
| `ui/` | `ui/`, tipos de `domain/` | **Prisma, `lib/auth`, `commands/`, `queries/`** |

`ui/` nunca importa nada que toque o banco — se importar, o Prisma vai parar no
bundle do browser.

### `index.ts` é a fronteira

Rotas (`app/api/**`) e pages (`app/**/page.tsx`) importam **só do `index.ts`**,
nunca de `domain/` / `queries/` / `commands/` direto.

**Componentes NÃO entram no `index.ts`.** As pages importam de
`@/src/modules/<mod>/ui/<Componente>` por caminho direto. Se um componente
`"use client"` fosse reexportado pelo barrel, toda rota de API que importa uma
query arrastaria a UI (e as libs pesadas dela) junto.

## Regras que valem ouro (foram aprendidas errando)

### 1. Page é servidor. Sempre.

Nenhum `page.tsx` leva `"use client"`. A page busca os dados no servidor e passa
por prop pro componente cliente. O `"use client"` desce o mais fundo possível na
árvore — idealmente só no componente que tem estado ou evento.

**O sintoma de que você errou:** a page virou servidor mas renderiza um único
componente cliente que é a página inteira. Isso não é refatorar, é mover o
`"use client"` de arquivo. O bundle continua idêntico.

**O ganho real** de tornar a page servidor não é organização — é **matar os
`fetch` de cliente que só existiam porque a page era cliente**. Se depois da
refatoração ainda sobrou um `useEffect` buscando os dados da primeira pintura,
com estado `loading` e um texto "Carregando...", **o trabalho não foi feito**.

### 2. Nunca escreva durante o render de uma page

Render de página **lê**. Escrita é `command`, disparada por rota de API ou
Server Action.

Não é purismo: uma escrita no render pode ser disparada por prerender no build
ou por prefetch, e se ela lançar (ou estourar o tempo da função), o usuário leva
**tela de erro no lugar da página** — não há estado de "carregando" pra segurar.

Por isso o módulo battle tem dois irmãos explícitos:

- `getBattleState()` — resolve o turno (**escreve**, pode bater na PokéAPI). Só rota de API.
- `readBattleState()` — só lê. É o que a page usa.

**Se uma query escreve ou faz I/O de rede, ela não pode ser chamada no render de
uma page.** Crie a versão só-leitura.

### 3. Toda saída pro cliente passa por um DTO

Linha do Prisma **nunca** vai crua pro browser — nem por `NextResponse.json()`,
nem por prop de Server Component.

Escreva um mapper explícito (`queries/toXxxDTO.ts`), campo a campo. Não é
boilerplate: no battle, a linha crua carregava `pendingMoves` — a jogada do
oponente **antes do turno resolver**. Dava pra ler no devtools e trapacear.
Whitelist explícita fecha isso por construção, e um teste trava o buraco:

```ts
expect(JSON.stringify(dto)).not.toContain("pendingMoves");
```

Os DTOs ficam em `ui/types.ts` — são o contrato entre servidor e UI, e como são
`interface`, não pesam no bundle.

### 4. Lógica de apresentação sai do componente

Mapear DTO → o que a tela desenha é **função pura**, mora em `ui/<x>View.ts` e
**tem teste**. Ver `ui/battleView.ts`. Componente é costura, não é onde regra mora.

### 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto

Rodamos em **Vercel Hobby (free) + Supabase (Postgres)**. Não é "deploy na
nuvem", é um **modelo de execução diferente**, e várias coisas que parecem
óbvias em Node são **impossíveis aqui**. Leia esta seção inteira antes de mudar
qualquer regra de execução — a maior parte do que está escrito abaixo foi
aprendida quebrando o jogo.

#### O que NÃO existe (e o que fazer no lugar)

Toda page/rota é uma **função efêmera**: ela acorda com o request, responde, e
**pode ser morta no instante seguinte**. Não há processo vivo entre requests.

| Você vai querer fazer | Por que não dá | O que fazer |
|---|---|---|
| `setInterval` / worker / job em background no servidor | não há processo depois da resposta | o trabalho acontece **dentro de um request** |
| `setTimeout` pra "terminar depois de responder" | a execução morre com a resposta | faça antes de responder, ou não faça |
| WebSocket / SSE / conexão longa | função tem teto de duração; não segura conexão | **polling** do cliente (é o que a batalha faz) |
| `Map`/variável global como cache, fila ou rate-limit | cada invocação pode ser uma instância nova; memória **não sobrevive** | **tabela no banco** (ver `PokeApiCache`, e a fila do matchmaking) |
| escrever em arquivo / `fs` | filesystem é efêmero e read-only | banco, ou `lib/storage` |
| cron pra reparar/limpar estado | **cron no Hobby roda 1x por dia** | não dependa de reparo; ver abaixo |
| `new PrismaClient()` num módulo qualquer | esgota o pool do Postgres | importe **sempre** o `prisma` de `lib/prisma` |

#### Consequência #1: a LEITURA é que empurra a partida (o polling de 2s)

**Não existe worker.** Se ninguém faz request, **nada acontece no servidor** —
nem turno resolve, nem timeout de jogador expira, nem partida encerra.

Por isso a batalha resolve o turno **na leitura**: o cliente faz polling em
`GET /api/battle/[id]/status` (`useBattleRoom.ts`), e é esse request que executa
`resolveTurn()`. O polling **não é "atualizar a tela"** — ele é o **motor do
jogo**. Sem ele a partida congela.

> **Isso NÃO é gambiarra e NÃO é dívida técnica. É a única opção do ambiente.**
> Se você acha que dá pra "melhorar" com um job, um `setInterval` no servidor ou
> uma conexão longa segurada pela lambda: **nada disso existe no Hobby.** Não
> tente. Se um dia sair do Hobby, isso vira uma decisão de arquitetura
> consciente — não uma limpeza de código.

Duas peças **de fora da Vercel** complementam (não substituem) o polling:

- **Supabase Realtime = SINAL, não computação.** O trigger no `Battle` empurra
  `{battleId, round, status}` pro canal `battle:<id>`; o cliente reage refazendo
  o `GET` que passa pelo DTO. Com o canal assinado, o polling **relaxa de 2s pra
  20s** (rede de segurança); qualquer erro no canal devolve os 2s. O push nunca
  executa `resolveTurn` — quem resolve continua sendo o request.
- **`pg_cron` no Supabase = o relógio de backstop** (`resolve-battle-turns`,
  30s): resolve turno vencido de partida que ninguém está olhando. Roda no
  Supabase, não na Vercel — o "worker que não existe no Hobby" mora lá.

O que isso obriga, e você **não pode** quebrar:

- **Todo request de leitura da batalha roda concorrente com o do outro jogador.**
  São 2 jogadores × 1 request a cada 2s, os dois podendo cair em lambdas
  diferentes ao mesmo tempo. Ver regra 6.
- **A resolução do turno é idempotente e disputada**: quem chega primeiro
  resolve, quem perde o claim **não escreve nada** (`resolveTurn.ts`).
- **O tick pula quando a aba está em segundo plano** (`document.hidden`) — cada
  tick é uma invocação, e o plano free tem cota. Não remova essa guarda.
- **O polling para quando a partida acaba** (`status !== "IN_PROGRESS"` →
  `clearInterval`). Polling eterno queima cota à toa.
- Não baixe o intervalo "pra ficar mais responsivo": 2s × 2 jogadores já é
  1 invocação por segundo por partida.
- **Não existe nada pra reparar um estado corrompido depois.** Se um turno
  gravar lixo, o lixo fica. Não há cron de faxina pra salvar você.

**Corolário: o tempo só passa quando alguém olha.** Se nenhum request chega,
nenhum relógio anda. Duas coisas seguem daí, e as duas já morderam:

- **Timeout tem que ser retroativo.** Não conte "+1 falta por resolução": conte
  **quantas janelas de `TURN_TIMEOUT_MS` venceram** desde `turnStartedAt`
  (`expiredTurnWindows`). O claim reseta `turnStartedAt` pra agora, então contar
  de 1 em 1 fazia quem voltasse depois de uma hora esperar 3×90s pra ganhar de
  um oponente que já tinha sumido.
- **Faxina é no próximo request, nunca num cron.** Se os dois jogadores fecham a
  aba, a partida fica `IN_PROGRESS` pra sempre (ninguém pollando, nada
  resolvendo) — e o `enqueueBattle` devolvia essa partida zumbi em vez de
  enfileirar, prendendo os **dois** fora do matchmaking. A cura não é um job: é
  o **próprio request do jogador encerrar a zumbi** antes de decidir
  (`enqueueBattle` chama `tryResolveTurn`). **Quem chega é o faxineiro.**

#### Consequência #2: escrita multi-passo é tudo-ou-nada

A função pode morrer **no meio** (timeout, cold start ruim, deploy). Uma
sequência de escritas soltas deixa o dado quebrado **pra sempre** — e, de novo,
não há worker pra consertar.

- **Toda escrita multi-passo vai numa `$transaction` interativa.**
- Em `commands/resolveTurn.ts`: o claim (trava otimista) é a **primeira operação
  dentro da transação**, e o **I/O lento (rede/PokéAPI) fica fora e antes dela** —
  transação aberta esperando rede é transação que estoura e segura conexão do
  pool.
- **Suba o `timeout` da transação.** O default do Prisma (5s) é apertado pra
  lambda fria; `resolveTurn` usa `{ timeout: 15_000, maxWait: 5_000 }`.

#### Consequência #3: o banco é Supabase atrás de PgBouncer

- `DATABASE_URL` = conexão **pooled** (PgBouncer, :6543). É a do runtime.
- `DIRECT_URL` = conexão **direta** (:5432), só pra `prisma migrate` — o Migrate
  não roda pelo pooler em modo transaction.
- Conexão é **recurso escasso**: cada lambda que acorda pode abrir a sua. Nunca
  instancie `PrismaClient` fora de `lib/prisma`, e não segure transação aberta
  esperando I/O.

#### Consequência #4: cache tem duas camadas, e uma delas é tabela

O cache de `fetch` do Next morre a cada deploy. Por isso existe `PokeApiCache`
(tabela): o que o jogador **já capturou** precisa sobreviver ao deploy, e a fair
use policy da PokéAPI pede cache local de verdade. E porque cache **grava**,
`lib/pokeapiCache.ts` é dividido: `readCached*` (só lê, seguro em render) vs
`fetchAndCache*` (grava, **só em command**) — que é a regra 2 aplicada.

#### Consequência #5: a API PostgREST do Supabase é pública — RLS obrigatória

O Supabase publica uma **API REST automática (PostgREST)** acessível com a `anon`
key + URL do projeto. **Tabela sem RLS é CRUD aberto pra qualquer um** por essa
API — dava pra ler e apagar `User`/`Account` de fora. A migration
`20260714010000_enable_rls_all_tables` ligou RLS nas 16 tabelas **sem policies**.

Por que deny-all não afeta o runtime (e por que é seguro):

- O app fala com o banco **só via Prisma**, conectado como `postgres` — que é
  **dono das tabelas** (FORCE off → o dono ignora RLS) **e** tem `BYPASSRLS`.
  Bypass por dois caminhos. `anon`/`authenticated` não têm nenhum → bloqueados.
  Confere: `SELECT rolname, rolbypassrls FROM pg_roles;` + dono em `pg_class`.
- **O `@supabase/supabase-js` no código é SÓ o WebSocket do Realtime**
  (`modules/realtime/ui/supabaseBrowser.ts`, com a `publishable` key). Nenhum
  código lê tabela via PostgREST — a API pública que a RLS fecha continua fora
  do jogo.

O que te obriga daqui pra frente (a regra completa está no `AGENTS.md`):

- **Tabela nova nasce ABERTA.** O Prisma não gerencia RLS; a migration que dá
  `CREATE TABLE` tem que dar `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` junto,
  senão o buraco reabre só pra ela.
- **Nunca `FORCE ROW LEVEL SECURITY`.** FORCE sujeita o próprio `postgres` à RLS →
  sem policy, deny-all no runtime = **app fora do ar**. É a "melhoria" que derruba.
- Depois de mexer no schema, rode o advisor de segurança do Supabase — o alerta
  `rls_disabled_in_public` (ERROR) acusa a tabela esquecida.

> **Fronteira do Realtime (implementada — PLANO_JOGO.md §8.1) — não confunda com
> o acima.** O Realtime do duelo **exige uma policy** — mas em
> `realtime.messages` (schema `realtime`), **não** nas tabelas do app (que seguem
> deny-all). Ela vive em `supabase/migrations/20260717055605_realtime_harden_functions_private_schema.sql`
> (par com a `…055314_realtime_battle_broadcast.sql`; fora das migrations Prisma de propósito: o schema `realtime` só existe na
> plataforma). Abrir o WebSocket com a `publishable` key **não** reabre o
> PostgREST: a key não lê `Battle`/`User` via REST. **"Abrir o Realtime ≠ abrir o
> PostgREST."** A policy lê o `sub` do JWT como **texto** (ids são cuid, não uuid)
> — `auth.uid()` da doc faz cast pra uuid e nega tudo em silêncio. E a checagem
> de participação passa por uma função **`SECURITY DEFINER`** — a policy roda
> como `authenticated`, que é deny-all nas tabelas do app; sem isso ela nega tudo
> em silêncio. É a ÚNICA policy do projeto; a regra "sem policy" continua valendo
> pra todo o schema `public`.

### 6. Concorrência: assuma duas lambdas ao mesmo tempo

Os dois jogadores fazem polling a cada 2s. Todo `command` roda concorrente com
ele mesmo.

- `findFirst` → `create` **é corrida.** Use `upsert` com constraint `@unique`.
- Sem `@unique` (ex: `Deck.userId`, que **ainda não tem**), no mínimo use um
  `orderBy` determinístico pra todo mundo convergir na mesma linha.
- Trava otimista: `updateMany({ where: { id, valor_esperado } })` e cheque o
  `count`. `count === 0` significa que você perdeu a corrida — **não escreva nada**.

## Onde as coisas moram

- `src/lib/` — infra **compartilhada** entre módulos: `prisma`, `auth`,
  `pokeapi`, `storage`, `typeColors`. Não é módulo, não tem regra de negócio.
- `src/components/` — só o que é **genuinamente global** (`NavBar`, `TypeBadge`,
  `icons`). Componente que serve um módulo só mora no `ui/` **dele**.
- `src/modules/<mod>/` — a feature inteira: regra, leitura, escrita e tela.

## Verificação

`npx tsc --noEmit` · `npx vitest run` · `npx eslint` · `npx next build`

O que **precisa** de teste:
- `domain/` — é puro, não tem desculpa.
- `ui/<x>View.ts` — a regra de apresentação.
- o mapper de DTO — provando que não vaza o que não pode.
- `command` concorrente — provando que quem perde o claim **não escreve nada**.

**Teste que passa não prova nada se não for capaz de falhar.** Quebre o código
de propósito e confirme que o teste acusa.

## Dívida conhecida

- `Deck.userId` não é `@unique` → requests concorrentes criam decks duplicados.
  Mitigado com `orderBy: createdAt asc` em quem lê; a cura é migration + `upsert`.
- Não existe `error.tsx` — qualquer throw em Server Component cai na tela de erro
  padrão do Next.

**O que NÃO é dívida** (e por isso não está na lista acima): o **polling de 2s da
batalha** e o **turno resolvido na leitura**. Isso é a regra 5 — a consequência
direta de não existir worker no Vercel Hobby. Não "conserte".
