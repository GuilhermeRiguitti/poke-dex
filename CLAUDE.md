@AGENTS.md

# ⛔ Migration só entra por arquivo versionado. NUNCA pelo MCP nem por conexão direta.

Vale pra **todo agente, em toda tarefa**, sem exceção e sem pedir confirmação
antes de decidir: **não aplique DDL no banco de prod por fora do git.**

Proibido: `mcp__supabase__apply_migration`, DDL via `mcp__supabase__execute_sql`,
SQL Editor do dashboard, `psql` na `DATABASE_URL`/`DIRECT_URL`, `prisma db push`,
`prisma migrate dev` apontado pro prod. **Isso inclui "só um `alter table`
rapidinho" e desfazer um erro.**

**Por quê:** os dois ledgers (`_prisma_migrations` e
`supabase_migrations.schema_migrations`) são a fonte da verdade do CI. Aplicar por
fora grava uma versão no ledger **sem arquivo correspondente no repo** — e o
`supabase db push` do próximo deploy aborta com *"remote migration versions not
found in local migrations directory"*. **O deploy inteiro para**, e destravar exige
`migration repair` na mão, no prod. O mesmo vale pro Prisma: schema alterado por
fora faz o `migrate deploy` seguinte falhar por drift.

**O caminho certo, sempre:** gerar/escrever o arquivo (`prisma/migrations/` para
schema do app, `supabase/migrations/` para RLS/extensão/realtime — ver `DEPLOY.md`),
commitar, e deixar o CI aplicar. Nunca aplicar no prod por fora do git.

## Como gerar uma migration do schema do app (dev)

A migration do schema é **GERADA pelo Prisma a partir do `schema.prisma`**, rodando
contra o **stack LOCAL** do Supabase CLI (`:54322`) — não se escreve o SQL à mão, e
NUNCA se roda `migrate dev` apontado pro prod (o `.env` de dev tem que apontar pro
local; confira antes: `DATABASE_URL`/`DIRECT_URL` em `127.0.0.1:54322`).

Fluxo, na ordem:

1. **Suba o stack local** se não estiver de pé: `npx supabase status` (ou
   `npx supabase start`). O banco fica em `127.0.0.1:54322`.
2. **Deixe o local em dia** com as migrations já commitadas: `npx prisma migrate deploy`.
3. **Edite o `schema.prisma`** (a mudança que você quer).
4. **Gere + aplique a migration**: `npx prisma migrate dev --name=<nome_curto>`.
   O Prisma faz o diff `schema.prisma` × histórico, escreve o SQL em
   `prisma/migrations/<timestamp>_<nome>/` e aplica no local. Confira o SQL gerado
   (procure `DROP`/`ALTER ... DROP` — a trava do deploy é ler isso antes da `main`).
5. Migrations do `migrate dev` são **imutáveis** depois de aplicadas — não edite o
   `.sql` (quebra o checksum). O "porquê" mora no comentário do `schema.prisma`.
6. Rode a verificação (`tsc`·`vitest`·`eslint`·`next build`) e **commite** o
   `schema.prisma` + a pasta da migration juntos. O CI aplica no prod.

Migration hand-written só pra `supabase/migrations/` (RLS/realtime) — o schema
`realtime` não existe no Prisma. As de schema do app são sempre geradas.

**O MCP do Supabase deste ambiente aponta pro PROD.** Desde 2026-08-13 ele NÃO
é mais só leitura: além de `list_tables`,
`list_migrations`, `get_advisors`, `get_logs` e `SELECT`, o `execute_sql`
escreve — pra o que é **operação**, não schema: reagendar `cron.job`, conferir
`net._http_response`, corrigir uma linha de dado.

**O que continua proibido é exatamente o que está no topo desta seção, e o
motivo não mudou nem um pouco:** nada de `apply_migration`, nada de DDL por
`execute_sql`, nada de `CREATE`/`ALTER`/`DROP TABLE`. Poder escrever não é
permissão pra alterar schema — os dois ledgers seguem sendo a fonte da verdade
do CI, e um `alter table` "rapidinho" por aqui continua parando o deploy
inteiro. Schema entra por arquivo versionado. Sempre.

Regra prática pra decidir: **se o comando muda a FORMA do banco, é migration e
não passa aqui. Se muda o ESTADO (agendamento, dado, faxina), pode.** Na dúvida,
pergunte ao dono antes — escrita em prod não se desfaz com ctrl+Z.

# Terminou a tarefa? Atualize os docs dela.

