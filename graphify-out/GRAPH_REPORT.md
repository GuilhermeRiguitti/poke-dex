# Graph Report - poke-dex-next  (2026-08-14)

## Corpus Check
- 339 files · ~169,300 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1393 nodes · 3142 edges · 111 communities (92 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `db6e7204`
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
- buildDuelSnapshot.ts
- duelEngineEffects.test.ts
- @react-three/fiber
- submitAction.ts
- prisma.ts
- react-hot-toast
- auth.ts
- toBattleDTO
- damage.ts
- token/route.ts
- listPokedexPage.ts
- app/layout.tsx
- deckBoardView.test.ts
- bstOf
- turnClock.ts
- PartyMemberView
- BattleStatusDTO
- react
- react-dom
- @react-three/drei
- getCollectionPage.ts
- saveDeck.test.ts
- offer/[id]/route.ts
- tradeRules.ts
- breedPokemon.test.ts
- acceptTradeOffer.test.ts
- trade/page.tsx
- rateLimit.test.ts
- next
- @prisma/client
- server-only
- tailwindcss
- @tailwindcss/postcss

## God Nodes (most connected - your core abstractions)
1. `rarityTier` - 35 edges
2. `auth` - 31 edges
3. `enforceRateLimit()` - 26 edges
4. `BaseStats` - 25 edges
5. `BattleMoveDef` - 20 edges
6. `typeColor()` - 19 edges
7. `conditionsOf()` - 19 edges
8. `resolveRound()` - 19 edges
9. `resolveIfDue()` - 18 edges
10. `syncPokedex()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `LoginForm()` --indirect_call--> `m()`  [INFERRED]
  src/modules/auth/LoginForm.tsx → tests/modules/deck/domain/defaultLoadout.test.ts
- `persistSide()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/commands/resolveTurn.ts → tests/modules/deck/domain/defaultLoadout.test.ts
- `applyEndOfTurn()` --indirect_call--> `side()`  [INFERRED]
  src/modules/battle/domain/duelEngine.ts → tests/modules/battle/domain/duelEngineEffects.test.ts
- `applyForcedSwitch()` --indirect_call--> `side()`  [INFERRED]
  src/modules/battle/domain/duelEngine.ts → tests/modules/battle/domain/duelEngineEffects.test.ts
- `affordableSlots()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/domain/energy.ts → tests/modules/deck/domain/defaultLoadout.test.ts

## Import Cycles
- None detected.

## Communities (111 total, 19 thin omitted)

### Community 0 - "konva"
Cohesion: 0.18
Nodes (15): PacksPage(), MirrorSpecies, openPack(), OpenPackResult, canOpenFree(), nextFreePackAt(), readPackState(), toPackStateDTO() (+7 more)

### Community 1 - "resolveTurn.ts"
Cohesion: 0.15
Nodes (30): accuracyFactor(), accuracyStageMultiplier(), actionGate, AILMENT_TYPE_IMMUNITY, AilmentBlock, ailmentBlockedBy(), AppliedAilment, AppliedStage (+22 more)

### Community 2 - "packs/index.ts"
Cohesion: 0.17
Nodes (16): CollectionFilters, CollectionCardRow, CollectionCardDTO, CollectionPageDTO, PokedexPageDTO, PokedexGrid(), CollectionCardView, CollectionEmptyState (+8 more)

### Community 3 - "deck/index.ts"
Cohesion: 0.23
Nodes (14): main(), parseRange(), extractIdFromUrl(), fetchEvolutionChain(), fetchSpecies(), mapLimit(), resolveSpecies(), SyncedSpecies (+6 more)

### Community 4 - "progression/index.ts"
Cohesion: 0.09
Nodes (37): POST(), BreedingPage(), StreakPage(), isSameUtcDay(), startOfUtcDay(), utcDayIndex(), checkInLogin(), alreadyCheckedInToday() (+29 more)

### Community 5 - "design-system/page.tsx"
Cohesion: 0.13
Nodes (14): CardsIcon(), CloseIcon(), EggIcon(), GridIcon(), MenuIcon(), PackIcon(), PokeballIcon(), SwordsIcon() (+6 more)

### Community 6 - "battleView.ts"
Cohesion: 0.19
Nodes (12): STAGE_STATS, absenceRemainingMs(), absentOutcome, isAbsent(), isPresent(), BattleRow, toBattleDTO(), toConditionsDTO() (+4 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+20 more)

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "DuelStage3D.tsx"
Cohesion: 0.11
Nodes (14): duelCalloutFor(), DuelCalloutView, DuelTurnFx, StageFallbackSprites(), TONE, AnimState, Callout(), CAM_POS (+6 more)

### Community 10 - "collectionFilters.ts"
Cohesion: 0.18
Nodes (25): grantXp(), maybeEvolve(), GrowthRate, levelFromXpOn(), normalizeGrowthRate(), RATES, tableFor(), TABLES (+17 more)

### Community 11 - "5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto"
Cohesion: 0.07
Nodes (28): 1. Page é servidor. Sempre., 2. Nunca escreva durante o render de uma page, 3.1 Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto., 3. Toda saída pro cliente passa por um DTO, 4. Lógica de apresentação sai do componente, 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto, 6. Concorrência: assuma duas lambdas ao mesmo tempo, Arquitetura (+20 more)

### Community 12 - "deckBoardView.ts"
Cohesion: 0.21
Nodes (19): clearSlot(), countFilled(), DeckDraft, DraftCard, draftToSlots(), firstFreeIndex(), indexOfCard(), isSlotIndex() (+11 more)

### Community 13 - "learnset.ts"
Cohesion: 0.36
Nodes (6): LearnDetail, METHOD_RANK, methodRank(), pickLearnEntry(), pickVersionGroup(), VERSION_GROUP_PREFERENCE

### Community 14 - "2. O que é usado pra calcular a raridade: **BST**"
Cohesion: 0.10
Nodes (19): 1. Visão geral do fluxo, 2. O que é usado pra calcular a raridade: **BST**, 3.1 Streak de login (recompensa por presença), 3. As regras, 4.1 Achados (ranqueados por severidade), 4.2 Superfícies checadas e LIMPAS, 4.3 Integridade e concorrência (o que está CERTO — não "conserte"), 4.4 Pendências relacionadas (não são deste módulo) (+11 more)

### Community 15 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, prisma, tsx, @types/node (+11 more)

### Community 16 - "toBattleDTO.ts"
Cohesion: 0.23
Nodes (8): PokemonDetailPage(), HpBar(), getPokemonDetail(), DetailPanel(), detailView, STAT_LABELS, StatBarView, PokemonMoves()

### Community 17 - "dependencies"
Cohesion: 0.11
Nodes (19): better-auth, jose, dependencies, better-auth, jose, react, react-dom, react-hot-toast (+11 more)

### Community 18 - "syncPokedex.ts"
Cohesion: 0.53
Nodes (4): turnClockView, TONE, TurnClock(), useTurnClock()

### Community 19 - "typeColor"
Cohesion: 0.39
Nodes (5): clamp01(), computeHoloTilt(), HOLO_REST, HoloTilt, HoloCard()

### Community 20 - "listPokedexPage.ts"
Cohesion: 0.25
Nodes (13): applyForcedSwitch(), applyLeadLoadout(), applyVoluntarySwitch(), cloneState(), equipOnEntry(), forcedTarget(), outcome(), activeOf() (+5 more)

### Community 21 - "training/index.ts"
Cohesion: 0.21
Nodes (15): collectionHref(), DEFAULTS, first(), hasActiveFilter(), parseCollectionFilters(), parsePage(), POKEMON_TYPES, RARITY_TIERS (+7 more)

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
Cohesion: 0.09
Nodes (30): artworkOf(), CardDemo(), CHARIZARD, CHARMELEON, DesignSystemPage(), MEWTWO, PIKACHU, RARITY_ROW (+22 more)

### Community 26 - "PokeDex"
Cohesion: 0.13
Nodes (14): Como a batalha avança por dentro, Energia: a escolha de cada rodada, Escudo: apostar em vez de reagir, Evolução (usamos a modelagem da própria PokéAPI), Fora da batalha, Golpes liberados por nível (learnset), O jogo, Os números saem da fórmula da série (+6 more)

### Community 27 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:reset, dev, lint, migrate:deploy, seed, start (+1 more)

### Community 28 - "Rotinas do sistema — fontes de dados, crons e fair use"
Cohesion: 0.25
Nodes (7): 1. Fonte dos dados de pokémon — quem lê o quê, 2. Cron: `resolve-battle-turns` (a cada 30s), 3. Cron: `refresh-pokedex` — ⛔ **DESLIGADO no prod (2026-08-14)**, 4. Rotina manual: seed do espelho (por geração), 5. Fair use da PokéAPI — como cumprimos, 6. Runbook — operar os crons, Rotinas do sistema — fontes de dados, crons e fair use

### Community 29 - "training/index.ts"
Cohesion: 0.11
Nodes (18): 1. Onde o pokémon mora hoje, 2. O que fica em cada módulo, 3. Estrutura alvo, 4. Plano de migração — etapas, 5. O que NÃO se move (e por quê), 6. Riscos, 7. Verificação, Etapa 0 — commitar o que está pendente (+10 more)

### Community 30 - "pokemon/index.ts"
Cohesion: 0.27
Nodes (9): GET(), ResolveDueSummary, loadBattleForResolve(), orderedSides(), resolveIfDue(), BattleParticipants, isParticipant(), getBattleState() (+1 more)

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
Cohesion: 0.52
Nodes (4): POST(), POST(), authorizeCron(), resolveDueBattles()

### Community 36 - "resolveDueBattles.test.ts"
Cohesion: 0.40
Nodes (3): loadBattleForResolve, prismaMock, resolveIfDue

### Community 37 - "battleAccess.test.ts"
Cohesion: 0.40
Nodes (4): BATTLE, loadBattleForResolve, prismaMock, resolveIfDue

### Community 38 - "StageBoundary"
Cohesion: 0.16
Nodes (21): CombatantRow, loadXpContext(), xpAwardsOf(), XpContext, ActionRow, BattleForResolve, commit(), fullBattleInclude (+13 more)

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
Cohesion: 0.29
Nodes (7): BattleErrorToast(), BattleRoom(), BattleDTO, CHANNEL_EVENTS, useBattleRoom(), getSupabaseClient(), useRealtimeChannel()

### Community 47 - "battleView.test.ts"
Cohesion: 0.24
Nodes (6): DuelLogLine, duelLogMark, CombatLog(), TONE_CLASS, battle(), mon()

### Community 53 - "LoadoutBuilder.tsx"
Cohesion: 0.14
Nodes (20): BattleTeamMember, toPokemonState(), CommitParams, RoundParams, MonConditions, DamageRollParams, AttackContext, DuelResult (+12 more)

### Community 54 - ".mcp.json"
Cohesion: 0.40
Nodes (4): SUPABASE_ACCESS_TOKEN, npx, supabase, @supabase/mcp-server-supabase

### Community 56 - "applyTM.ts"
Cohesion: 0.06
Nodes (47): GET(), GET(), POST(), GET(), POST(), POST(), globalForPrisma, getLoadoutOptions() (+39 more)

### Community 57 - "tailwindcss"
Cohesion: 0.22
Nodes (13): saveDeck(), SaveDeckResult, validateDeckSlots(), getDeckBoardQuery(), getDeckSummary(), DeckLoadoutSlot, deckOfUser(), getOrCreateDeck() (+5 more)

### Community 61 - "getUnlockedMoveIds.test.ts"
Cohesion: 0.14
Nodes (13): BattleQueuePage(), NonVolatileAilment, getQueueDeck(), BattleMatchmaker(), DuelView, BattleEventDTO, BattleMoveDTO, BattlePokemonDTO (+5 more)

### Community 63 - "getBattleState.ts"
Cohesion: 0.33
Nodes (7): birthLevelForSpecies(), EvolutionChainNode, EvolutionDetail, EvolutionEdge, evolutionTargetFor(), parseLevelUpEvolutions(), bulbaChain

### Community 65 - "pokedex/index.ts"
Cohesion: 0.13
Nodes (17): CACHE_FOREVER, fetchMove(), fetchSpeciesEvolutionChainId(), fetchType(), MoveLearnDetail, NormalizedEvolutionNode, NormalizedMove, NormalizedMoveEffect (+9 more)

### Community 66 - "Pagination.tsx"
Cohesion: 0.10
Nodes (29): protectChance(), resolveRound(), startDuel(), MoveEffect, active(), combatant(), hitCard(), makeDuelSide() (+21 more)

### Community 67 - "seed.ts"
Cohesion: 0.17
Nodes (8): defaultMovesFor(), defaultLoadout(), LoadoutCandidate, isDeckFull(), DeckSlotInput, DeckSlotsIssue, deckSlotsIssueMessage(), ValidateDeckSlotsResult

### Community 68 - "next"
Cohesion: 0.20
Nodes (15): POST(), POST(), acceptTradeOffer(), AcceptTradeOfferInput, AcceptTradeOfferResult, TradeConflictError, createTradeOffer(), CreateTradeOfferInput (+7 more)

### Community 69 - "(game)/page.tsx"
Cohesion: 0.50
Nodes (3): input, prismaMock, tx

### Community 70 - "battleView.ts"
Cohesion: 0.15
Nodes (23): activeMon(), AILMENT_LABEL, AILMENT_VERB, ailmentLabel(), BLOCK_LABEL, CONDITION_HINT, conditionBadges(), DuelLogKind (+15 more)

### Community 71 - "@prisma/client"
Cohesion: 0.32
Nodes (8): PackOpener(), Phase, PackRevealCard(), formatCountdown(), packStatusView, OpenPackResultDTO, PackStateDTO, dexNumber()

### Community 73 - "PartyMemberView"
Cohesion: 0.17
Nodes (11): DELETE(), removeCard(), RemoveCardResult, COLLECTION_CARD_SELECT, toCollectionCardDTO(), toTradeOfferDTO(), TRADE_OFFER_SELECT, TradeOfferRow (+3 more)

### Community 76 - "buildDuelSnapshot.ts"
Cohesion: 0.80
Nodes (4): buildDuelSnapshot(), enqueueBattle(), toPokemonCreateInput(), readDeckSlots()

### Community 77 - "duelEngineEffects.test.ts"
Cohesion: 0.43
Nodes (5): clampRefreshBatch(), refreshPokedex(), RefreshPokedexOptions, RefreshPokedexSummary, SyncPokedexSummary

### Community 78 - "@react-three/fiber"
Cohesion: 0.24
Nodes (6): CollectionPageProps, HomePage(), CollectionDropZone(), CollectionGrid(), Pagination(), paginationView

### Community 79 - "submitAction.ts"
Cohesion: 0.19
Nodes (17): POST(), tryResolveTurn(), LoadoutErro, LoadoutOk, mustSwitch(), ParticipantWithMons, persist(), submitAction() (+9 more)

### Community 80 - "prisma.ts"
Cohesion: 0.17
Nodes (14): { POST, GET }, GET(), DELETE(), POST(), PUT(), POST(), POST(), checkRateLimit() (+6 more)

### Community 81 - "react-hot-toast"
Cohesion: 0.19
Nodes (10): TypeBadge(), TYPE_COLORS, typeColor(), DuelCardView, CLASS_META, MoveButton(), PokemonPortrait(), Linha() (+2 more)

### Community 82 - "auth.ts"
Cohesion: 0.11
Nodes (22): AILMENTS, EMPTY_EFFECT, isProtectMove(), num(), optionalNum(), parseMoveEffect(), PROTECT_MOVES, RawEffect (+14 more)

### Community 83 - "toBattleDTO"
Cohesion: 0.33
Nodes (5): GET(), BattlePage(), getQueueStatus(), readBattleState(), BattleRoomShell()

### Community 84 - "damage.ts"
Cohesion: 0.15
Nodes (24): calculateDamage(), confusionSelfDamage(), CRIT_CHANCE_BY_STAGE, critChanceFor(), DamageResult, rollAccuracy(), rollCrit(), applyEndOfTurn() (+16 more)

### Community 85 - "token/route.ts"
Cohesion: 0.43
Nodes (4): GET(), signRealtimeToken(), createRealtimeToken(), RealtimeToken

### Community 86 - "listPokedexPage.ts"
Cohesion: 0.13
Nodes (6): ConditionBadgeView, DuelMonView, PartyMemberView, CONDITION_TONE, DuelStage3D, StageBoundary

### Community 87 - "app/layout.tsx"
Cohesion: 0.38
Nodes (8): OfferTradeDialog(), TradeBoard(), expiryLabel(), formatTradeCode(), toTradeOfferView(), tradeErrorLabel(), TradeOfferView, TradeOfferDTO

### Community 88 - "deckBoardView.test.ts"
Cohesion: 0.19
Nodes (12): DeckBoardSlotRow, DeckBoardStatus, deckBoardView, DeckSlotView, useDeckEditor(), DeckPanel(), DeckSlotCard(), Linha() (+4 more)

### Community 89 - "bstOf"
Cohesion: 0.67
Nodes (3): drawPack(), weightForBst(), bstOf()

### Community 90 - "turnClock.ts"
Cohesion: 0.70
Nodes (3): expiredTurnWindows(), nextMisses(), remainingTurnMs()

### Community 91 - "PartyMemberView"
Cohesion: 0.38
Nodes (7): CatalogPage(), fetchPokemon(), fetchPokemonIndex(), clampPage(), pageRange(), TOTAL_PAGES, listPokedexPage()

### Community 92 - "BattleStatusDTO"
Cohesion: 0.36
Nodes (5): NormalizedPokemon, toPokemonCardDTO(), toPokemonDetailDTO(), PokemonDetailDTO, PokemonStatDTO

### Community 93 - "react"
Cohesion: 0.25
Nodes (6): anton, cinzel, metadata, rajdhani, AppToaster(), toastWarn()

### Community 94 - "react-dom"
Cohesion: 0.38
Nodes (4): NavBar(), CheckInResult, DailyCheckIn(), utcDayKey()

### Community 95 - "@react-three/drei"
Cohesion: 0.33
Nodes (5): draftFrom(), emptyDraft(), BASE_STATS, PARADO, rascunho()

### Community 98 - "getCollectionPage.ts"
Cohesion: 0.57
Nodes (4): CollectionSort, buildCollectionWhere(), orderByFor(), getCollectionQuery()

### Community 99 - "saveDeck.test.ts"
Cohesion: 0.33
Nodes (3): boardMock, prismaMock, tx

### Community 100 - "offer/[id]/route.ts"
Cohesion: 0.50
Nodes (3): DELETE(), cancelTradeOffer(), CancelTradeOfferResult

### Community 101 - "tradeRules.ts"
Cohesion: 0.40
Nodes (3): OfferCheck, OfferFacts, livre

### Community 102 - "breedPokemon.test.ts"
Cohesion: 0.40
Nodes (4): input, NOW, prismaMock, tx

### Community 103 - "acceptTradeOffer.test.ts"
Cohesion: 0.50
Nodes (3): NOW, prismaMock, tx

## Knowledge Gaps
- **394 isolated node(s):** `npx`, `@supabase/mcp-server-supabase`, `SUPABASE_ACCESS_TOKEN`, `eslintConfig`, `nextConfig` (+389 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `rarityTier` connect `packs/index.ts` to `konva`, `bstOf`, `deck/index.ts`, `battleView.ts`, `battleView.ts`, `@prisma/client`, `training/index.ts`, `listPokedexPage.ts`, `deckBoardView.test.ts`, `Estrutura de arquivos`, `applyTM.ts`, `getUnlockedMoveIds.test.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `auth` connect `prisma.ts` to `konva`, `progression/index.ts`, `next`, `offer/[id]/route.ts`, `design-system/page.tsx`, `trade/page.tsx`, `PartyMemberView`, `@react-three/fiber`, `submitAction.ts`, `toBattleDTO`, `token/route.ts`, `applyTM.ts`, `react-dom`, `PartyMemberView`, `getUnlockedMoveIds.test.ts`, `pokemon/index.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `enforceRateLimit()` connect `prisma.ts` to `progression/index.ts`, `next`, `PartyMemberView`, `token/route.ts`, `applyTM.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `npx`, `@supabase/mcp-server-supabase`, `SUPABASE_ACCESS_TOKEN` to the rest of the system?**
  _394 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `progression/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08521303258145363 - nodes in this community are weakly interconnected._
- **Should `design-system/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._