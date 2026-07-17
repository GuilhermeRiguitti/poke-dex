# Rotinas do sistema — fontes de dados, crons e fair use

> Runbook operacional. Complementa o `PLANO_JOGO.md` §8 (decisões de infra) e o
> `CLAUDE.md` regra 5 (serverless). Última atualização: 2026-07-17.

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
aba aberta. O caminho rápido (jogador da vez joga no tempo) continua sendo o
polling/`submitAction`; o cron só cobre o buraco.

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
A Gen 1 inteira gira em ~8 dias, o que sobra: dado de geração lançada quase não
muda.

- **Chama:** `POST https://poke-dex-rgt.vercel.app/api/cron/refresh-pokedex`
  (mesma auth do §2).
- **Lote de 20** porque o gargalo é a REDE (cada espécie puxa a si + os moves) e
  a lambda tem teto de tempo.
- ⚠️ **Só ATUALIZA o que já existe.** Não adiciona gerações novas — isso é o
  seed (§4).

## 4. Rotina manual: seed do espelho (por geração)

```bash
npm run seed              # Gen 1 (#1–#151) — padrão
npm run seed -- 152 251   # Gen 2
npm run seed -- 252 386   # Gen 3, etc.
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
     browser cacheia; espelhar a imagem (`lib/storage`) é o passo além.

## 6. Runbook — operar os crons

Inspecionar (SQL Editor do Supabase ou MCP `execute_sql`):
```sql
select jobid, jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select id, status_code, error_msg from net._http_response order by id desc limit 10;
```

Reagendar / desligar:
```sql
select cron.unschedule('resolve-battle-turns');
select cron.unschedule('refresh-pokedex');
-- re-agendar: SQL completo no PLANO_JOGO.md §8.3
```

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

**Estado atual (2026-07-17):** os 2 jobs estão **agendados e ativos**; tomam 404
até o merge `refactor-resolve-turn` → `main` subir o deploy novo. Pós-merge,
conferir o `net._http_response` virando 200.