Antes de dar uma tarefa por pronta, procure os documentos, TODOs e planos que
falam dela (README, `DEPLOY.md`, `TODO.md`) e **atualize cada um pra refletir o que foi feito**: marque o TODO
como concluído, corrija o que mudou de comportamento, registre a decisão nova.
Isso faz parte da tarefa, não é passo extra — um doc que descreve o mundo antigo
manda o próximo agente pro caminho errado.

# O jogo: as regras moram no README

**As regras do jogo estão no `README.md`** — turno simultâneo, nível libera golpe,
as fórmulas de atributo e de XP, evolução por nível. Leia lá antes de mexer em
qualquer coisa que mude o jogo. Aqui fica só o que o **código** é obrigado a
respeitar por causa delas. E apos mexer se na alteracao 
for solicitado alteracao de alguma regra atualize o README

## O que o código é obrigado a fazer

- **Status é público; a contagem do sono não.** O DTO leva status, confusão,
  semente e os estágios dos DOIS lados de propósito — na série você enxerga que
  o oponente está queimado, e sem isso não dá pra jogar contra status. O que
  fica fora é `sleepTurns`: entregar viraria "espero exatamente 2 turnos".
  A whitelist é `toConditionsDTO`.
- **A jogada é segredo até o turno resolver.** Uma ação por jogador por round
  (`@@unique[battleId, round, userId]`), contagem de faltas **simétrica**, e o
  `cardSlot` nunca sai no DTO nem no payload do Realtime (regra 3 da arquitetura).
  O 2º trigger `battle_action_submitted` existe porque escolher a carta não mexe no
  `Battle`. Ordem do turno em `domain/turnOrder.ts`, dano em `domain/damage.ts`.

`parei aqui`
- **A trava do learnset é do SERVIDOR, não da UI.** `PUT /api/deck` é público:
  `saveDeck` recusa pokémon sem NENHUMA carta liberada (iria a campo sem ação
  possível e o `buildDuelSnapshot` lançaria no matchmaking), e a batalha filtra
  pelo nível **congelado no snapshot** — subir de nível em outra aba não destrava
  carta na partida em andamento.
- **Só `level-up` conta como liberação por nível**, e é **um version group por
  espécie** (`VERSION_GROUP_PREFERENCE`, o mais recente em que ela aprende algo por
  level-up). `machine` (TM), `egg` e `tutor` ficam no espelho e viram carta só com
  uma linha em `UserPokemonMove`; a união "destravado ∪ concedido" é pura
  (`learnset.mergePlayableMoveIds`) e lida por `getUnlockedMoveIds`.
- **`UserPokemon.xp` e `level` são escritos SEMPRE juntos**, só pelos helpers
  `progressionFromXp` / `progressionFromLevel` (regra 3.1).
- **A checagem de evolução roda em TODA aplicação de XP**, não só quando o nível
  sobe. Um pokémon que cruzasse o gatilho com a espécie-alvo ainda fora do espelho
  ficava preso na forma antiga **pra sempre** — no `MAX_LEVEL` não há mais nível a
  ganhar, e não há worker pra consertar depois. Só `level-up` com `min_level` vira
  aresta (`Pokemon.evolvesToApiId`/`evolvesToLevel`, gravadas pelo `syncPokedex`);
  pedra, troca e amizade ficam null.
- **Evolução não toca no snapshot.** `grantXp` muda o `pokemonId` do `UserPokemon`
  (coleção, em cadeia), nunca o `BattlePokemon` congelado: vale da PRÓXIMA partida.
- **O que o golpe faz além de bater é DADO da API, não regra no banco.**
  `Move.effect` é espelho CRU do `meta`/`stat_changes` do `/move`
  (`NormalizedMoveEffect`, em `lib/pokeapi.ts`). Quem decide o que aquilo
  significa — quais status o jogo suporta, que "chance 0" quer dizer "sempre",
  de quem é o atributo que sobe — é `battle/domain/moveEffect.ts`, na leitura.
  Guardar traduzido congelaria a regra dentro de ~350 linhas do banco: mudar de
  ideia obrigaria a re-sincronizar tudo contra a PokéAPI. Efeito que o jogo não
  modela vira `null`, e a carta aparece como "sem efeito" — **nunca** finja que
  fez algo.
