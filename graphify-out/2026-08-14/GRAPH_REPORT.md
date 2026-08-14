# Graph Report - poke-dex-next  (2026-08-14)

## Corpus Check
- 272 files · ~137,528 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1180 nodes · 2556 edges · 98 communities (79 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `34111ecd`
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

## God Nodes (most connected - your core abstractions)
1. `rarityTier` - 35 edges
2. `BaseStats` - 25 edges
3. `auth` - 23 edges
4. `typeColor()` - 19 edges
5. `conditionsOf()` - 18 edges
6. `BattleMoveDef` - 18 edges
7. `BattlePokemonState` - 17 edges
8. `syncPokedex()` - 17 edges
9. `compilerOptions` - 17 edges
10. `resolveIfDue()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `persistSide()` --indirect_call--> `m()`  [INFERRED]
  src/modules/battle/commands/resolveTurn.ts → tests/modules/deck/domain/defaultLoadout.test.ts
- `applyEndOfTurn()` --indirect_call--> `side()`  [INFERRED]
  src/modules/battle/domain/duelEngine.ts → tests/modules/battle/domain/duelEngineEffects.test.ts
- `resolveRound()` --indirect_call--> `side()`  [INFERRED]
  src/modules/battle/domain/duelEngine.ts → tests/modules/battle/domain/duelEngineEffects.test.ts
- `play()` --calls--> `resolveRound()`  [EXTRACTED]
  tests/modules/battle/domain/duelEngineEffects.test.ts → src/modules/battle/domain/duelEngine.ts
- `applyForcedSwitch()` --indirect_call--> `side()`  [INFERRED]
  src/modules/battle/domain/duelEngine.ts → tests/modules/battle/domain/duelEngineEffects.test.ts

## Import Cycles
- None detected.

## Communities (98 total, 19 thin omitted)

### Community 0 - "konva"
Cohesion: 0.20
Nodes (13): MirrorSpecies, openPack(), OpenPackResult, canOpenFree(), nextFreePackAt(), toPackStateDTO(), toPackCardDTO(), PokedexPageDTO (+5 more)

### Community 1 - "resolveTurn.ts"
Cohesion: 0.13
Nodes (33): accuracyFactor(), accuracyStageMultiplier(), actionGate, AILMENT_TYPE_IMMUNITY, AilmentBlock, ailmentBlockedBy(), AppliedAilment, applyAilment() (+25 more)

### Community 2 - "packs/index.ts"
Cohesion: 0.18
Nodes (16): Specimen, DeckBoardStatus, DeckSlotView, CollectionCardRow, CollectionCardDTO, PokedexGrid(), CollectionCardView, CollectionEmptyState (+8 more)

### Community 3 - "deck/index.ts"
Cohesion: 0.21
Nodes (15): main(), parseRange(), extractIdFromUrl(), fetchEvolutionChain(), fetchSpeciesEvolutionChainId(), mapLimit(), resolveEvolutionEdge(), SyncedSpecies (+7 more)

### Community 4 - "progression/index.ts"
Cohesion: 0.20
Nodes (9): absorb, doubleKick, ember, growl, recover, sandstorm, swagger, swordsDance (+1 more)

### Community 5 - "design-system/page.tsx"
Cohesion: 0.07
Nodes (31): POST(), GET(), PacksPage(), StreakPage(), CardsIcon(), CloseIcon(), GridIcon(), MenuIcon() (+23 more)

### Community 6 - "battleView.ts"
Cohesion: 0.18
Nodes (17): AppliedStage, NonVolatileAilment, STAGE_STATS, MoveEffect, StageStat, BattleRow, toConditionsDTO(), toMoveDTO() (+9 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+20 more)

### Community 8 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 9 - "DuelStage3D.tsx"
Cohesion: 0.12
Nodes (11): DuelCalloutView, DuelTurnFx, TONE, AnimState, CAM_POS, LOOK_AT, ME_POS, OPP_POS (+3 more)

### Community 10 - "collectionFilters.ts"
Cohesion: 0.33
Nodes (14): applyXp(), calcHp(), calcStat(), clampLevel(), DerivedStats, deriveStats(), levelFromXp(), Progress (+6 more)

### Community 11 - "5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto"
Cohesion: 0.07
Nodes (28): 1. Page é servidor. Sempre., 2. Nunca escreva durante o render de uma page, 3.1 Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto., 3. Toda saída pro cliente passa por um DTO, 4. Lógica de apresentação sai do componente, 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto, 6. Concorrência: assuma duas lambdas ao mesmo tempo, Arquitetura (+20 more)

### Community 12 - "deckBoardView.ts"
Cohesion: 0.07
Nodes (42): anton, cinzel, metadata, rajdhani, AppToaster(), toastWarn(), clearSlot(), countFilled() (+34 more)

### Community 13 - "learnset.ts"
Cohesion: 0.24
Nodes (9): isUnlockedAt(), LearnDetail, mergePlayableMoveIds(), METHOD_RANK, methodRank(), pickLearnEntry(), VERSION_GROUP_PREFERENCE, getUnlockedMoveIds() (+1 more)

### Community 14 - "2. O que é usado pra calcular a raridade: **BST**"
Cohesion: 0.10
Nodes (19): 1. Visão geral do fluxo, 2. O que é usado pra calcular a raridade: **BST**, 3.1 Streak de login (recompensa por presença), 3. As regras, 4.1 Achados (ranqueados por severidade), 4.2 Superfícies checadas e LIMPAS, 4.3 Integridade e concorrência (o que está CERTO — não "conserte"), 4.4 Pendências relacionadas (não são deste módulo) (+11 more)

### Community 15 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, prisma, tsx, @types/node (+11 more)

### Community 16 - "toBattleDTO.ts"
Cohesion: 0.22
Nodes (8): PokemonDetailPage(), HpBar(), DetailPanel(), detailView, STAT_LABELS, StatBarView, PokemonMoves(), PokemonDetailDTO

### Community 17 - "dependencies"
Cohesion: 0.11
Nodes (19): better-auth, jose, next, dependencies, better-auth, jose, next, @prisma/client (+11 more)

### Community 18 - "syncPokedex.ts"
Cohesion: 0.53
Nodes (4): turnClockView, TONE, TurnClock(), useTurnClock()

### Community 19 - "typeColor"
Cohesion: 0.39
Nodes (5): clamp01(), computeHoloTilt(), HOLO_REST, HoloTilt, HoloCard()

### Community 20 - "listPokedexPage.ts"
Cohesion: 0.15
Nodes (28): resolveForcedSwitchRound(), RoundParams, clearVolatiles(), applyForcedSwitch(), applyLeadLoadout(), applyVoluntarySwitch(), AttackContext, cloneState() (+20 more)

### Community 21 - "training/index.ts"
Cohesion: 0.06
Nodes (48): DELETE(), CatalogPage(), CollectionPageProps, HomePage(), TypeBadge(), TYPE_COLORS, typeColor(), DuelCardView (+40 more)

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
Cohesion: 0.20
Nodes (16): DesignSystemPage(), RarityRow(), PokeCard(), PokeCardProps, SPARKLES, CARD_WIDTH, cardMetal, PokeCardSize (+8 more)

### Community 26 - "PokeDex"
Cohesion: 0.18
Nodes (10): Como a batalha avança por dentro, Evolução (usamos a modelagem da própria PokéAPI), Golpes liberados por nível (learnset), O jogo, Os números saem da fórmula da série, PokeDex, Rodando localmente, Stack (+2 more)

### Community 27 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:reset, dev, lint, migrate:deploy, seed, start (+1 more)

### Community 28 - "Rotinas do sistema — fontes de dados, crons e fair use"
Cohesion: 0.25
Nodes (7): 1. Fonte dos dados de pokémon — quem lê o quê, 2. Cron: `resolve-battle-turns` (a cada 30s), 3. Cron: `refresh-pokedex` (mensal — 6 lotes de 50, dia 1), 4. Rotina manual: seed do espelho (por geração), 5. Fair use da PokéAPI — como cumprimos, 6. Runbook — operar os crons, Rotinas do sistema — fontes de dados, crons e fair use

### Community 29 - "training/index.ts"
Cohesion: 0.11
Nodes (18): 1. Onde o pokémon mora hoje, 2. O que fica em cada módulo, 3. Estrutura alvo, 4. Plano de migração — etapas, 5. O que NÃO se move (e por quê), 6. Riscos, 7. Verificação, Etapa 0 — commitar o que está pendente (+10 more)

### Community 30 - "pokemon/index.ts"
Cohesion: 0.32
Nodes (9): resolveDueBattles(), ResolveDueSummary, loadBattleForResolve(), orderedSides(), resolveIfDue(), BattleParticipants, isParticipant(), getBattleState() (+1 more)

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

### Community 36 - "resolveDueBattles.test.ts"
Cohesion: 0.40
Nodes (3): loadBattleForResolve, prismaMock, resolveIfDue

### Community 37 - "battleAccess.test.ts"
Cohesion: 0.40
Nodes (4): BATTLE, loadBattleForResolve, prismaMock, resolveIfDue

### Community 38 - "StageBoundary"
Cohesion: 0.15
Nodes (22): CombatantRow, loadXpContext(), xpAwardsOf(), XpContext, buildTypeChart(), ActionRow, BattleForResolve, commit() (+14 more)

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
Cohesion: 0.25
Nodes (11): effectiveSpeed(), MonConditions, DamageRollParams, ForcedSwitchParams, BattlePokemonRow, effectivePriority(), orderForTurn(), OrderInput (+3 more)

### Community 54 - ".mcp.json"
Cohesion: 0.40
Nodes (4): SUPABASE_ACCESS_TOKEN, npx, supabase, @supabase/mcp-server-supabase

### Community 56 - "applyTM.ts"
Cohesion: 0.33
Nodes (6): POST(), applyTM(), ApplyTmInput, ApplyTmResult, checkTmTeachable(), TmTeachCheck

### Community 57 - "tailwindcss"
Cohesion: 0.31
Nodes (8): PUT(), saveDeck(), getDeckSummary(), DeckLoadoutSlot, deckOfUser(), getOrCreateDeck(), toDeckSummaryDTO(), DeckSummaryDTO

### Community 61 - "getUnlockedMoveIds.test.ts"
Cohesion: 0.33
Nodes (4): BattleQueuePage(), getQueueDeck(), BattleMatchmaker(), QueueDeckDTO

### Community 63 - "getBattleState.ts"
Cohesion: 0.24
Nodes (10): grantXp(), maybeEvolve(), XpAward, birthLevelForSpecies(), EvolutionChainNode, EvolutionDetail, EvolutionEdge, evolutionTargetFor() (+2 more)

### Community 65 - "pokedex/index.ts"
Cohesion: 0.16
Nodes (15): CACHE_FOREVER, fetchMove(), fetchPokemon(), fetchPokemonIndex(), MoveLearnDetail, NormalizedEvolutionNode, NormalizedMove, NormalizedMoveEffect (+7 more)

### Community 66 - "Pagination.tsx"
Cohesion: 0.12
Nodes (23): startDuel(), effectivenessMultiplier(), TypeEffectivenessMap, active(), combatant(), hitCard(), makeDuelSide(), neutralChart (+15 more)

### Community 67 - "seed.ts"
Cohesion: 0.19
Nodes (6): defaultLoadout(), LoadoutCandidate, isDeckFull(), boardMock, prismaMock, tx

### Community 68 - "next"
Cohesion: 0.13
Nodes (10): artworkOf(), CardDemo(), CHARIZARD, CHARMELEON, MEWTWO, PIKACHU, RARITY_ROW, rarityOf() (+2 more)

### Community 69 - "(game)/page.tsx"
Cohesion: 0.50
Nodes (3): input, prismaMock, tx

### Community 70 - "battleView.ts"
Cohesion: 0.15
Nodes (23): activeMon(), AILMENT_LABEL, AILMENT_VERB, ailmentLabel(), BLOCK_LABEL, CONDITION_HINT, conditionBadges(), DuelLogKind (+15 more)

### Community 71 - "@prisma/client"
Cohesion: 0.33
Nodes (8): PackOpener(), Phase, PackRevealCard(), formatCountdown(), packStatusView, OpenPackResultDTO, PackCardDTO, PackStateDTO

### Community 76 - "buildDuelSnapshot.ts"
Cohesion: 0.40
Nodes (8): BattleTeamMember, buildDuelSnapshot(), defaultMovesFor(), toPokemonState(), enqueueBattle(), toPokemonCreateInput(), loadMoveDefs(), readDeckSlots()

### Community 77 - "duelEngineEffects.test.ts"
Cohesion: 0.33
Nodes (6): POST(), clampRefreshBatch(), refreshPokedex(), RefreshPokedexOptions, RefreshPokedexSummary, SyncPokedexSummary

### Community 78 - "@react-three/fiber"
Cohesion: 0.31
Nodes (5): SaveDeckResult, DeckSlotInput, DeckSlotsIssue, validateDeckSlots(), ValidateDeckSlotsResult

### Community 79 - "submitAction.ts"
Cohesion: 0.24
Nodes (11): POST(), tryResolveTurn(), LoadoutErro, LoadoutOk, mustSwitch(), ParticipantWithMons, persist(), submitAction() (+3 more)

### Community 80 - "prisma.ts"
Cohesion: 0.16
Nodes (12): { POST, GET }, GET(), GET(), GET(), DELETE(), POST(), GET(), POST() (+4 more)

### Community 81 - "react-hot-toast"
Cohesion: 0.31
Nodes (5): Linha(), Resposta, LearnsetMoveDTO, PokemonStatDTO, TeachTmResponseDTO

### Community 82 - "auth.ts"
Cohesion: 0.21
Nodes (11): globalForPrisma, AILMENTS, num(), optionalNum(), parseMoveEffect(), RawEffect, resolveStageTarget(), StageChange (+3 more)

### Community 83 - "toBattleDTO"
Cohesion: 0.31
Nodes (4): BattlePage(), readBattleState(), toBattleDTO(), BattleRoomShell()

### Community 84 - "damage.ts"
Cohesion: 0.36
Nodes (8): effectiveStat(), calculateDamage(), confusionSelfDamage(), CRIT_CHANCE_BY_STAGE, critChanceFor(), DamageResult, rollAccuracy(), rollCrit()

### Community 85 - "token/route.ts"
Cohesion: 0.43
Nodes (4): GET(), signRealtimeToken(), createRealtimeToken(), RealtimeToken

### Community 86 - "listPokedexPage.ts"
Cohesion: 0.14
Nodes (8): ConditionBadgeView, duelCalloutFor(), DuelMonView, CONDITION_TONE, DuelStage3D, StageBoundary, StageFallbackSprites(), Callout()

### Community 87 - "app/layout.tsx"
Cohesion: 0.38
Nodes (5): fetchType(), NormalizedType, CacheKey, fetchAndCache(), fetchAndCacheType()

### Community 88 - "deckBoardView.test.ts"
Cohesion: 0.53
Nodes (4): getDeckBoardQuery(), DECK_BOARD_SLOT_SELECT, DeckBoardSlotRow, toDeckBoardSlotDTO()

### Community 89 - "bstOf"
Cohesion: 0.67
Nodes (3): drawPack(), weightForBst(), bstOf()

### Community 90 - "turnClock.ts"
Cohesion: 0.70
Nodes (3): expiredTurnWindows(), nextMisses(), remainingTurnMs()

## Knowledge Gaps
- **347 isolated node(s):** `npx`, `@supabase/mcp-server-supabase`, `SUPABASE_ACCESS_TOKEN`, `eslintConfig`, `nextConfig` (+342 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `rarityTier` connect `packs/index.ts` to `konva`, `bstOf`, `deck/index.ts`, `next`, `battleView.ts`, `battleView.ts`, `@prisma/client`, `deckBoardView.ts`, `training/index.ts`, `deckBoardView.test.ts`, `Estrutura de arquivos`, `applyTM.ts`, `PartyMemberView`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `BaseStats` connect `packs/index.ts` to `konva`, `deck/index.ts`, `next`, `@prisma/client`, `collectionFilters.ts`, `deckBoardView.ts`, `deckBoardView.test.ts`, `tailwindcss`, `applyTM.ts`, `Estrutura de arquivos`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `auth` connect `prisma.ts` to `design-system/page.tsx`, `submitAction.ts`, `toBattleDTO`, `token/route.ts`, `training/index.ts`, `applyTM.ts`, `tailwindcss`, `getUnlockedMoveIds.test.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `npx`, `@supabase/mcp-server-supabase`, `SUPABASE_ACCESS_TOKEN` to the rest of the system?**
  _347 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `resolveTurn.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13109243697478992 - nodes in this community are weakly interconnected._
- **Should `design-system/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06988120195667366 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._