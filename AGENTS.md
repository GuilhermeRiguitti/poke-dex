<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Banco é Supabase: toda tabela nova nasce com RLS ligada

O Supabase publica uma **API REST automática (PostgREST)** acessível com a `anon`
key + URL do projeto. **Tabela sem Row-Level Security é lida, editada e apagada por
qualquer um** por essa API — inclusive `User`/`Account`.

Regra, sem exceção: **a migration que cria a tabela liga RLS na mesma migration.** O
Prisma não faz isso sozinho (o schema não descreve RLS). Depois do `CREATE TABLE`:

```sql
ALTER TABLE "MinhaTabela" ENABLE ROW LEVEL SECURITY;
```

- **Sem policies — é deny-all de propósito.** O runtime é o Prisma como `postgres`,
  **dono das tabelas + `BYPASSRLS`**, então não passa por RLS; a API pública
  (`anon`/`authenticated`), sim. O app não usa a anon key em lugar nenhum, então
  fechar não tira nada do jogo.
- **Nunca `FORCE ROW LEVEL SECURITY`.** FORCE sujeita o próprio dono à RLS → sem
  policy vira deny-all pro runtime também = **app fora do ar**.
- **Não crie policy pra calar o linter — nas tabelas do APP.** O aviso
  `rls_enabled_no_policy` (INFO) é o estado desejado; policy com `auth.uid()` seria
  inútil — não usamos Supabase Auth.
- Depois de mexer no schema, rode o advisor de segurança do Supabase: o alerta
  `rls_disabled_in_public` (ERROR) denuncia a tabela esquecida.

Referência: `prisma/migrations/20260714010000_enable_rls_all_tables`.

## A ÚNICA exceção: `realtime.messages` (implementada)

A regra "deny-all, sem policy" vale pras tabelas do **app** (schema `public`). O
Realtime do duelo (PLANO_JOGO.md §8) é a exceção consciente: pra um jogador
assinar o canal `battle:<id>`, existe **uma policy em `realtime.messages`**
(schema `realtime`, não `public`) autorizando **participante ↔ topic** — em
`supabase/migrations/20260717000000_realtime_battle_broadcast.sql` (fora das
migrations Prisma de propósito: o schema `realtime` só existe na plataforma).
Isso **não reabre** o PostgREST: a `anon`/`publishable` key no browser só
destrava o WebSocket; ela continua sem acesso de leitura a `Battle`/`User` via REST,
porque as tabelas do app seguem deny-all. **"Abrir o Realtime ≠ abrir o PostgREST."**

⚠️ Gotchas dessa policy (os dois negam tudo **em silêncio** se errar):
- Os ids são **cuid (texto)**, não uuid. `auth.uid()` faz cast pra `uuid` →
  copiar da doc do Supabase quebra. Leia o `sub` como texto:
  `current_setting('request.jwt.claims', true)::jsonb->>'sub'`.
- A policy roda como `authenticated`, que é **deny-all nas tabelas do app** — a
  checagem de participação (`BattleParticipant`) tem que passar por função
  **`SECURITY DEFINER`** (dona: `postgres`), senão o `EXISTS` volta vazio sempre.