- **Status e stat stage moram em `BattlePokemon.conditions`** (Json anulável) e
  a regra em `battle/domain/conditions.ts`. Três coisas não podem mudar sem
  quebrar o jogo: o slot não-volátil é **um só** (queimadura/veneno/paralisia/
  sono/congelamento não empilham); **a troca limpa estágio, confusão, semente e
  recuo, e NÃO limpa o não-volátil** (é essa assimetria que faz trocar ser
  escolha e não fuga); e o **portão de condições roda ANTES do PP** — dormir não
  gasta carta. `null` na coluna é estado limpo (`normalizeConditions`), o que
  deixou a migration ser aditiva, sem backfill e sem trava no deploy.
- **O rng só é tocado por quem tem motivo.** Pokémon sem condição e carta sem
  efeito passam pelo turno inteiro sem sortear nada — é o que mantém os testes
  do motor determinísticos com `throwingRng()`. Se um efeito novo rolar dado
  incondicionalmente, ele quebra a suíte inteira, e isso é proposital.
- **Quem calcula o prêmio é a batalha** (`battle/commands/awardBattleXp.ts`); quem
  escreve é o `pokemon` (`pokemon/commands/grantXp.ts`). O `grantXp` recebe o `tx`
  em vez de abrir a própria transação — roda dentro da que encerra a partida, onde
  o claim otimista garante que só uma lambda chega ali. Fora dela, pagaria XP
  duplicado a cada polling de 2s.
- **Tudo que se paga no fim da partida mora DENTRO daquele mesmo claim**, e recebe
  o `tx` em vez de abrir transação própria. Hoje são dois: `grantXp` e
  `trackBattleFinished` (quests). A regra vale pro próximo também — fora do claim,
  o polling de 2s dos dois jogadores paga a recompensa a cada leitura, e o jogador
  completa "vença 3 batalhas" só deixando a aba aberta.
- **O par (xp, level) só é consistente DENTRO de uma curva.** ("Curva" = quanto XP
  cada nível custa; `growth_rate` da PokéAPI, seis possíveis.) Cada espécie tem a
  sua (`Pokemon.growthRate`), então quem grava nível de nascimento precisa informar
  a curva da espécie — o `openPack` informa, porque a forma evoluída nasce em nível
  alto. Com a curva errada, o `level` é recalculado a partir do `xp` na primeira
  batalha e a carta **perde níveis sozinha**. O parâmetro é opcional e cai em
  `medium-fast` (a curva única de antes), então esquecer dele não quebra o
  build — quebra o dado.
- **Energia é do JOGADOR (`BattleParticipant.energy`), não do pokémon.** No
  pokémon, o `clearVolatiles` da troca limparia junto e trocar viraria recarga. E a
  tabela de custo (`battle/domain/energy.ts`) **não vai pro banco**: é a alavanca
  de balanceamento, e guardá-la em coluna obrigaria a re-sincronizar o espelho a
  cada ajuste. O DTO leva o custo já calculado.
- **Todo limitador de jogada precisa de uma saída.** PP e energia têm a mesma
  forma: carta inválida com OUTRA disponível vira hesitação; NENHUMA disponível cai
  em STRUGGLE. Sem o segundo ramo, ficar sem recurso é ficar sem ação — e ficar sem
  ação três vezes é derrota por abandono. Vale pro próximo limitador que entrar.
- **Presença é estado de SERVIDOR (`BattleParticipant.lastSeenAt`), nunca o evento
  `leave` do WebSocket.** Declarar vitória é escrita, e o cliente não é autoridade;
  quem fecha a aba não envia nada; e o backstop roda no `pg_cron`, dentro do banco,
  sem WebSocket nenhum. O heartbeat pega carona no `GET /status` — **depois** do
  `isParticipant` e **antes** do `resolveIfDue`. E o tick do polling **não pula com
  a aba escondida**: pular faria "troquei de aba" virar "abandonou".
- **A proteção resolve ANTES dos ataques, fora da ordem do turno.** Na ordem, um
  protect "lento" seria inútil contra priority alta e a proteção viraria função da
  Speed em vez de aposta. E ela é a ÚNICA mecânica reativa aceitável aqui porque é
  escolhida às cegas — a janela de reação continua proibida (§ "Não reintroduzir").

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
| `ui/` | `ui/`, tipos de `domain/` | **Prisma, `modules/auth/auth`, `commands/`, `queries/`** |

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

