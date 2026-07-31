# Módulo `progression` — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair leveling + evolution + learnset de `pokedex/domain/` para um módulo próprio `progression/`, com corte limpo, matando a dependência `battle → pokedex` que existe só por matemática pura.

**Architecture:** Refactor de MOVE puro — nenhum comportamento muda. A rede de segurança são os testes de domínio que já existem (movem junto e devem passar idênticos). Para manter `tsc` verde em cada commit, a Task 1 move os arquivos e faz o `pokedex/index.ts` reexportar **temporariamente** de `progression` (scaffold de compatibilidade); as Tasks 2-3 reapontam cada consumidor externo para `progression`; a Task 4 remove o scaffold, e o `tsc` vira a checagem exaustiva de que nenhum consumidor ficou pra trás.

**Tech Stack:** TypeScript, Next.js, Vitest, ESLint. Alias `@/` → raiz do repo.

## Global Constraints

- `domain/` é puro: sem Prisma, sem `fetch`, sem React (CLAUDE.md — Arquitetura).
- Módulo-a-módulo só pela fronteira do `index.ts`; nunca importar `progression/domain/*` direto de fora do módulo.
- Nenhum comportamento muda neste refactor — se um teste de domínio quebrar, é import mal reapontado, não regressão.
- Não commitar sem o dono revisar (preferência do dono). Cada task termina com o comando de commit **pronto**, mas a execução para pra revisão entre tasks.
- Verificação do projeto: `npx tsc --noEmit` · `npx vitest run` · `npx eslint` · `npx next build` (CLAUDE.md — Verificação).
- Depois de mexer no código, `graphify update .` (CLAUDE.md — graphify).

---

## Estrutura de arquivos

**Criados:**
- `src/modules/progression/index.ts` — API pública do módulo (só re-export de `domain/` puro).
- `src/modules/progression/domain/leveling.ts` — movido de `pokedex/domain/`.
- `src/modules/progression/domain/evolution.ts` — movido de `pokedex/domain/`.
- `src/modules/progression/domain/learnset.ts` — movido de `pokedex/domain/`.
- `tests/modules/progression/domain/leveling.test.ts` — movido.
- `tests/modules/progression/domain/evolution.test.ts` — movido.
- `tests/modules/progression/domain/learnset.test.ts` — movido.

**Removidos:**
- `src/modules/pokedex/domain/{leveling,evolution,learnset}.ts`
- `tests/modules/pokedex/domain/{leveling,evolution,learnset}.test.ts`

**Modificados:**
- `src/modules/pokedex/index.ts` — re-export dos 3 domínios sai (Task 4); scaffold temporário (Task 1).
- `src/modules/pokedex/queries/getUnlockedMoveIds.ts` — import de learnset.
- `src/modules/pokedex/commands/syncPokedex.ts` — imports de leveling/learnset/evolution.
- `src/modules/battle/commands/awardBattleXp.ts` — import + comentário.
- `src/modules/battle/commands/buildDuelSnapshot.ts` — import.
- `src/modules/battle/domain/types.ts` — só comentário (linhas 5, 13).
- `src/modules/packs/commands/openPack.ts` — import.
- `src/modules/deck/queries/readLearnset.ts` — import.
- `src/modules/deck/queries/readDeck.ts` — import (type-only).
- `src/lib/pokeapi.ts` — só comentário (linha 34).

---

### Task 1: Criar `progression/` e manter tudo verde por compat

Move os 3 domínios + seus testes, cria o `index.ts` do módulo, e reaponta os importadores **internos do pokedex** e o barrel do pokedex para `progression`. O barrel do pokedex continua expondo os símbolos (scaffold) — então nenhum consumidor externo quebra ainda.

