# PokéDuel

Um jogo de **duelo tático 1×1 de Pokémon**, fiel à série. Você **coleciona**
Pokémon (cada um nasce no nível 1 e sobe jogando), monta um **deck** de 1 Pokémon
+ até 6 cartas (skills liberadas por nível) e enfrenta outro jogador em **turnos
simultâneos**: os dois escolhem a carta do mesmo round **sem ver a do outro**, e
quem tem mais Speed executa primeiro.

Todo stat vem da **[PokéAPI](https://pokeapi.co/)** — nada é inventado à mão. O
nível escala os stats e **libera skills novas** (learnset por nível, como no jogo
original).

> A visão completa do jogo e o estado de cada fase estão em
> [`PLANO_JOGO.md`](PLANO_JOGO.md). As regras de arquitetura que valem ouro (e por
> quê) estão em [`CLAUDE.md`](CLAUDE.md) e [`AGENTS.md`](AGENTS.md).

## Stack

- **[Next.js](https://nextjs.org) 16** (App Router) + **React 19** — deploy na
  **Vercel Hobby** (funções serverless efêmeras).
- **Postgres no [Supabase](https://supabase.com)** via **[Prisma](https://www.prisma.io)**
  (conexão pooled/PgBouncer no runtime).
- **[better-auth](https://better-auth.com)** — login por e-mail e senha.
- **Supabase Realtime** — push do estado da batalha (é sinal, não computação).
- **[pg_cron](https://github.com/citusdata/pg_cron)** no Supabase — o "worker"
  que resolve turnos de partidas que ninguém está olhando.
- **Tailwind CSS 4** · **Vitest** (testes) · **TypeScript**.

## Como funciona (o resumo que importa)

A Vercel Hobby não tem processo vivo entre requests — **não há worker**. Por isso:

- **A leitura é que empurra a partida.** O cliente faz *polling* do estado da
  batalha, e é esse request que resolve o turno (`resolveTurn`). Sem ninguém
  olhando, nada acontece no servidor.
- **Realtime só avisa** que o turno virou (ou que o oponente trancou a carta),
  pra tirar o cliente do polling — ele nunca resolve o turno.
- **`pg_cron` é o relógio de backstop** (a cada 30s), pra resolver o turno vencido
  de uma partida zumbi.

Isso **não é gambiarra** — é a única opção do ambiente. Detalhes e as regras que
não podem ser quebradas estão na regra 5 do [`CLAUDE.md`](CLAUDE.md).

## Arquitetura

Código organizado em **módulos** com separação **command/query** (CQRS "lite" — é
separação por pasta, não event sourcing):

```
src/modules/<modulo>/
  index.ts        API pública. Só código de servidor.
  domain/         Regras puras. Sem Prisma, sem fetch, sem React.
  queries/        LEITURA. Recebe ids, devolve DTO.
  commands/       ESCRITA. Recebe intenção, aplica no banco.
  ui/             Apresentação. Componentes, hooks, view-model, DTOs.
```

Módulos: `battle` (referência), `deck`, `packs`, `pokedex`, `realtime`.
Infra compartilhada em `src/lib/` (`prisma`, `auth`, `pokeapi`, `storage`, …).
A fronteira é o `index.ts` — pages e rotas importam só dele. Ver
[`CLAUDE.md`](CLAUDE.md) para a tabela de quem-pode-importar-quem.

## Rodando localmente

Pré-requisitos: **Node 20+** e o **[Supabase CLI](https://supabase.com/docs/guides/local-development)**
(o banco de dev é o stack Docker local do CLI, não o Supabase remoto — o remoto é
**produção**).

```bash
# 1. sobe o Postgres local do Supabase (porta 54322)
npx supabase start

# 2. aplica o schema e semeia a Pokédex (Gen 1) a partir da PokéAPI
npx prisma migrate deploy
npm run seed

# 3. sobe o app
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente (`.env`)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão **pooled** (PgBouncer, :6543) — o runtime |
| `DIRECT_URL` | conexão **direta** (:5432) — só pro `prisma migrate` |
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | WebSocket do Realtime no browser |
| `SUPABASE_JWT_SECRET` | assina o JWT do canal Realtime (better-auth, sem Supabase Auth) |
| `CRON_SECRET` | Bearer das rotas de cron (`/api/cron/*`) |
| `NEXT_PUBLIC_APP_URL` · `NEXT_PUBLIC_MOVE_ART_BASE_URL` | URL do app e base das artes de golpe |

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # prisma generate + next build
npm run start      # produção
npm run seed       # popula Pokemon/Move/PokemonMove a partir da PokéAPI (Gen 1)
npm test           # vitest run
npm run lint       # eslint
```

## Verificação

Antes de dar um trabalho por pronto:

```bash
npx tsc --noEmit && npx vitest run && npx eslint && npx next build
```

Precisam de teste: `domain/` (puro), a view-model de `ui/`, o mapper de DTO
(provando que não vaza o que não pode) e o `command` concorrente (provando que
quem perde o claim não escreve nada).

## ⛔ Migrations só entram por arquivo versionado

Nunca aplique DDL no banco de prod por fora do git (MCP, SQL Editor, `db push`
apontado pro prod, etc.). Os dois ledgers (`_prisma_migrations` e
`supabase_migrations.schema_migrations`) são a fonte da verdade do CI — aplicar
por fora **trava o próximo deploy**. Toda tabela nova nasce com **RLS ligada** na
mesma migration. O porquê completo está em [`CLAUDE.md`](CLAUDE.md),
[`AGENTS.md`](AGENTS.md) e [`DEPLOY.md`](DEPLOY.md).

## Deploy

CI aplica as migrations (Prisma → Supabase) e a Vercel faz o deploy da `main`.
Passo a passo e os gaps conhecidos em [`DEPLOY.md`](DEPLOY.md).
