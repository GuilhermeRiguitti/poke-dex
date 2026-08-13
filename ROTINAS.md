# Rotinas do sistema — fontes de dados, crons e fair use

> Runbook operacional. Complementa o `CLAUDE.md` regra 5 (serverless) e o
> `DEPLOY.md`. Última atualização: 2026-08-07.

O contexto que explica tudo aqui: **não existe worker na Vercel Hobby** — toda
page/rota é uma função efêmera. O tempo só passa de dois jeitos: (a) um request
de jogador chega (o polling de 2s é o motor do jogo), ou (b) o **`pg_cron` do
Supabase** dispara uma rota nossa por HTTP (`pg_net`). As rotinas abaixo são o
caso (b) + as rotinas manuais de dados.

---

## 1. Fonte dos dados de pokémon — quem lê o quê

**Regra:** o que o **jogo** usa vem do **espelho local** (tabelas
`Pokemon`/`Move`/`PokemonMove`); o que é **vitrine** vem da PokéAPI **cacheada**.
A API é fornecedora do espelho (via seed/refresh), não dependência do gameplay —
PokéAPI fora do ar **não para nenhuma partida**.

| Tela/fluxo | Fonte | Rede? |
|---|---|---|
| Coleção (`getCollection`) | `UserPokemon` → espelho | zero |
| Packs (sorteio + carta) | pool e visual do espelho | zero |
| Deck/loadout + learnset | `DeckSlot`/`Move`/`PokemonMove` | zero |
| Batalha (stats, cartas, dano) | snapshot congelado do espelho | zero¹ |
| Catálogo/PokéDex (1025) | PokéAPI via cache do `fetch` do Next | no miss² |
| Página de detalhe | PokéAPI via cache do `fetch` do Next | no miss² |
| Seed / refresh | PokéAPI (é o trabalho deles) | sim |

¹ Exceção: a matriz de tipos (`buildTypeChart`, endpoint `/type`) — 18 tipos,
cacheados pra sempre na tabela `PokeApiCache`; rede só no primeiro miss, e
sempre FORA da transação.
² O cache do `fetch` do Next morre a cada deploy — o catálogo re-busca conforme
navegação real. É o maior ponto de tráfego recorrente (ver §5).

O espelho define **o que é obtível**: os packs sorteiam só do que existe nele.
Catálogo mostrar 1025 é vitrine; capturar, só o que está espelhado.

---

## 2. Cron: `resolve-battle-turns` (a cada 30s)

**O que faz:** resolve turnos de duelo **já vencidos** (>90s) de partidas que
ninguém está mais empurrando — mata a partida zumbi sem depender de jogador com
aba aberta. O caminho rápido (os dois jogam dentro do tempo, e quem submete por
último resolve o turno no próprio POST) continua sendo o polling/`submitAction`;
o cron só cobre o buraco.

- **Agendador:** `pg_cron` + `pg_net` (extensões dentro do Postgres do Supabase).
- **Chama:** `POST https://poke-dex-rgt.vercel.app/api/cron/resolve-turns`
- **Auth:** `Authorization: Bearer <CRON_SECRET>` — o SQL do job lê o segredo do
  **Vault** a cada disparo (nunca fica escrito no job). A rota é fail-closed e
  timing-safe (`src/lib/cronAuth.ts`).
- **Comportamento:** varre até 50 partidas `IN_PROGRESS` com `turnStartedAt`
  vencido, mais antigas primeiro, sequencial, falhas isoladas
  (`resolveDueBattles`). Idempotente e disputado: quem perde o claim otimista
  não escreve nada — cron × polling se cruzando é corrida controlada.

## 3. Cron: `refresh-pokedex` (diário, 03:15 UTC)

**O que faz:** re-sincroniza o espelho devagar — pega as **20 espécies com
`fetchedAt` mais antigo** e re-busca da PokéAPI (upsert por `pokemonApiId`).

- **Chama:** `POST https://poke-dex-rgt.vercel.app/api/cron/refresh-pokedex`
  (mesma auth do §2).
- **Lote de 20** porque o gargalo é a REDE (cada espécie puxa a si + os moves) e
  a lambda tem teto de tempo. **Esse teto é o limite real do job** — não dá pra
  aumentar o lote pra ele "dar conta" mais rápido.
- ⚠️ **Só ATUALIZA o que já existe.** Não adiciona gerações novas — isso é o
  seed (§4).
- ⚠️ **Quanto demora uma volta depende do tamanho do espelho, e isso muda tudo:**
  com a Gen 1 (151) são ~8 dias de cron diário; com as **1025 gens semeadas**
  (o caso do prod hoje), são **~51 dias** — e mensal, ~51 MESES. Ou seja: neste
  espelho o job **não é** mecanismo de re-sincronização, é batimento cardíaco.
- ⚠️ **NÃO conte com ele pra preencher campo novo.** Quando o código passa a ler
  um campo que o espelho nunca gravou, as linhas antigas ficam nulas e só o
  `syncPokedex` passando por elas conserta. Foi o caso do `Move.effect` (status
  e stat stage, 2026-08-12): a coluna existia vazia desde sempre porque o
  `fetchMove` descartava o `meta` da API. **Backfill é o seed (§4), na faixa
  toda, rodado à mão** — 20 espécies por passada nunca vai alcançar 1025.