**Files:**
- Create: `src/modules/progression/domain/leveling.ts`, `evolution.ts`, `learnset.ts` (conteúdo idêntico aos de `pokedex/domain/`)
- Create: `src/modules/progression/index.ts`
- Create: `tests/modules/progression/domain/leveling.test.ts`, `evolution.test.ts`, `learnset.test.ts`
- Delete: `src/modules/pokedex/domain/{leveling,evolution,learnset}.ts`
- Delete: `tests/modules/pokedex/domain/{leveling,evolution,learnset}.test.ts`
- Modify: `src/modules/pokedex/index.ts`, `src/modules/pokedex/queries/getUnlockedMoveIds.ts`, `src/modules/pokedex/commands/syncPokedex.ts`

**Interfaces:**
- Produces: `@/src/modules/progression` exporta os mesmos símbolos que `pokedex/index.ts` linhas 21-59 exportavam de leveling/learnset/evolution — nomes idênticos: `MIN_LEVEL, MAX_LEVEL, STARTING_LEVEL, LOSER_XP_SHARE, FALLBACK_BASE_EXPERIENCE, deriveStats, calcHp, calcStat, applyXp, xpForLevel, levelFromXp, xpToNextLevel, xpFromDefeat`; tipos `BaseStats, DerivedStats, Progress`; `VERSION_GROUP_PREFERENCE, PLAYABLE_LEARN_METHOD, pickVersionGroup, pickLearnEntry, isUnlockedAt, mergePlayableMoveIds`; tipos `LearnDetail, LearnsetEntry`; `parseLevelUpEvolutions, evolutionTargetFor, pruneLoadout, birthLevelForSpecies`; tipos `EvolutionEdge, EvolutionDetail, EvolutionChainNode`.

- [ ] **Step 1: Mover os 3 arquivos de domínio (conteúdo inalterado)**

```bash
git mv src/modules/pokedex/domain/leveling.ts  src/modules/progression/domain/leveling.ts
git mv src/modules/pokedex/domain/evolution.ts src/modules/progression/domain/evolution.ts
git mv src/modules/pokedex/domain/learnset.ts  src/modules/progression/domain/learnset.ts
```

(`git mv` preserva o histórico. O conteúdo dos arquivos NÃO muda nesta task.)

- [ ] **Step 2: Mover os 3 arquivos de teste e reapontar o import do sujeito**

```bash
git mv tests/modules/pokedex/domain/leveling.test.ts  tests/modules/progression/domain/leveling.test.ts
git mv tests/modules/pokedex/domain/evolution.test.ts tests/modules/progression/domain/evolution.test.ts
git mv tests/modules/pokedex/domain/learnset.test.ts  tests/modules/progression/domain/learnset.test.ts
```

Em cada arquivo movido, trocar o `from` do import do sujeito:

```ts
// leveling.test.ts (linha 15)
} from "@/src/modules/progression/domain/leveling";
// evolution.test.ts (linha 8)
} from "@/src/modules/progression/domain/evolution";
// learnset.test.ts (linha 9)
} from "@/src/modules/progression/domain/learnset";
```

- [ ] **Step 3: Criar `src/modules/progression/index.ts`**

```ts
// API pública do módulo progression — as regras PURAS de progressão de um
// Pokémon (nível/stats, XP, evolução, learnset), compartilhadas por pokedex,
// battle, deck e packs. Só domain/ puro: sem Prisma, sem fetch, sem React.
// Módulo-a-módulo importa SÓ daqui, nunca de domain/ direto.

// Nível incremental + stats derivados 100% da API (PLANO_JOGO.md §6).
export {
  MIN_LEVEL,
  MAX_LEVEL,
  STARTING_LEVEL,
  LOSER_XP_SHARE,
  FALLBACK_BASE_EXPERIENCE,
  deriveStats,
  calcHp,
  calcStat,
  applyXp,
  xpForLevel,
  levelFromXp,
  xpToNextLevel,
  xpFromDefeat,
} from "./domain/leveling";
export type { BaseStats, DerivedStats, Progress } from "./domain/leveling";

// Learnset fiel à série: qual move a espécie aprende, por método e nível.
export {
  VERSION_GROUP_PREFERENCE,
  PLAYABLE_LEARN_METHOD,
  pickVersionGroup,
  pickLearnEntry,
  isUnlockedAt,
  mergePlayableMoveIds,
} from "./domain/learnset";
export type { LearnDetail, LearnsetEntry } from "./domain/learnset";

// Evolução por nível: decisão de quando evoluir e o que podar do loadout.
export {
  parseLevelUpEvolutions,
  evolutionTargetFor,
  pruneLoadout,
  birthLevelForSpecies,
} from "./domain/evolution";
export type { EvolutionEdge, EvolutionDetail, EvolutionChainNode } from "./domain/evolution";
```