**O sintoma é de BUNDLE, não de contagem de filhos** — não se cura embrulhando
o cliente num componente de servidor vazio. Wrapper de servidor só se paga se
ele busca dado ou renderiza conteúdo que antes ia no browser. Sem `await`, sem
prop além de `children` e com um uso só, ele não existe: escreva o `div` na
própria page.

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
boilerplate: no battle, a linha crua carrega `actions` — a carta que o oponente
escolheu **antes do turno resolver**. Como o turno é **simultâneo** (os dois
escolhem às cegas no mesmo round), isso não é um detalhe: dava pra ler no
devtools e responder à jogada dele. Whitelist explícita fecha isso por
construção, e um teste trava o buraco:

```ts
expect(JSON.stringify(dto)).not.toContain("cardSlot");
```

O DTO diz **quem** já escolheu (`submittedUserIds`, pro "oponente pronto" da
tela), nunca **o quê**.

Os DTOs ficam em `ui/types.ts` — são o contrato entre servidor e UI, e como são
`interface`, não pesam no bundle.

### 3.1 Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto.

Guardar valor derivado não remove uma fonte de verdade — **adiciona** uma. Só
compensa quando o banco precisa filtrar ou ordenar por aquilo, porque aí não há
alternativa: não dá pra pôr num `WHERE` o que só existe em JS.

- `UserPokemon.xp` é a verdade; `level` é `f(xp)` mas está materializado
  **porque a coleção ordena por ele**. Os dois são escritos SEMPRE juntos, e só
  pelos helpers `progressionFromXp` / `progressionFromLevel`.
- `Pokemon.bst` e `Pokemon.rarity` são fatos imutáveis da ESPÉCIE, congelados na
  importação (`syncPokedex`). Ficam na espécie e não no `UserPokemon` porque a
  evolução troca `UserPokemon.pokemonId` — a carta muda de raridade sozinha ao
  evoluir. Cravado no `UserPokemon`, o valor velho ficaria pra trás pra sempre.
- Os 6 **stats derivados** (`deriveStats`) NÃO são guardados. São função de
  (espécie, nível), que já estão salvos; guardá-los obrigaria a reescrever tudo
  em todo level-up e toda evolução, e aqui não há worker pra reparar depois.
- `BattlePokemon.stats` é a exceção, e **não é cache — é isolamento**: o
  snapshot é congelado pra um level-up no meio não mudar a partida em andamento.

**Fronteira do BST:** `bstOf()`/`BST_BY_ID` (`pokemon/domain/rarity.ts`) é do
**sorteio de pacotes** (`packs/domain/draw.ts`), que pondera as 1025 espécies — a
maioria não tem linha em `Pokemon`. Quem TEM a linha lê
`pokemon.bst`/`pokemon.rarity`. É o que garante que a raridade desenhada na
carta é a mesma que o filtro do banco usou pra achar ela.

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
| `Map`/variável global como cache, fila ou rate-limit | cada invocação pode ser uma instância nova; memória **não sobrevive** | **tabela no banco** (ver o espelho e a fila do matchmaking) |
| escrever em arquivo / `fs` | filesystem é efêmero e read-only | banco (não há storage próprio hoje) |
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

- **Supabase Realtime = SINAL, não computação.** São **dois** triggers, os dois
  com payload mínimo, no canal `battle:<id>`:
  - `battle_updated` (UPDATE no `Battle`): o turno resolveu.
  - `battle_action_submitted` (INSERT em `BattleAction`): o oponente trancou a
    carta. Existe porque no turno **simultâneo** isso não mexe no `Battle` —
    sem ele o "oponente pronto" só apareceria no próximo poll. O payload leva
    `userId`/`round` e **jamais** o `cardSlot` (seria o mesmo vazamento que a
    regra 3 fecha, só que pelo WebSocket).

  O cliente reage refazendo o `GET` que passa pelo DTO (nem lê o payload). Com o
  canal assinado, o polling **relaxa de 2s pra 20s** (rede de segurança);
  qualquer erro no canal devolve os 2s. O push nunca executa `resolveTurn` —
  quem resolve continua sendo o request.
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

#### Consequência #4: cache é pra VITRINE; o que o jogo consulta vem do espelho

Essa é a linha, e ela é dura (decisão do dono, 2026-08-15):

- **Espelho em tabela (`Pokemon`/`Move`/`PokemonMove`/`Type`)** — **tudo** que o
  jogo consulta: coleção, deck, pacote, batalha. Escrito pelo `syncPokedex` e
  pelo `syncTypes`, rodados pelo seed. É banco, não cache: não expira, não tem
  miss, e nenhuma partida depende da PokéAPI estar de pé.
