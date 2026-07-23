# TODO
- Api client com react query tan stack 


# SEGURANCA

## Auditado (ver resumo abaixo)

- [x] **BYPASS api > banco / battle > banco** — auditado. As rotas são casca fina
  (sessão -> command -> HTTP) e nenhuma regra mora nelas. Achado 1 bypass real: o
  PP não era gasto (dava pra repetir o golpe mais forte pra sempre). CORRIGIDO:
  engine gasta o PP, resolveTurn grava a coluna Json `moves` de volta, submitMove
  recusa slot zerado. Fallback de struggle quando tudo zera, senão o jogador
  ficaria sem ação e perderia por abandono.
- [x] **IDOR** — auditado, nenhum encontrado. Toda escrita escopa o dono no
  PRÓPRIO `where` (não num findUnique antes, que seria corrida):
  `removeCard` -> `deleteMany({ id, userId })`; `removeFromDeck` ->
  `deleteMany({ id, deck: { userId } })`; `addToDeck` compara `userCard.userId`
  e devolve `not_found` (não vira oráculo de "esse id existe"); o `deckId` que o
  cliente manda no POST /api/battle/queue passa por `readDeckRoster`, que filtra
  `where: { id: deckId, userId }`.
- [x] **Escrita antes da autorização** (achado NOVO, não estava nesta lista).
  `getBattleState`/`getBattleStatus` chamavam `tryResolveTurn` — que ESCREVE e
  pode bater na PokéAPI — e só DEPOIS checavam se o usuário era participante. O
  403 saía certo, mas a partida alheia já tinha sido mexida e a chamada de rede
  já tinha saído. CORRIGIDO: as duas agora fazem LÊ -> AUTORIZA -> ESCREVE. O
  `tryResolveTurn` foi partido em `loadBattleForResolve` (só lê) + `resolveIfDue`
  (escreve), então a autorização reusa a MESMA leitura que a resolução já ia
  fazer — autorizar antes de escrever custa ZERO query extra, o que importa
  porque /status é polling de 2s dos dois jogadores. Ver queries/battleAccess.ts.
- [x] **Prisma pro bundle do browser** — hoje NÃO vaza: nenhum arquivo de `ui/`
  ou `components/` importa `lib/prisma`, `lib/auth`, `commands/` ou `queries/`.
  Mas isso é só disciplina — ver "server-only" abaixo.
- [x] **refreshToken / token expires na Account** — NÃO usar, e NÃO remover. Só
  `emailAndPassword` está ligado, então `accessToken`/`refreshToken`/`idToken` e
  os `*ExpiresAt` são todos NULL; existem porque o prismaAdapter do better-auth
  espera esse shape. Só passam a importar se entrar login social — e aí guardam
  token de terceiro em texto plano, o que merece pensar em criptografia. A coluna
  `password` guarda o hash e não é selecionada em lugar nenhum do código.

## Aberto (achados da auditoria, ainda não corrigidos)