- [ ] **Step 4: Reapontar os importadores internos do pokedex**

Em `src/modules/pokedex/queries/getUnlockedMoveIds.ts` (linha 2):

```ts
import { PLAYABLE_LEARN_METHOD, mergePlayableMoveIds } from "@/src/modules/progression";
```

Em `src/modules/pokedex/commands/syncPokedex.ts` (linhas 11-13), trocar as 3 linhas que importavam de `../domain/{leveling,learnset,evolution}` por:

```ts
import type { BaseStats } from "@/src/modules/progression";
import { pickLearnEntry, pickVersionGroup, type LearnsetEntry } from "@/src/modules/progression";
import { parseLevelUpEvolutions, type EvolutionEdge } from "@/src/modules/progression";
```

- [ ] **Step 5: Scaffold — `pokedex/index.ts` reexporta de `progression`**

No `src/modules/pokedex/index.ts`, os 3 blocos que hoje reexportam de `./domain/leveling`, `./domain/learnset`, `./domain/evolution` (linhas ~19-59) passam a reexportar de `@/src/modules/progression`, mantendo os MESMOS nomes. Substituir os três `from "./domain/..."` por `from "@/src/modules/progression"` (o bloco de valores e o de tipos de cada domínio). Adicionar um comentário marcando que é temporário:

```ts
// TEMPORÁRIO (removido na Task 4 deste refactor): reexporta progression pra não
// quebrar os consumidores enquanto eles migram pra @/src/modules/progression.
export {
  MIN_LEVEL, MAX_LEVEL, STARTING_LEVEL, LOSER_XP_SHARE, FALLBACK_BASE_EXPERIENCE,
  deriveStats, calcHp, calcStat, applyXp, xpForLevel, levelFromXp, xpToNextLevel, xpFromDefeat,
} from "@/src/modules/progression";
export type { BaseStats, DerivedStats, Progress } from "@/src/modules/progression";
export {
  VERSION_GROUP_PREFERENCE, PLAYABLE_LEARN_METHOD, pickVersionGroup, pickLearnEntry, isUnlockedAt, mergePlayableMoveIds,
} from "@/src/modules/progression";
export type { LearnDetail, LearnsetEntry } from "@/src/modules/progression";
export {
  parseLevelUpEvolutions, evolutionTargetFor, pruneLoadout, birthLevelForSpecies,
} from "@/src/modules/progression";
export type { EvolutionEdge, EvolutionDetail, EvolutionChainNode } from "@/src/modules/progression";
```

- [ ] **Step 6: Rodar os testes de domínio movidos**

Run: `npx vitest run tests/modules/progression/domain`
Expected: PASS — os 3 arquivos passam idênticos (nenhuma lógica mudou).

- [ ] **Step 7: Rodar o type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros. O barrel do pokedex ainda expõe tudo, então os consumidores externos continuam resolvendo.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(progression): extrai leveling/evolution/learnset pra módulo próprio

Move os 3 domínios puros de pokedex/domain pra progression/domain (git mv,
histórico preservado). pokedex/index.ts reexporta de progression
temporariamente pra manter os consumidores verdes; a migração pro corte
limpo vem nas tasks seguintes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Reapontar o battle para `progression`

