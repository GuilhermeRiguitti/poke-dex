# Graph Report - poke-dex-next  (2026-08-03)

## Corpus Check
- 256 files · ~121,190 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1056 nodes · 2242 edges · 91 communities (71 shown, 20 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `78eafc3b`
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
- Plano — duelo tático 1v1 fiel à série
- collectionFilters.ts
- 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto
- deckBoardView.ts
- checkInLogin.ts
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
- battleView.ts
- BattleRoom.tsx
- graphify reference: query, path, explain
- resolveTurn.test.ts
- REALTIME.md
- generate-rarity.mjs
- (game)/page.tsx
- resolveDueBattles.test.ts
- battleAccess.test.ts
- addToDeck.test.ts
- openPack.test.ts
- AGENTS.md
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- package.json
- openPack.ts
- checkInLogin.test.ts
- applyTM.test.ts
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- .claude/CLAUDE.md
- extraction-spec.md
- eslint.config.mjs
- LoadoutBuilder.tsx
- .mcp.json
- next.config.mjs
- battleView.test.ts
- submitAction.ts
- postcss.config.mjs
- enqueueBattle.test.ts
- getUnlockedMoveIds.test.ts
- reorderDeck.test.ts
- order/route.ts
- toBattleDTO.ts
- battleView.ts
- resolveDueBattles.ts
- PackOpener.tsx
- token/route.ts
- queue/status/route.ts
- queue/route.ts
- PartyMemberView
- duelEngine.test.ts
- DuelArena.tsx
- @prisma/client
- react-hot-toast
- @react-three/fiber
- three
- syncPokedex.ts
- rules.ts
- pokeapi.ts
- deck/index.ts
- pokedex/types.ts
- prisma.ts
- listPokedexPage.ts
- rarity.ts
- toDeckBoardDTO.ts
- damage.ts
- typeChart.ts

## God Nodes (most connected - your core abstractions)
1. `rarityTier` - 35 edges
2. `auth` - 25 edges
3. `BaseStats` - 25 edges
4. `typeColor()` - 18 edges
5. `BattleMoveDef` - 17 edges
6. `syncPokedex()` - 17 edges
7. `compilerOptions` - 17 edges
8. `resolveIfDue()` - 15 edges
9. `BattlePokemonState` - 15 edges
10. `parseCollectionFilters()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `persistSide()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/commands/resolveTurn.ts → tests/modules/deck/domain/defaultLoadout.test.ts
- `selectDuelView()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/ui/battleView.ts → tests/modules/deck/domain/defaultLoadout.test.ts
- `LoginForm()` --indirect_call--> `m()`  [INFERRED]
  src/modules/auth/LoginForm.tsx → tests/modules/deck/domain/defaultLoadout.test.ts
- `active()` --calls--> `activeOf()`  [EXTRACTED]
  tests/modules/battle/domain/duelEngine.test.ts → src/modules/battle/domain/duelTypes.ts
- `main()` --calls--> `syncPokedex()`  [EXTRACTED]
  prisma/seed.ts → src/modules/pokedex/commands/syncPokedex.ts

## Import Cycles
- None detected.

## Communities (91 total, 20 thin omitted)

### Community 1 - "resolveTurn.ts"
Cohesion: 0.14
Nodes (25): loadXpContext(), XpContext, buildTypeChart(), ActionRow, BattleForResolve, commit(), CommitParams, fullBattleInclude (+17 more)

### Community 2 - "packs/index.ts"
Cohesion: 0.10
Nodes (26): artworkOf(), CardDemo(), CHARIZARD, CHARMELEON, DesignSystemPage(), MEWTWO, PIKACHU, RARITY_ROW (+18 more)

### Community 3 - "deck/index.ts"
Cohesion: 0.24
Nodes (11): getDeckSummary(), DeckLoadoutSlot, deckOfUser(), getOrCreateDeck(), DAMAGE_CLASSES, DeckSlotRow, toDeckSlotDTO(), toDeckSummaryDTO() (+3 more)

### Community 4 - "progression/index.ts"
Cohesion: 0.11
Nodes (39): awardBattleXp(), CombatantRow, maybeEvolve(), XpAward, SyncedSpecies, getUnlockedMoveIds(), birthLevelForSpecies(), EvolutionChainNode (+31 more)

### Community 5 - "design-system/page.tsx"
Cohesion: 0.09
Nodes (24): POST(), CardsIcon(), CloseIcon(), GridIcon(), MenuIcon(), PackIcon(), PokeballIcon(), SwordsIcon() (+16 more)

### Community 6 - "battleView.ts"
Cohesion: 0.14
Nodes (12): duelCalloutFor(), DuelTurnFx, StageFallbackSprites(), AnimState, Callout(), CAM_POS, LOOK_AT, ME_POS (+4 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+20 more)

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "Plano — duelo tático 1v1 fiel à série"
Cohesion: 0.08
Nodes (24): 10. Riscos / o que quebra (honestidade), 11. Decisões, 1. A visão em um parágrafo, 2. Decisões travadas × decisões abertas, 3.1 Ordem dentro do turno (`domain/turnOrder.ts`), 3.2 Economia de energia (a tensão de "gastar ou guardar")  *(fatia A2)*, 3.3 Janela de reação *(reavaliar)*, 3.4 Como o motor ficou (+16 more)

### Community 10 - "collectionFilters.ts"
Cohesion: 0.17
Nodes (18): collectionHref(), DEFAULTS, first(), hasActiveFilter(), parseCollectionFilters(), parsePage(), POKEMON_TYPES, RARITY_TIERS (+10 more)

### Community 11 - "5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto"
Cohesion: 0.08
Nodes (24): 1. Page é servidor. Sempre., 2. Nunca escreva durante o render de uma page, 3.1 Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto., 3. Toda saída pro cliente passa por um DTO, 4. Lógica de apresentação sai do componente, 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto, 6. Concorrência: assuma duas lambdas ao mesmo tempo, Arquitetura (+16 more)

### Community 12 - "deckBoardView.ts"
Cohesion: 0.07
Nodes (32): CollectionPageProps, HomePage(), anton, cinzel, metadata, rajdhani, AppToaster(), toastWarn() (+24 more)

### Community 13 - "checkInLogin.ts"
Cohesion: 0.23
Nodes (11): CollectionFilters, CollectionSort, buildCollectionWhere(), orderByFor(), getCollectionQuery(), COLLECTION_CARD_SELECT, CollectionCardRow, toCollectionCardDTO() (+3 more)

### Community 14 - "2. O que é usado pra calcular a raridade: **BST**"
Cohesion: 0.10
Nodes (19): 1. Visão geral do fluxo, 2. O que é usado pra calcular a raridade: **BST**, 3.1 Streak de login (recompensa por presença), 3. As regras, 4.1 Achados (ranqueados por severidade), 4.2 Superfícies checadas e LIMPAS, 4.3 Integridade e concorrência (o que está CERTO — não "conserte"), 4.4 Pendências relacionadas (não são deste módulo) (+11 more)

### Community 15 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, prisma, tsx, @types/node (+11 more)

### Community 16 - "toBattleDTO.ts"
Cohesion: 0.24
Nodes (11): GET(), resolveDueBattles(), ResolveDueSummary, expiredTurnWindows(), loadBattleForResolve(), orderedSides(), resolveIfDue(), BattleParticipants (+3 more)

### Community 17 - "dependencies"
Cohesion: 0.11
Nodes (19): better-auth, next, dependencies, better-auth, next, @prisma/client, react, react-dom (+11 more)

### Community 19 - "typeColor"
Cohesion: 0.39
Nodes (5): clamp01(), computeHoloTilt(), HOLO_REST, HoloTilt, HoloCard()

### Community 20 - "listPokedexPage.ts"
Cohesion: 0.16
Nodes (20): BattleTeamMember, buildDuelSnapshot(), defaultMovesFor(), toPokemonState(), enqueueBattle(), toPokemonCreateInput(), tryResolveTurn(), DamageRollParams (+12 more)

### Community 21 - "training/index.ts"
Cohesion: 0.12
Nodes (17): POST(), TypeBadge(), typeColor(), DuelCardView, LoadoutPicker(), CLASS_META, MoveButton(), DeckSlotCard() (+9 more)

### Community 22 - "TODO.md"
Cohesion: 0.18
Nodes (10): Aberto (achados da auditoria, ainda não corrigidos), Auditado (ver resumo abaixo), MIGRATIONS / REPRODUZIR O BANCO DO ZERO, PRISMA CLIENT GLOBAL, SEGURANCA, SEGURANÇA EM DEPLOY (VER SOBRE), TELA POKDEMON DETALHE, TODO (+2 more)

### Community 23 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 24 - "Deploy & Migrations"
Cohesion: 0.22
Nodes (8): 1. Desligar o auto-deploy Git da Vercel — FAÇA ISSO PRIMEIRO, 2. Secrets no GitHub, 3. Reconciliação de ledger — **nada a fazer** ✅, As duas contabilidades de migration, Deploy & Migrations, Gap conhecido: os jobs do pg_cron não são versionados, Rodar migrations localmente (dev), ⚠️ Setup obrigatório antes do PRIMEIRO push (só você faz)

### Community 26 - "PokeDex"
Cohesion: 0.22
Nodes (8): Como a batalha avança por dentro, Evolução (usamos a modelagem da própria PokéAPI), Golpes liberados por nível (learnset), O jogo, PokeDex, Rodando localmente, Stack, Tudo vem da PokéAPI

### Community 27 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, migrate:deploy, seed, start, test

### Community 28 - "Rotinas do sistema — fontes de dados, crons e fair use"
Cohesion: 0.25
Nodes (7): 1. Fonte dos dados de pokémon — quem lê o quê, 2. Cron: `resolve-battle-turns` (a cada 30s), 3. Cron: `refresh-pokedex` (diário, 03:15 UTC), 4. Rotina manual: seed do espelho (por geração), 5. Fair use da PokéAPI — como cumprimos, 6. Runbook — operar os crons, Rotinas do sistema — fontes de dados, crons e fair use

### Community 30 - "BattleRoom.tsx"
Cohesion: 0.31
Nodes (6): BattleErrorToast(), BattleRoom(), CHANNEL_EVENTS, useBattleRoom(), getSupabaseBrowser(), useRealtimeChannel()

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
Cohesion: 0.27
Nodes (10): Specimen, DeckBoardSlotDTO, rarityTier, toPackCardDTO(), PackCardDTO, PokemonCardDTO, PokeCardDetails, BaseStats (+2 more)

### Community 36 - "resolveDueBattles.test.ts"
Cohesion: 0.40
Nodes (3): loadBattleForResolve, prismaMock, resolveIfDue

### Community 37 - "battleAccess.test.ts"
Cohesion: 0.40
Nodes (4): BATTLE, loadBattleForResolve, prismaMock, resolveIfDue

### Community 38 - "addToDeck.test.ts"
Cohesion: 0.33
Nodes (3): input, prismaMock, tx

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

### Community 45 - "openPack.ts"
Cohesion: 0.29
Nodes (11): MirrorSpecies, openPack(), OpenPackResult, canOpenFree(), nextFreePackAt(), readPackState(), toPackStateDTO(), OpenPackResultDTO (+3 more)

### Community 47 - "applyTM.test.ts"
Cohesion: 0.50
Nodes (3): input, prismaMock, tx

### Community 53 - "LoadoutBuilder.tsx"
Cohesion: 0.21
Nodes (20): applyForcedSwitch(), applyLeadLoadout(), applyVoluntarySwitch(), cloneState(), equipOnEntry(), executeAttack(), forcedTarget(), hasUsableCard() (+12 more)

### Community 56 - "battleView.test.ts"
Cohesion: 0.24
Nodes (6): DuelLogLine, duelLogMark, CombatLog(), TONE_CLASS, battle(), mon()

### Community 57 - "submitAction.ts"
Cohesion: 0.20
Nodes (11): POST(), LoadoutErro, LoadoutOk, mustSwitch(), ParticipantWithMons, persist(), submitAction(), SubmitActionInput (+3 more)

### Community 65 - "order/route.ts"
Cohesion: 0.18
Nodes (9): { POST, GET }, GET(), GET(), DELETE(), POST(), PacksPage(), auth, getQueueStatus() (+1 more)

### Community 66 - "toBattleDTO.ts"
Cohesion: 0.60
Nodes (3): BattlePage(), readBattleState(), BattleRoomShell()

### Community 67 - "battleView.ts"
Cohesion: 0.23
Nodes (12): activeMon(), DuelCalloutView, DuelLogKind, DuelMode, eventLine(), hpPctOf(), prettyName(), selectDuelView() (+4 more)

### Community 68 - "resolveDueBattles.ts"
Cohesion: 0.25
Nodes (9): POST(), POST(), authorizeCron(), refreshPokedex(), RefreshPokedexOptions, RefreshPokedexSummary, RemoveCardResult, SyncPokedexOptions (+1 more)

### Community 69 - "PackOpener.tsx"
Cohesion: 0.24
Nodes (10): StreakPage(), PackOpener(), Phase, formatCountdown(), packStatusView, RARITY_COLOR, RARITY_HOLO, RARITY_LABEL (+2 more)

### Community 70 - "token/route.ts"
Cohesion: 0.43
Nodes (4): GET(), signRealtimeToken(), createRealtimeToken(), RealtimeToken

### Community 71 - "queue/status/route.ts"
Cohesion: 0.16
Nodes (15): BattleQueuePage(), getQueueDeck(), BattleRow, toMoveDTO(), toParticipantDTO(), toPokemonDTO(), BattleMatchmaker(), BattleDTO (+7 more)

### Community 72 - "queue/route.ts"
Cohesion: 0.50
Nodes (3): DELETE(), POST(), leaveQueue()

### Community 73 - "PartyMemberView"
Cohesion: 0.16
Nodes (12): PokemonDetailPage(), HpBar(), PackRevealCard(), DetailPanel(), PokedexGrid(), CollectionCardView, CollectionEmptyState, detailView (+4 more)

### Community 74 - "duelEngine.test.ts"
Cohesion: 0.22
Nodes (12): startDuel(), active(), combatant(), hitCard(), makeDuelSide(), neutralChart, sideOf(), statusCard() (+4 more)

### Community 75 - "DuelArena.tsx"
Cohesion: 0.15
Nodes (5): DuelMonView, DuelView, PartyMemberView, DuelStage3D, StageBoundary

### Community 80 - "syncPokedex.ts"
Cohesion: 0.27
Nodes (12): main(), parseRange(), extractIdFromUrl(), fetchEvolutionChain(), fetchMove(), fetchSpeciesEvolutionChainId(), mapLimit(), resolveEvolutionEdge() (+4 more)

### Community 81 - "rules.ts"
Cohesion: 0.24
Nodes (8): POST(), addToDeck(), AddToDeckInput, defaultLoadout(), LoadoutCandidate, firstFreeOrder(), isDeckFull(), moveSlot()

### Community 82 - "pokeapi.ts"
Cohesion: 0.21
Nodes (10): CACHE_FOREVER, fetchType(), MoveLearnDetail, NormalizedEvolutionNode, NormalizedMove, NormalizedType, PokemonIndexEntry, CacheKey (+2 more)

### Community 83 - "deck/index.ts"
Cohesion: 0.29
Nodes (7): DELETE(), PATCH(), AddToDeckResult, removeFromDeck(), RemoveFromDeckResult, reorderDeck(), ReorderDeckResult

### Community 84 - "pokedex/types.ts"
Cohesion: 0.30
Nodes (7): fetchPokemon(), NormalizedPokemon, getPokemonDetail(), toPokemonCardDTO(), toPokemonDetailDTO(), PokemonDetailDTO, PokemonStatDTO

### Community 85 - "prisma.ts"
Cohesion: 0.27
Nodes (6): GET(), GET(), globalForPrisma, getLoadoutOptions(), readLearnset(), readTmTokens()

### Community 86 - "listPokedexPage.ts"
Cohesion: 0.36
Nodes (7): CatalogPage(), fetchPokemonIndex(), clampPage(), pageRange(), TOTAL_PAGES, listPokedexPage(), PokedexPageDTO

### Community 87 - "rarity.ts"
Cohesion: 0.46
Nodes (4): bstOf(), drawPack(), BST_BY_ID, weightForBst()

### Community 88 - "toDeckBoardDTO.ts"
Cohesion: 0.43
Nodes (5): getDeckBoardQuery(), DECK_BOARD_SLOT_SELECT, DeckBoardSlotRow, toDeckBoardSlotDTO(), DeckBoardDTO

### Community 89 - "damage.ts"
Cohesion: 0.60
Nodes (4): calculateDamage(), DamageResult, rollAccuracy(), rollCrit()

### Community 90 - "typeChart.ts"
Cohesion: 0.60
Nodes (3): effectivenessMultiplier(), TypeEffectivenessMap, chart

## Knowledge Gaps
- **305 isolated node(s):** `supabase`, `eslintConfig`, `nextConfig`, `name`, `version` (+300 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `rarityTier` connect `(game)/page.tsx` to `packs/index.ts`, `battleView.ts`, `deck/index.ts`, `PackOpener.tsx`, `queue/status/route.ts`, `PartyMemberView`, `collectionFilters.ts`, `DuelArena.tsx`, `deckBoardView.ts`, `openPack.ts`, `checkInLogin.ts`, `syncPokedex.ts`, `pokedex/types.ts`, `rarity.ts`, `toDeckBoardDTO.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `BattleMoveDef` connect `listPokedexPage.ts` to `resolveTurn.ts`, `queue/status/route.ts`, `duelEngine.test.ts`, `LoadoutBuilder.tsx`, `damage.ts`, `submitAction.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `BaseStats` connect `(game)/page.tsx` to `packs/index.ts`, `deck/index.ts`, `progression/index.ts`, `PartyMemberView`, `deckBoardView.ts`, `openPack.ts`, `checkInLogin.ts`, `syncPokedex.ts`, `pokedex/types.ts`, `toDeckBoardDTO.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `supabase`, `eslintConfig`, `nextConfig` to the rest of the system?**
  _305 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `resolveTurn.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._
- **Should `packs/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `progression/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1054421768707483 - nodes in this community are weakly interconnected._