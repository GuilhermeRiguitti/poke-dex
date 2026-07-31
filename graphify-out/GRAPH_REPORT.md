# Graph Report - poke-dex-next  (2026-07-30)

## Corpus Check
- 212 files · ~92,936 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 884 nodes · 1719 edges · 65 communities (49 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9c2b8f63`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- battle/index.ts
- resolveTurn.ts
- packs/index.ts
- deck/index.ts
- progression/index.ts
- design-system/page.tsx
- battleView.ts
- compilerOptions
- What You Must Do When Invoked
- Plano — duelo tático 1v1 fiel à série
- pokeapi.ts
- 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto
- pokedex/index.ts
- checkInLogin.ts
- 2. O que é usado pra calcular a raridade: **BST**
- devDependencies
- pokedexView.ts
- dependencies
- syncPokedex.ts
- Módulo `progression` — extração do domínio de progressão
- listPokedexPage.ts
- training/index.ts
- TODO.md
- graphify reference: extra exports and benchmark
- Deploy & Migrations
- Estrutura de arquivos
- PokeDex
- scripts
- Rotinas do sistema — fontes de dados, crons e fair use
- token/route.ts
- refresh-pokedex/route.ts
- graphify reference: query, path, explain
- resolveTurn.test.ts
- REALTIME.md
- generate-rarity.mjs
- app/layout.tsx
- resolveDueBattles.test.ts
- battleAccess.test.ts
- addToDeck.test.ts
- openPack.test.ts
- AGENTS.md
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- package.json
- storage.ts
- checkInLogin.test.ts
- applyTM.test.ts
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- .claude/CLAUDE.md
- extraction-spec.md
- eslint.config.mjs
- konva
- .mcp.json
- next.config.mjs
- react-konva
- @supabase/supabase-js
- postcss.config.mjs
- enqueueBattle.test.ts
- getUnlockedMoveIds.test.ts
- { signIn, signUp, signOut, useSession }

## God Nodes (most connected - your core abstractions)
1. `auth` - 23 edges
2. `compilerOptions` - 17 edges
3. `syncPokedex()` - 15 edges
4. `resolveIfDue()` - 14 edges
5. `BattlePokemonState` - 14 edges
6. `What You Must Do When Invoked` - 12 edges
7. `Plano — duelo tático 1v1 fiel à série` - 12 edges
8. `typeColor()` - 11 edges
9. `activeOf()` - 11 edges
10. `BattleMoveDef` - 11 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `syncPokedex()`  [EXTRACTED]
  prisma/seed.ts → src/modules/pokedex/commands/syncPokedex.ts
- `PacksPage()` --calls--> `readPackState()`  [EXTRACTED]
  src/app/(game)/packs/page.tsx → src/modules/packs/queries/readPackState.ts
- `POST()` --calls--> `openPack()`  [EXTRACTED]
  src/app/api/packs/open/route.ts → src/modules/packs/commands/openPack.ts
- `HandCard()` --calls--> `typeColor()`  [EXTRACTED]
  src/modules/battle/ui/DuelTable.tsx → src/lib/typeColors.ts
- `active()` --calls--> `activeOf()`  [EXTRACTED]
  tests/modules/battle/domain/duelEngine.test.ts → src/modules/battle/domain/duelTypes.ts

## Import Cycles
- 4-file cycle: `src/modules/deck/commands/addToDeck.ts -> src/modules/pokedex/index.ts -> src/modules/pokedex/queries/getCollection.ts -> src/modules/deck/index.ts -> src/modules/deck/commands/addToDeck.ts`

## Communities (65 total, 16 thin omitted)

### Community 0 - "battle/index.ts"
Cohesion: 0.05
Nodes (52): { POST, GET }, POST(), GET(), GET(), DELETE(), POST(), GET(), POST() (+44 more)

### Community 1 - "resolveTurn.ts"
Cohesion: 0.06
Nodes (69): loadXpContext(), XpContext, BattleTeamMember, buildTypeChart(), DAMAGE_CLASSES, toBattleMove(), toPokemonState(), ActionRow (+61 more)

### Community 2 - "packs/index.ts"
Cohesion: 0.11
Nodes (32): HomePage(), MirrorSpecies, openPack(), OpenPackResult, canOpenFree(), nextFreePackAt(), bstOf(), drawPack() (+24 more)

### Community 3 - "deck/index.ts"
Cohesion: 0.11
Nodes (31): DELETE(), GET(), POST(), globalForPrisma, addToDeck(), AddToDeckInput, AddToDeckResult, removeFromDeck() (+23 more)

### Community 4 - "progression/index.ts"
Cohesion: 0.12
Nodes (35): awardBattleXp(), CombatantRow, maybeEvolve(), pruneLoadoutForSpecies(), XpAward, getUnlockedMoveIds(), birthLevelForSpecies(), EvolutionChainNode (+27 more)

### Community 5 - "design-system/page.tsx"
Cohesion: 0.08
Nodes (21): SWATCHES, TYPE_SCALE, CardsIcon(), CloseIcon(), GridIcon(), MenuIcon(), PackIcon(), PokeballIcon() (+13 more)

### Community 6 - "battleView.ts"
Cohesion: 0.09
Nodes (27): BattleErrorToast(), BattleRoom(), activeMon(), DuelCardView, DuelLogLine, DuelMode, DuelMonView, DuelTurnFx (+19 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+20 more)

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "Plano — duelo tático 1v1 fiel à série"
Cohesion: 0.08
Nodes (24): 10. Riscos / o que quebra (honestidade), 11. Decisões, 1. A visão em um parágrafo, 2. Decisões travadas × decisões abertas, 3.1 Ordem dentro do turno (`domain/turnOrder.ts`), 3.2 Economia de energia (a tensão de "gastar ou guardar")  *(fatia A2)*, 3.3 Janela de reação *(reavaliar)*, 3.4 Como o motor ficou (+16 more)

### Community 10 - "pokeapi.ts"
Cohesion: 0.15
Nodes (17): CACHE_FOREVER, fetchMove(), fetchPokemon(), fetchType(), MoveLearnDetail, NormalizedEvolutionNode, NormalizedMove, NormalizedPokemon (+9 more)

### Community 11 - "5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto"
Cohesion: 0.08
Nodes (23): 1. Page é servidor. Sempre., 2. Nunca escreva durante o render de uma page, 3. Toda saída pro cliente passa por um DTO, 4. Lógica de apresentação sai do componente, 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto, 6. Concorrência: assuma duas lambdas ao mesmo tempo, Arquitetura, Como gerar uma migration do schema do app (dev) (+15 more)

### Community 12 - "pokedex/index.ts"
Cohesion: 0.20
Nodes (13): DELETE(), CollectionPage(), RefreshPokedexOptions, RefreshPokedexSummary, removeCard(), RemoveCardResult, SyncPokedexSummary, getCollection() (+5 more)

### Community 13 - "checkInLogin.ts"
Cohesion: 0.20
Nodes (12): POST(), NavBar(), checkInLogin(), CheckInResult, alreadyCheckedInToday(), daysUntilReward(), earnsReward(), nextStreak() (+4 more)

### Community 14 - "2. O que é usado pra calcular a raridade: **BST**"
Cohesion: 0.10
Nodes (19): 1. Visão geral do fluxo, 2. O que é usado pra calcular a raridade: **BST**, 3.1 Streak de login (recompensa por presença), 3. As regras, 4.1 Achados (ranqueados por severidade), 4.2 Superfícies checadas e LIMPAS, 4.3 Integridade e concorrência (o que está CERTO — não "conserte"), 4.4 Pendências relacionadas (não são deste módulo) (+11 more)

### Community 15 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, prisma, tsx, @types/node (+11 more)

### Community 16 - "pokedexView.ts"
Cohesion: 0.18
Nodes (11): PokemonDetailPage(), HpBar(), getPokemonDetail(), DetailPanel(), PokedexGrid(), DeckSlotView, detailView, dexNumber() (+3 more)

### Community 17 - "dependencies"
Cohesion: 0.12
Nodes (17): better-auth, jose, next, dependencies, better-auth, jose, next, @prisma/client (+9 more)

### Community 18 - "syncPokedex.ts"
Cohesion: 0.24
Nodes (13): main(), parseRange(), extractIdFromUrl(), fetchEvolutionChain(), fetchSpeciesEvolutionChainId(), mapLimit(), resolveEvolutionEdge(), SyncedSpecies (+5 more)

### Community 19 - "Módulo `progression` — extração do domínio de progressão"
Cohesion: 0.14
Nodes (13): Decisões (registro), Desenho, Estrutura nova, Isolamento e contrato, Módulo `progression` — extração do domínio de progressão, Não-objetivos (fora de escopo, viram TODO), Objetivo, Problema (+5 more)

### Community 20 - "listPokedexPage.ts"
Cohesion: 0.27
Nodes (8): CatalogPage(), fetchPokemonIndex(), clampPage(), pageRange(), TOTAL_PAGES, listPokedexPage(), toPokemonCardDTO(), Pagination()

### Community 21 - "training/index.ts"
Cohesion: 0.32
Nodes (7): POST(), applyTM(), ApplyTmInput, ApplyTmResult, checkTmTeachable(), TmTeachCheck, TeachTmResponseDTO

### Community 22 - "TODO.md"
Cohesion: 0.18
Nodes (10): Aberto (achados da auditoria, ainda não corrigidos), Auditado (ver resumo abaixo), MIGRATIONS / REPRODUZIR O BANCO DO ZERO, PRISMA CLIENT GLOBAL, SEGURANCA, SEGURANÇA EM DEPLOY (VER SOBRE), TELA POKDEMON DETALHE, TODO (+2 more)

### Community 23 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 24 - "Deploy & Migrations"
Cohesion: 0.22
Nodes (8): 1. Desligar o auto-deploy Git da Vercel — FAÇA ISSO PRIMEIRO, 2. Secrets no GitHub, 3. Reconciliação de ledger — **nada a fazer** ✅, As duas contabilidades de migration, Deploy & Migrations, Gap conhecido: os jobs do pg_cron não são versionados, Rodar migrations localmente (dev), ⚠️ Setup obrigatório antes do PRIMEIRO push (só você faz)

### Community 25 - "Estrutura de arquivos"
Cohesion: 0.22
Nodes (8): Estrutura de arquivos, Global Constraints, Módulo `progression` — Plano de Implementação, Notas de execução, Task 1: Criar `progression/` e manter tudo verde por compat, Task 2: Reapontar o battle para `progression`, Task 3: Reapontar deck e packs para `progression`, Task 4: Remover o scaffold do pokedex e fechar a faxina

### Community 26 - "PokeDex"
Cohesion: 0.22
Nodes (8): Como a batalha avança por dentro, Evolução (usamos a modelagem da própria PokéAPI), Golpes liberados por nível (learnset), O jogo, PokeDex, Rodando localmente, Stack, Tudo vem da PokéAPI

### Community 27 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, migrate:deploy, seed, start, test

### Community 28 - "Rotinas do sistema — fontes de dados, crons e fair use"
Cohesion: 0.25
Nodes (7): 1. Fonte dos dados de pokémon — quem lê o quê, 2. Cron: `resolve-battle-turns` (a cada 30s), 3. Cron: `refresh-pokedex` (diário, 03:15 UTC), 4. Rotina manual: seed do espelho (por geração), 5. Fair use da PokéAPI — como cumprimos, 6. Runbook — operar os crons, Rotinas do sistema — fontes de dados, crons e fair use

### Community 29 - "token/route.ts"
Cohesion: 0.43
Nodes (4): GET(), signRealtimeToken(), createRealtimeToken(), RealtimeToken

### Community 30 - "refresh-pokedex/route.ts"
Cohesion: 0.52
Nodes (4): POST(), POST(), authorizeCron(), refreshPokedex()

### Community 31 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 32 - "resolveTurn.test.ts"
Cohesion: 0.40
Nodes (4): battleReadyToResolve(), pokemonRow(), prismaMock, tx

### Community 33 - "REALTIME.md"
Cohesion: 0.40
Nodes (4): Arquivos, Docs pra olhar, Ponto-chave de segurança, Realtime Broadcast do Supabase — resumo

### Community 34 - "generate-rarity.mjs"
Cohesion: 0.50
Nodes (4): __dirname, fetchBst(), main(), OUT

### Community 35 - "app/layout.tsx"
Cohesion: 0.40
Nodes (3): anton, metadata, rajdhani

### Community 36 - "resolveDueBattles.test.ts"
Cohesion: 0.40
Nodes (3): loadBattleForResolve, prismaMock, resolveIfDue

### Community 37 - "battleAccess.test.ts"
Cohesion: 0.40
Nodes (4): BATTLE, loadBattleForResolve, prismaMock, resolveIfDue

### Community 38 - "addToDeck.test.ts"
Cohesion: 0.40
Nodes (4): input, MOVES, prismaMock, tx

### Community 39 - "openPack.test.ts"
Cohesion: 0.50
Nodes (3): mirrorSpecies(), prismaMock, resetDefaults()

### Community 40 - "AGENTS.md"
Cohesion: 0.50
Nodes (3): A ÚNICA exceção: `realtime.messages` (implementada), Banco é Supabase: toda tabela nova nasce com RLS ligada, This is NOT the Next.js you know

### Community 41 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 42 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 43 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 44 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 47 - "applyTM.test.ts"
Cohesion: 0.50
Nodes (3): input, prismaMock, tx

## Knowledge Gaps
- **274 isolated node(s):** `supabase`, `eslintConfig`, `nextConfig`, `name`, `version` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `auth` connect `battle/index.ts` to `packs/index.ts`, `deck/index.ts`, `pokedex/index.ts`, `checkInLogin.ts`, `listPokedexPage.ts`, `training/index.ts`, `token/route.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `BattlePokemonState` connect `resolveTurn.ts` to `battle/index.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `BattleMoveDef` connect `resolveTurn.ts` to `battle/index.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `supabase`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `battle/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05280437756497948 - nodes in this community are weakly interconnected._
- **Should `resolveTurn.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.060527825588066554 - nodes in this community are weakly interconnected._
- **Should `packs/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11054421768707483 - nodes in this community are weakly interconnected._