**Files:**
- Modify: `src/modules/battle/commands/awardBattleXp.ts` (linhas 3-11, e comentário linha 14/19)
- Modify: `src/modules/battle/commands/buildDuelSnapshot.ts` (linha 3, comentário linha 11)
- Modify: `src/modules/battle/domain/types.ts` (comentários linhas 5, 13)

**Interfaces:**
- Consumes: `@/src/modules/progression` (símbolos criados na Task 1).

- [ ] **Step 1: `awardBattleXp.ts` — trocar a origem do import**

Os 7 símbolos do bloco de import de `@/src/modules/pokedex` (linhas 3-11) são
TODOS de progressão, então o import do pokedex desaparece por inteiro deste
arquivo (é a morte da dependência `battle → pokedex`). Substituir o bloco por:

```ts
import {
  applyXp,
  evolutionTargetFor,
  LOSER_XP_SHARE,
  mergePlayableMoveIds,
  PLAYABLE_LEARN_METHOD,
  pruneLoadout,
  xpFromDefeat,
} from "@/src/modules/progression";
```

Depois da troca, `awardBattleXp.ts` não deve ter mais nenhum
`from "@/src/modules/pokedex"`. Os imports de Prisma (linhas 1-2) ficam intactos.

- [ ] **Step 2: `awardBattleXp.ts` — atualizar os comentários de caminho**

Nos comentários (linhas ~14 e ~19) trocar `pokedex/domain/learnset.ts` → `progression/domain/learnset.ts` e `pokedex/domain/leveling.ts` → `progression/domain/leveling.ts`.

- [ ] **Step 3: `buildDuelSnapshot.ts` — trocar import e comentário**

Linha 3:

```ts
import { deriveStats } from "@/src/modules/progression";
```

- [ ] **Step 4: `battle/domain/types.ts` — atualizar comentários**

Linhas 5 e 13: `pokedex/domain/leveling` → `progression/domain/leveling`.

- [ ] **Step 5: Type-check + testes do battle**

Run: `npx tsc --noEmit && npx vitest run tests/modules/battle`
Expected: sem erros; testes do battle (inclui `resolveTurn.test.ts`) passam.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(battle): importa progressão de @/src/modules/progression

Mata a dependência battle -> pokedex que existia só por matemática de XP,
stats e evolução. Atualiza os comentários de caminho junto.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Reapontar deck e packs para `progression`

**Files:**
- Modify: `src/modules/packs/commands/openPack.ts` (linha 2)
- Modify: `src/modules/deck/queries/readLearnset.ts` (linha 2)
- Modify: `src/modules/deck/queries/readDeck.ts` (linha 2)

**Interfaces:**
- Consumes: `@/src/modules/progression`.

- [ ] **Step 1: `openPack.ts` — separar progressão do DTO do pokedex**

A linha 2 hoje mistura símbolo de progressão com `PokemonCardDTO` (que é do pokedex). Separar em duas linhas:

```ts
import { birthLevelForSpecies, STARTING_LEVEL, xpForLevel } from "@/src/modules/progression";
import type { PokemonCardDTO } from "@/src/modules/pokedex";
```

- [ ] **Step 2: `readLearnset.ts` — trocar a origem do import**

Linha 2:

```ts
import { isUnlockedAt, PLAYABLE_LEARN_METHOD } from "@/src/modules/progression";
```

- [ ] **Step 3: `readDeck.ts` — trocar a origem do import (type-only)**

Linha 2:

```ts
import type { BaseStats } from "@/src/modules/progression";
```

- [ ] **Step 4: Type-check + testes de deck e packs**

Run: `npx tsc --noEmit && npx vitest run tests/modules/deck tests/modules/packs`
Expected: sem erros; testes passam (se não houver testes nessas pastas, o `tsc` já cobre o import).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(deck,packs): importa progressão de @/src/modules/progression

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Remover o scaffold do pokedex e fechar a faxina