## 4. Rotina manual: seed do espelho (por geração)

```bash
npm run seed              # Gen 1 (#1–#151) — padrão
npm run seed -- 152 251   # Gen 2
npm run seed -- 252 386   # Gen 3, etc.
npm run seed -- 1 1025    # TUDO — é isto que faz backfill de campo novo (~20 min)
```

- Idempotente (upsert por `pokemonApiId`/`moveApiId`; learnset via
  `createMany + skipDuplicates`) — re-rodar completa o que faltou.
- **Concorrência máx. 8 requests em voo** (`syncPokedex`, `mapLimit`) — gentil
  com a API. Gen 1 completa: 151 espécies / 592 moves / 14.368 vínculos, ~3 min.
- Semear uma gen nova faz o pool dos packs crescer sozinho (ele lê o espelho).
- Se o log acusar `falhas (rede/404)`, re-rode — só completa as que faltaram.

## 5. Fair use da PokéAPI — como cumprimos

A policy pede: *"locally cache resources whenever you request them"* + não
martelar. Cumprimos com folga:

- **Cache em 3 camadas:** espelho (definitivo — gameplay nunca re-busca),
  `PokeApiCache` (tabela, sobrevive a deploy), cache do `fetch` do Next.
- **Volume gentil:** seed por geração com concorrência 8; refresh de 20/dia;
  batalha com zero rede; catálogo guiado por navegação real (20 cards/página,
  cacheados) — nunca scraping em massa.
- **Pontos fracos conhecidos** (vitrine, não gameplay):
  1. cache do Next morre a cada deploy → catálogo re-busca conforme navegação.
     Cura futura: servir o catálogo do espelho quando todas as gens estiverem
     semeadas.
  2. sprites hotlinkadas do CDN (GitHub) — prática padrão do ecossistema e o
     browser cacheia; espelhar a imagem num storage próprio é o passo além (não
     existe hoje: `lib/storage.ts` foi removido em 2026-08-02, sem consumidor).

## 6. Runbook — operar os crons

> **O MCP do Supabase é LOCAL e read-only** (`.mcp.json`): roda
> `@supabase/mcp-server-supabase` via `npx` com `--read-only` e um **Personal
> Access Token** em `SUPABASE_ACCESS_TOKEN` (variável de ambiente — o token
> NUNCA entra no `.mcp.json`, que é versionado).
>
> Era o servidor **hospedado** (`https://mcp.supabase.com/mcp?project_ref=…`) e
> foi trocado em 2026-08-13 por dois motivos: (1) o OAuth dele não fechava — o
> `?project_ref=` da URL virava `%253F` no parâmetro `resource` do authorize, ou
> seja, codificado duas vezes; (2) ele pedia escopo de **escrita** (`database:write`,
> `projects:write`, `secrets:read`) no prod, o oposto da regra do `CLAUDE.md`.
> O `--read-only` agora **impõe** essa regra em vez de só documentá-la.
>
> Consequência prática: **reagendar cron NÃO passa pelo MCP** (é escrita). Use o
> SQL Editor do dashboard.

Inspecionar (SQL Editor do Supabase ou MCP `execute_sql`):
```sql
select jobid, jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select id, status_code, error_msg from net._http_response order by id desc limit 10;
```

Reagendar / desligar:
```sql
-- mudar só a periodicidade, mantendo o job e o comando:
select cron.alter_job(
  (select jobid from cron.job where jobname = 'refresh-pokedex'),
  schedule => '15 3 1 * *'   -- 1x/mês, dia 1 às 03:15 UTC
);

select cron.unschedule('resolve-battle-turns');
select cron.unschedule('refresh-pokedex');
-- re-agendar do zero: o SQL completo dos dois jobs está comentado em
-- supabase/migrations/20260715022134_enable_pg_cron_pg_net.sql (ver DEPLOY.md)
```

⚠️ O `resolve-battle-turns` é o único dos dois que **não pode** ser afrouxado: é
o backstop que encerra partida zumbi (`CLAUDE.md` regra 5). O `refresh-pokedex`
é o folgado — ver o §3 sobre por que, no espelho de 1025, ele é quase decorativo.

Segredo:
```sql
select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret';
```
O MESMO valor precisa estar na Vercel (`CRON_SECRET`, Settings → Environment
Variables). Env nova na Vercel só vale depois de **redeploy**.

**Diagnóstico rápido pelo `status_code` do `net._http_response`:**
| Código | Significa | Cura |
|---|---|---|
| `200` | tudo certo | — |
| `401` | `CRON_SECRET` errado/ausente na Vercel | conferir env + redeploy |
| `404` | deploy de prod não tem a rota (branch não mergeado) | mergear/deployar |
| `timeout` | lambda estourou 5s do `pg_net` | ok se raro; a rota é idempotente |

**Como as rotas entram no ar:** elas vivem no app da Vercel e sobem pelo pipeline
de CI (`.github/workflows/deploy.yml` → push em `main`). Se o `net._http_response`
acusar 404, o deploy de prod ainda não tem a rota — confira o run do Actions. 401
é `CRON_SECRET` divergente entre o Vault e a Vercel. Os 2 jobs seguem agendados
no Supabase (o wipe do banco não os apaga; ver DEPLOY.md).