- **Cache de `fetch` do Next** — **só vitrine**: catálogo e tela de detalhe, que
  exibem dado da PokéAPI que o jogador ainda não tem. Serve pra aliviar chamada
  a uma API pública e gratuita (fair use), nada além disso. Morre a cada deploy,
  e tudo bem — é vitrine.

**Não misture os dois.** Cache alimentando mecânica é o erro que já foi cometido
e desfeito: a matriz de efetividade de tipo morava numa tabela `PokeApiCache`
key-value, e um miss dela mandava a **batalha** buscar na rede no meio da
partida. Virou espelho (tabela `Type`), e o `PokeApiCache` — que tinha esse
único consumidor — foi **dropado** (migration `20260815080940`). Se você sentir
vontade de cachear algo pro jogo consultar, o que você quer é uma tabela de
espelho e um sync que a preencha.

> Histórico: `readCachedPokemons`/`fetchAndCachePokemon`/`fetchAndCacheMove`
> saíram em 2026-08-02 quando o espelho assumiu pokémon e move; o resto do
> arquivo (`lib/pokeapiCache.ts`) saiu em 2026-08-15 com o tipo. A camada
> key-value não existe mais.

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

> **Fronteira do Realtime (implementada) — não confunda com
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

- `src/lib/` — infra **compartilhada** entre módulos: `prisma`, `pokeapi`,
  `rateLimit`, `cronAuth`, `typeColors`, `utcDay`. Não é módulo, não tem regra de
  negócio. A sessão NÃO mora aqui: é `modules/auth/auth.ts`.
- `src/layout/` — só o que é **genuinamente global** (`NavBar`, `TypeBadge`,
  `HpBar`, `toast`, `icons`). Componente que serve um módulo só mora no `ui/`
  **dele**.
- `src/modules/<mod>/` — a feature inteira: regra, leitura, escrita e tela.

### Os módulos, e a linha entre eles

- **`pokemon`** — o núcleo. A ESPÉCIE (espelho da PokéAPI: `syncPokedex`,
  `refreshPokedex`, ficha) e a CARTA do jogador (`UserPokemon`), mais tudo que
  faz ela mudar: nível/stats, XP e curva, evolução, learnset, TM, tutor,
  cruzamento, BST/raridade. E o desenho da carta (`PokeCard`, `HoloCard`,
  `pokeCardView`), que é o mesmo em toda tela.
- **`pokedex`** — a LISTA: filtrar, ordenar, paginar e navegar a coleção e o
  catálogo. Não sabe o que é um nível; sabe ordenar por ele.
- **`deck`** montar o time · **`packs`** sortear e abrir · **`battle`** a
  partida · **`trade`** a troca por código · **`quests`** os objetivos do dia ·
  **`auth`** sessão · **`realtime`** o canal do duelo.

> **Por que o cruzamento e o tutor moram em `pokemon`, e a troca não.** Cruzar e
> ensinar mudam **o que a carta é** (espécie nova, golpe novo) — é a definição de
> `pokemon`. A troca não muda a carta: muda **de quem ela é**, e por isso é
> módulo próprio, com oferta, código e proveniência. Já `quests` é separado
> porque conta EVENTOS do jogo (bateu, venceu, abriu pacote) e não sabe o que é
> um pokémon — quem gasta o token que ela paga é o `pokemon`.

**Como decidir onde uma coisa vai:** se a resposta muda quando o pokémon sobe de
nível ou evolui, é `pokemon`. Se muda quando o jogador troca o filtro ou a
página, é `pokedex`.

`pokemon` **não importa** `pokedex`/`deck`/`packs`/`battle` — a seta só aponta
pra ele. Se um arquivo lá dentro precisar importar de um irmão, a divisão está
errada; pare e reveja, não adicione o import. Desenho completo e histórico da
migração em `docs/specs/2026-08-07-pokemon-module-design.md`.

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
- ~~Não existe `error.tsx`~~ — **resolvido em 2026-08-14**: `app/(game)/error.tsx`
  cobre o throw em Server Component dentro do jogo e `app/global-error.tsx` cobre
  o que quebra no próprio root layout. O global renderiza `<html>`/`<body>`
  próprios e usa cor literal porque, quando ele aparece, o root layout (e com ele
  as fontes e o `globals.css`) não está na árvore.

**O que NÃO é dívida** (e por isso não está na lista acima): o **polling de 2s da
batalha** e o **turno resolvido na leitura**. Isso é a regra 5 — a consequência
direta de não existir worker no Vercel Hobby. Não "conserte".

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
