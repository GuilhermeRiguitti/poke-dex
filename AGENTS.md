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
- **Não crie policy pra calar o linter.** O aviso `rls_enabled_no_policy` (INFO) é o
  estado desejado; policy com `auth.uid()` seria inútil — não usamos Supabase Auth.
- Depois de mexer no schema, rode o advisor de segurança do Supabase: o alerta
  `rls_disabled_in_public` (ERROR) denuncia a tabela esquecida.

Referência: `prisma/migrations/20260714010000_enable_rls_all_tables`.