- [ ] **Sem rate limit em lugar nenhum.** POST /api/cards captura qualquer um dos
  1025 pokémon sem custo nem limite; um script em loop faz 1025 escritas e, em
  cache miss, 1025 fetches na PokéAPI — amplificação contra a API de terceiro, e
  a fair use policy deles (https://pokeapi.co/docs/v2) pede o contrário. O
  PokeApiCache absorve o repeteco, mas não a primeira varredura.
- [ ] **`betterAuth` sem `rateLimit`, `trustedOrigins`, `baseURL` nem config de
  `session`** (src/lib/auth.ts está no mínimo absoluto). Brute force de senha no
  sign-in não tem freio explícito.
- [ ] **`import "server-only"` não existe no projeto.** A regra "ui/ não importa
  Prisma" é hoje SÓ documentação no CLAUDE.md — está sendo cumprida, mas nada a
  força. Pôr `server-only` em lib/prisma.ts, lib/auth.ts e nos index.ts dos
  módulos transforma a próxima regressão em erro de build em vez de Prisma no
  bundle do cliente.
- [ ] `/design-system` está FORA do grupo (game) => rota pública, sem sessão.


# PRISMA CLIENT GLOBAL

# VERIFICAR ISSO

Documenta o padrão como ele realmente é, não como seria bonito. Pontos que fiz questão de deixar explícitos:

CQRS lite, com um aviso. Botei em destaque que aqui CQRS é separação por pasta — sem event store, sem event bus, sem read model. Sem isso, o próximo agente lê "CQRS" e te entrega um Kafka.

Tabela de dependência entre pastas. Quem pode importar quem. A linha que mais importa: ui/ não pode importar Prisma nem commands/queries — senão o Prisma vaza pro bundle do browser.

As regras estão escritas como sintoma, não como teoria. Ex., a regra 1 diz literalmente: "o sintoma de que você errou é a page virar servidor renderizando um único componente cliente que é a página inteira" — que foi exatamente o meu erro no começo. Documentei o erro, não só o acerto.

Também estão lá: o par getBattleState (escreve) vs readBattleState (só lê), a proibição de escrita no render, o DTO obrigatório com o caso real do pendingMoves, as restrições de serverless (cron 1x/dia no Hobby → resolução na leitura → atomicidade crítica), e a dívida conhecida.


# TELA POKDEMON DETALHE
Detalhar melhor as skills em formato de cartas, verificar todas e melhorar UI e exibicao das cartas (parece ter mais cartaz do que disponiveis na batalha , verificar sobre isso e montar uma pre selecao de skills pra da a opcao do usuario montar um deck mais customizado , combinando skills com variedade de pokemon, e ao mesmo tempo n precisar carregar todas as skills na UI da batalha

# VER ESSE SCRPT
`scripts\generate-rarity.mjs`





# MIGRATIONS / REPRODUZIR O BANCO DO ZERO

Nenhum dos dois quebra o deploy de hoje. Os dois quebram **subir um ambiente novo**
(ou um banco local limpo). Analisar depois.

- [ ] **Os jobs do pg_cron não estão em migration nenhuma.** No prod rodam dois,
  ativos: `resolve-battle-turns` (30s, o backstop que resolve turno de partida que
  ninguém está pollando) e `refresh-pokedex` (diário). A migration
  `supabase/migrations/20260715022134_enable_pg_cron_pg_net.sql` cria só as
  **extensões** — o `cron.schedule` está lá como comentário, pra rodar na mão.
  Resultado: ambiente novo sobe sem o backstop, e ninguém percebe até uma partida
  travar. O motivo de não versionar é real (o comando embute a URL do deploy, que
  muda por ambiente — versionar a de prod faria um staging bater no prod). Saída
  possível: a migration lê a URL e o secret de um GUC do banco
  (`current_setting('app.deploy_url')`) ou do Vault do Supabase, em vez de
  hardcode. Aí o `cron.schedule` vira versionável e o valor fica por ambiente.
  Já documentado como gap em `DEPLOY.md` e no cabeçalho da própria migration.

- [ ] **O fluxo de dev documentado está na ordem errada e quebra num banco limpo.**
  `DEPLOY.md` § "Rodar migrations localmente (dev)" manda `supabase db push` e
  **depois** `prisma migrate deploy`. Num banco local recém-criado isso falha: as
  migrations de realtime dependem de tabelas que o Prisma ainda não criou —
  `create function ... language sql` valida o corpo contra `public."BattleParticipant"`
  (check_function_bodies) e o `create trigger` precisa de `public."Battle"`. O
  `.github/workflows/deploy.yml` faz na ordem certa (Prisma → Supabase); só a doc
  de dev diverge. Mesma pegadinha vale pro `supabase db reset`, que roda só
  `supabase/migrations/` e por isso nunca funciona sozinho aqui.
  Duas coisas a fazer: **(a)** inverter a ordem no `DEPLOY.md`; **(b)** avaliar um
  script `"db:reset"` no `package.json` encadeando
  `supabase db reset && prisma migrate deploy && supabase db push`, pra ninguém
  depender de lembrar a ordem.


# SEGURANÇA EM DEPLOY (VER SOBRE)
Como você optou por repository secrets (sem o gate de aprovação do environment), a trava é disciplina, não o pipeline: toda migration nova que for pra main precisa ser lida antes procurando DROP/DELETE/ALTER ... DROP. Se um dia isso te preocupar, o environment: Production com "required reviewer" é a rede — mas isso é decisão sua, e por ora está do jeito que você quis.