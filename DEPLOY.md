# Deploy & Migrations

O pipeline vive em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
A cada push em `main` ele, **em ordem**:

1. `prisma migrate deploy` — schema do app (ledger `_prisma_migrations`).
2. `supabase db push` — plataforma: RLS, extensões, realtime (ledger `supabase_migrations`).
3. `vercel pull && vercel build && vercel deploy --prod` — build e deploy.

Se qualquer migration falhar, **não deploya**. A ordem (Prisma → Supabase) é
obrigatória em ambiente novo: as migrations de RLS/realtime referenciam tabelas
que o Prisma cria.

Por que assim, e não pelo MCP: aplicar migration pelo MCP do Supabase exige o
Claude Code — um dev qualquer não reproduzia o banco. `supabase db push` +
`prisma migrate deploy` são os caminhos **documentados**, versionados e rodáveis
por qualquer um (inclusive o CI). O MCP volta a ser só ferramenta de exploração.

---

## ⚠️ Setup obrigatório antes do PRIMEIRO push (só você faz)

### 1. Desligar o auto-deploy Git da Vercel — FAÇA ISSO PRIMEIRO

Assumimos o deploy pelo CI. Se a integração Git da Vercel continuar ligada, **todo
push deploya DUAS vezes** (a Vercel + este workflow).

Vercel → projeto → **Settings → Git** → desconecte o repositório **ou** desligue o
auto-deploy do branch de produção. (Preview deployments por PR também somem — era
o trade-off aceito ao assumir o pipeline.)

### 2. Secrets no GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | O que é | Onde achar |
|---|---|---|
| `DATABASE_URL` | conexão **pooled** (PgBouncer, :6543) | mesma do `.env` de prod |
| `DIRECT_URL` | conexão **direta** (:5432, pro `prisma migrate`) | mesma do `.env` de prod |
| `SUPABASE_ACCESS_TOKEN` | Personal Access Token | Supabase → Account → **Access Tokens** |
| `SUPABASE_DB_PASSWORD` | senha do banco do projeto | Supabase → Project → Settings → Database |
| `VERCEL_TOKEN` | token da conta Vercel | Vercel → Account → **Tokens** |
| `VERCEL_ORG_ID` | id da org/conta | `.vercel/project.json` após `vercel link`, ou Vercel → Settings |
| `VERCEL_PROJECT_ID` | id do projeto | idem |

`SUPABASE_PROJECT_REF` (`zonyjgqlzaavavufxxvz`) não é secret — está fixo no workflow
(já é público no `.mcp.json`).

### 3. Reconciliação de ledger — **nada a fazer** ✅

As migrations em `supabase/migrations/` foram alinhadas 1:1 com o que o prod já
tem registrado (as 4 versões do ledger `supabase_migrations`). Então o primeiro
`supabase db push` é **no-op** em prod (tudo já aplicado) — sem `migration repair`,
sem risco. Um ambiente novo aplica as 4 em ordem e reproduz o estado.

---

## As duas contabilidades de migration

O mesmo banco tem **dois ledgers** — não misture:

| Pasta | Ledger | Ferramenta | O que mora aqui |
|---|---|---|---|
| `prisma/migrations/` | `_prisma_migrations` | `prisma migrate` | schema do app (tabelas, colunas, índices) |
| `supabase/migrations/` | `supabase_migrations.schema_migrations` | `supabase db push` | plataforma: RLS, `pg_cron`/`pg_net`, `realtime` |

Regra: mexeu no schema do app → migration Prisma. Mexeu em RLS/extensão/realtime/
schema de plataforma → migration Supabase. As duas são versionadas no git e
aplicadas pelo CI.

---

## Gap conhecido: os jobs do pg_cron não são versionados

`supabase/migrations/20260715022134_enable_pg_cron_pg_net.sql` cria as **extensões**,
mas os **dois jobs** que rodam hoje (`resolve-battle-turns` a cada 30s e
`refresh-pokedex` diário) foram agendados fora de qualquer migration. Um ambiente
novo sobe com as extensões mas **sem os jobs**. O arquivo traz o `cron.schedule`
comentado (com a URL a preencher) — não versionamos a URL de prod de propósito
(um staging bateria no prod). Ao subir ambiente novo, agende manualmente.

---

## Rodar migrations localmente (dev)

Dev usa o stack do Supabase CLI (Docker, banco em `:54322`):

```sh
npx supabase start          # sobe o stack local
npx supabase db push        # aplica supabase/migrations/ no banco local
npx prisma migrate deploy   # aplica prisma/migrations/ no banco local
```

O `supabase` não é dependência do projeto — use via `npx supabase` (ou instale o
CLI global). No CI é a action `supabase/setup-cli`.
