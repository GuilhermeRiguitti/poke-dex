# Graph Report - poke-dex-next  (2026-08-07)

## Corpus Check
- 263 files · ~122,815 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1069 nodes · 2236 edges · 79 communities (59 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c1dc024`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- konva
- resolveTurn.ts
- packs/index.ts
- deck/index.ts
- progression/index.ts
- design-system/page.tsx
- battleView.ts
- compilerOptions
- What You Must Do When Invoked
- DuelStage3D.tsx
- collectionFilters.ts
- 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto
- deckBoardView.ts
- learnset.ts
- 2. O que é usado pra calcular a raridade: **BST**
- devDependencies
- toBattleDTO.ts
- dependencies
- syncPokedex.ts
- typeColor
- listPokedexPage.ts
- training/index.ts
- TODO.md
- graphify reference: extra exports and benchmark
- Deploy & Migrations
- Estrutura de arquivos
- PokeDex
- scripts
- Rotinas do sistema — fontes de dados, crons e fair use
- training/index.ts
- pokemon/index.ts
- graphify reference: query, path, explain
- resolveTurn.test.ts
- REALTIME.md
- generate-rarity.mjs
- (game)/page.tsx
- resolveDueBattles.test.ts
- battleAccess.test.ts
- StageBoundary
- openPack.test.ts
- AGENTS.md
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- package.json
- BattleRoom.tsx
- checkInLogin.test.ts
- battleView.test.ts
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- .claude/CLAUDE.md
- extraction-spec.md
- eslint.config.mjs
- LoadoutBuilder.tsx
- .mcp.json
- next.config.mjs
- applyTM.ts
- tailwindcss
- postcss.config.mjs
- enqueueBattle.test.ts
- getUnlockedMoveIds.test.ts
- getBattleState.ts
- pokedex/index.ts
- Pagination.tsx
- seed.ts
- next
- (game)/page.tsx
- battleView.ts
- @prisma/client
- app/layout.tsx
- PartyMemberView
- TurnClock.tsx
- { signIn, signUp, signOut }
- @react-three/fiber
- react-hot-toast
- listPokedexPage.ts

## God Nodes (most connected - your core abstractions)
1. `rarityTier` - 35 edges
2. `BaseStats` - 25 edges
3. `auth` - 23 edges
4. `typeColor()` - 19 edges
5. `syncPokedex()` - 17 edges
6. `compilerOptions` - 17 edges
7. `BattleMoveDef` - 16 edges
8. `resolveIfDue()` - 15 edges
9. `DeckEditorProvider()` - 15 edges
10. `BattlePokemonState` - 14 edges

## Surprising Connections (you probably didn't know these)
- `LoginForm()` --indirect_call--> `m()`  [INFERRED]
  src/modules/auth/LoginForm.tsx → tests/modules/deck/domain/defaultLoadout.test.ts
- `persistSide()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/commands/resolveTurn.ts → tests/modules/deck/domain/defaultLoadout.test.ts
- `selectDuelView()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/ui/battleView.ts → tests/modules/deck/domain/defaultLoadout.test.ts
- `main()` --calls--> `syncPokedex()`  [EXTRACTED]
  prisma/seed.ts → src/modules/pokemon/commands/syncPokedex.ts
- `rascunho()` --calls--> `draftFrom()`  [EXTRACTED]
  tests/modules/deck/ui/deckBoardView.test.ts → src/modules/deck/domain/deckDraft.ts

## Import Cycles
- None detected.

## Communities (79 total, 20 thin omitted)

### Community 0 - "konva"
Cohesion: 0.12
Nodes (23): POST(), MirrorSpecies, openPack(), OpenPackResult, canOpenFree(), nextFreePackAt(), drawPack(), weightForBst() (+15 more)

### Community 1 - "resolveTurn.ts"
Cohesion: 0.21
Nodes (13): DeckBoardStatus, DeckSlotView, DeckBoardSlotDTO, DeckCardDTO, CollectionCardRow, CollectionCardDTO, PokedexGrid(), CollectionCardView (+5 more)

### Community 2 - "packs/index.ts"
Cohesion: 0.16
Nodes (20): DesignSystemPage(), RarityRow(), PokeCard(), PokeCardDetails, PokeCardProps, SPARKLES, CARD_WIDTH, cardMetal (+12 more)

### Community 3 - "deck/index.ts"
Cohesion: 0.18
Nodes (18): CACHE_FOREVER, extractIdFromUrl(), fetchEvolutionChain(), fetchMove(), fetchSpeciesEvolutionChainId(), MoveLearnDetail, NormalizedEvolutionNode, NormalizedMove (+10 more)

### Community 4 - "progression/index.ts"
Cohesion: 0.12
Nodes (11): artworkOf(), CardDemo(), CHARIZARD, CHARMELEON, MEWTWO, PIKACHU, RARITY_ROW, rarityOf() (+3 more)

### Community 5 - "design-system/page.tsx"
Cohesion: 0.05
Nodes (41): { POST, GET }, GET(), GET(), GET(), PUT(), POST(), GET(), GET() (+33 more)

### Community 6 - "battleView.ts"
Cohesion: 0.18
Nodes (11): BattleRow, toMoveDTO(), toParticipantDTO(), toPokemonDTO(), BattleDTO, BattleEventDTO, BattleMoveDTO, BattlePokemonDTO (+3 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+20 more)

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "DuelStage3D.tsx"
Cohesion: 0.14
Nodes (12): duelCalloutFor(), DuelTurnFx, StageFallbackSprites(), AnimState, Callout(), CAM_POS, LOOK_AT, ME_POS (+4 more)

### Community 10 - "collectionFilters.ts"
Cohesion: 0.26
Nodes (17): grantXp(), maybeEvolve(), evolutionTargetFor(), applyXp(), calcHp(), calcStat(), clampLevel(), DerivedStats (+9 more)

### Community 11 - "5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto"
Cohesion: 0.06
Nodes (30): 1. O turno é SIMULTÂNEO, e a ordem é priority → Speed → sorteio, 1. Page é servidor. Sempre., 2. Nunca escreva durante o render de uma page, 2. O nível LIBERA skill — e só `level-up` conta, 3.1 Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto., 3. Stat vem da API + nível. Nada é inventado por nós, 3. Toda saída pro cliente passa por um DTO, 4. Evolução é por nível, em cadeia, e retroativa (+22 more)

### Community 12 - "deckBoardView.ts"
Cohesion: 0.08
Nodes (35): anton, cinzel, metadata, rajdhani, AppToaster(), toastWarn(), clearSlot(), countFilled() (+27 more)

### Community 13 - "learnset.ts"
Cohesion: 0.23
Nodes (10): isUnlockedAt(), LearnDetail, mergePlayableMoveIds(), METHOD_RANK, methodRank(), pickLearnEntry(), pickVersionGroup(), VERSION_GROUP_PREFERENCE (+2 more)

### Community 14 - "2. O que é usado pra calcular a raridade: **BST**"
Cohesion: 0.10
Nodes (19): 1. Visão geral do fluxo, 2. O que é usado pra calcular a raridade: **BST**, 3.1 Streak de login (recompensa por presença), 3. As regras, 4.1 Achados (ranqueados por severidade), 4.2 Superfícies checadas e LIMPAS, 4.3 Integridade e concorrência (o que está CERTO — não "conserte"), 4.4 Pendências relacionadas (não são deste módulo) (+11 more)

### Community 15 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, prisma, tsx, @types/node (+11 more)

### Community 16 - "toBattleDTO.ts"
Cohesion: 0.24
Nodes (7): PokemonDetailPage(), HpBar(), DetailPanel(), detailView, STAT_LABELS, StatBarView, PokemonMoves()

### Community 17 - "dependencies"
Cohesion: 0.12
Nodes (17): better-auth, jose, dependencies, better-auth, jose, react, react-dom, @react-three/drei (+9 more)

### Community 18 - "syncPokedex.ts"
Cohesion: 0.19
Nodes (8): DuelMonView, DuelView, turnClockView, DuelStage3D, StageBoundary, TONE, TurnClock(), useTurnClock()

### Community 19 - "typeColor"
Cohesion: 0.39
Nodes (5): clamp01(), computeHoloTilt(), HOLO_REST, HoloTilt, HoloCard()

### Community 20 - "listPokedexPage.ts"
Cohesion: 0.31
Nodes (9): CatalogPage(), fetchPokemon(), fetchPokemonIndex(), clampPage(), pageRange(), TOTAL_PAGES, listPokedexPage(), PokedexPageDTO (+1 more)

### Community 21 - "training/index.ts"
Cohesion: 0.11
Nodes (27): CollectionFilters, collectionHref(), CollectionSort, DEFAULTS, first(), hasActiveFilter(), parseCollectionFilters(), parsePage() (+19 more)

### Community 22 - "TODO.md"
Cohesion: 0.17
Nodes (11): Aberto (achados da auditoria, ainda não corrigidos), Auditado (ver resumo abaixo), JOGO — o que falta, MIGRATIONS / REPRODUZIR O BANCO DO ZERO, PRISMA CLIENT GLOBAL, SEGURANCA, SEGURANÇA EM DEPLOY (VER SOBRE), TELA POKDEMON DETALHE (+3 more)

### Community 23 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 24 - "Deploy & Migrations"
Cohesion: 0.22
Nodes (8): 1. Desligar o auto-deploy Git da Vercel — FAÇA ISSO PRIMEIRO, 2. Secrets no GitHub, 3. Reconciliação de ledger — **nada a fazer** ✅, As duas contabilidades de migration, Deploy & Migrations, Gap conhecido: os jobs do pg_cron não são versionados, Rodar migrations localmente (dev), ⚠️ Setup obrigatório antes do PRIMEIRO push (só você faz)

### Community 25 - "Estrutura de arquivos"
Cohesion: 0.23
Nodes (10): CollectionPageProps, HomePage(), deckBoardView, useDeckEditor(), DeckPanel(), CollectionCardActions(), CollectionCardDrag(), CollectionDropZone() (+2 more)

### Community 26 - "PokeDex"
Cohesion: 0.22
Nodes (8): Como a batalha avança por dentro, Evolução (usamos a modelagem da própria PokéAPI), Golpes liberados por nível (learnset), O jogo, PokeDex, Rodando localmente, Stack, Tudo vem da PokéAPI

### Community 27 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, migrate:deploy, seed, start, test

### Community 28 - "Rotinas do sistema — fontes de dados, crons e fair use"
Cohesion: 0.25
Nodes (7): 1. Fonte dos dados de pokémon — quem lê o quê, 2. Cron: `resolve-battle-turns` (a cada 30s), 3. Cron: `refresh-pokedex` (diário, 03:15 UTC), 4. Rotina manual: seed do espelho (por geração), 5. Fair use da PokéAPI — como cumprimos, 6. Runbook — operar os crons, Rotinas do sistema — fontes de dados, crons e fair use

### Community 29 - "training/index.ts"
Cohesion: 0.11
Nodes (18): 1. Onde o pokémon mora hoje, 2. O que fica em cada módulo, 3. Estrutura alvo, 4. Plano de migração — etapas, 5. O que NÃO se move (e por quê), 6. Riscos, 7. Verificação, Etapa 0 — commitar o que está pendente (+10 more)

### Community 30 - "pokemon/index.ts"
Cohesion: 0.35
Nodes (6): NormalizedPokemon, getPokemonDetail(), toPokemonDetailDTO(), PokemonCardDTO, PokemonDetailDTO, PokemonStatDTO

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

### Community 35 - "(game)/page.tsx"
Cohesion: 0.29
Nodes (7): POST(), POST(), authorizeCron(), refreshPokedex(), RefreshPokedexOptions, RefreshPokedexSummary, SyncPokedexSummary

### Community 36 - "resolveDueBattles.test.ts"
Cohesion: 0.40
Nodes (3): loadBattleForResolve, prismaMock, resolveIfDue

### Community 37 - "battleAccess.test.ts"
Cohesion: 0.40
Nodes (4): BATTLE, loadBattleForResolve, prismaMock, resolveIfDue

### Community 38 - "StageBoundary"
Cohesion: 0.07
Nodes (52): POST(), GET(), BattlePage(), CombatantRow, loadXpContext(), xpAwardsOf(), XpContext, buildTypeChart() (+44 more)

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

### Community 45 - "BattleRoom.tsx"
Cohesion: 0.31
Nodes (6): BattleErrorToast(), BattleRoom(), CHANNEL_EVENTS, useBattleRoom(), getSupabaseClient(), useRealtimeChannel()

### Community 47 - "battleView.test.ts"
Cohesion: 0.24
Nodes (6): DuelLogLine, duelLogMark, CombatLog(), TONE_CLASS, battle(), mon()

### Community 53 - "LoadoutBuilder.tsx"
Cohesion: 0.08
Nodes (53): RoundParams, calculateDamage(), DamageResult, DamageRollParams, rollAccuracy(), rollCrit(), applyForcedSwitch(), applyLeadLoadout() (+45 more)

### Community 56 - "applyTM.ts"
Cohesion: 0.31
Nodes (6): POST(), applyTM(), ApplyTmInput, ApplyTmResult, checkTmTeachable(), TmTeachCheck

### Community 57 - "tailwindcss"
Cohesion: 0.07
Nodes (38): DELETE(), POST(), fetchType(), NormalizedType, CacheKey, fetchAndCache(), fetchAndCacheType(), globalForPrisma (+30 more)

### Community 61 - "getUnlockedMoveIds.test.ts"
Cohesion: 0.33
Nodes (4): BattleQueuePage(), getQueueDeck(), BattleMatchmaker(), QueueDeckDTO

### Community 63 - "getBattleState.ts"
Cohesion: 0.36
Nodes (6): birthLevelForSpecies(), EvolutionChainNode, EvolutionDetail, EvolutionEdge, parseLevelUpEvolutions(), bulbaChain

### Community 65 - "pokedex/index.ts"
Cohesion: 0.53
Nodes (3): DELETE(), removeCard(), RemoveCardResult

### Community 69 - "(game)/page.tsx"
Cohesion: 0.50
Nodes (3): input, prismaMock, tx

### Community 70 - "battleView.ts"
Cohesion: 0.16
Nodes (15): activeMon(), DuelCalloutView, DuelCardView, DuelLogKind, DuelMode, eventLine(), hpPctOf(), PartyMemberView (+7 more)

### Community 86 - "listPokedexPage.ts"
Cohesion: 0.13
Nodes (13): TypeBadge(), TYPE_COLORS, typeColor(), LoadoutPicker(), CLASS_META, MoveButton(), DeckSlotCard(), Linha() (+5 more)

## Knowledge Gaps
- **316 isolated node(s):** `supabase`, `eslintConfig`, `nextConfig`, `name`, `version` (+311 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `rarityTier` connect `resolveTurn.ts` to `konva`, `packs/index.ts`, `deck/index.ts`, `progression/index.ts`, `battleView.ts`, `battleView.ts`, `training/index.ts`, `tailwindcss`, `pokemon/index.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `auth` connect `design-system/page.tsx` to `pokedex/index.ts`, `StageBoundary`, `listPokedexPage.ts`, `applyTM.ts`, `tailwindcss`, `getUnlockedMoveIds.test.ts`, `Estrutura de arquivos`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `BaseStats` connect `resolveTurn.ts` to `konva`, `packs/index.ts`, `deck/index.ts`, `progression/index.ts`, `collectionFilters.ts`, `tailwindcss`, `pokemon/index.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `supabase`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _316 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `konva` be split into smaller, more focused modules?**
  _Cohesion score 0.11861861861861862 - nodes in this community are weakly interconnected._
- **Should `progression/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._
- **Should `design-system/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05228070175438596 - nodes in this community are weakly interconnected._