Agora que todos os consumidores externos migraram, o barrel do pokedex para de reexportar progressão (corte limpo). O `tsc` aqui é a checagem exaustiva: se sobrou algum consumidor não migrado, ele acusa.

**Files:**
- Modify: `src/modules/pokedex/index.ts` (remover os blocos de re-export de progressão)
- Modify: `src/lib/pokeapi.ts` (comentário linha 34)

- [ ] **Step 1: Varredura exaustiva de consumidores remanescentes**

Run (pra confirmar que nada fora do pokedex ainda pega progressão pelo barrel):

```bash
git grep -nE "deriveStats|xpFromDefeat|applyXp|levelFromXp|xpForLevel|xpToNextLevel|calcHp|calcStat|STARTING_LEVEL|LOSER_XP_SHARE|FALLBACK_BASE_EXPERIENCE|MIN_LEVEL|MAX_LEVEL|pickVersionGroup|pickLearnEntry|isUnlockedAt|mergePlayableMoveIds|PLAYABLE_LEARN_METHOD|VERSION_GROUP_PREFERENCE|parseLevelUpEvolutions|evolutionTargetFor|pruneLoadout|birthLevelForSpecies|BaseStats|DerivedStats|Progress|LearnDetail|LearnsetEntry|EvolutionEdge|EvolutionDetail|EvolutionChainNode" -- 'src/**' | grep 'from "@/src/modules/pokedex"'
```

Expected: vazio. Qualquer resultado é um consumidor esquecido — reaponta pra `@/src/modules/progression` antes de seguir.

- [ ] **Step 2: Remover os 3 blocos de re-export de progressão do `pokedex/index.ts`**

Apagar os blocos temporários adicionados na Task 1 (os `export { ... } from "@/src/modules/progression"` e seus `export type`), junto com o comentário `TEMPORÁRIO`. O `pokedex/index.ts` volta a expor só o que é do pokedex (DTOs, pagination, syncPokedex/refreshPokedex, queries, removeCard).

- [ ] **Step 3: Atualizar o comentário em `lib/pokeapi.ts`**

Linha 34: `pokedex/domain/learnset.ts` → `progression/domain/learnset.ts`.

- [ ] **Step 4: Verificação completa**

Run: `npx tsc --noEmit && npx vitest run && npx eslint && npx next build`
Expected: tudo verde. O `tsc` aqui prova o corte limpo — nenhum consumidor depende mais do pokedex pra progressão.

- [ ] **Step 5: Atualizar o grafo**

Run: `graphify update .`

- [ ] **Step 6: Faxina de docs**

Conferir e, se citarem `pokedex/domain/{leveling,evolution,learnset}`, reapontar pra `progression/domain/`:

```bash
git grep -nE "pokedex/domain/(leveling|evolution|learnset)" -- PLANO_JOGO.md CLAUDE.md AGENTS.md DEPLOY.md README.md
```

Atualizar o que aparecer. Se nada aparecer, seguir.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(pokedex): remove re-export de progressão (corte limpo)

pokedex/index.ts deixa de expor leveling/evolution/learnset — progressão
agora é um módulo de 1ª classe, importado direto de @/src/modules/progression.
Atualiza grafo e comentários/docs remanescentes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notas de execução

- **Sem 'write failing test'**: é um refactor de MOVE, sem comportamento novo. A rede de segurança são os testes de domínio que já existem e devem passar idênticos após o move. Não se cria teste novo — o valor está em `tsc` + `vitest` + `next build` verdes em cada commit.
- **Ordem importa**: Task 1 (scaffold verde) → 2 → 3 (migração dos consumidores) → 4 (remoção do scaffold). Não pule pra Task 4 antes de 2 e 3, senão o `tsc` quebra nos consumidores não migrados.
- **Revisão do dono entre tasks**: cada task fecha verde e para pra revisão antes de commitar (preferência do dono — não auto-commitar).
