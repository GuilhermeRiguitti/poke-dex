# Módulo `progression` — extração do domínio de progressão

**Data:** 2026-07-30
**Autor:** Guilherme Riguitti (desenho com assistência)
**Status:** aprovado, aguardando plano de implementação

## Problema

As regras puras de progressão de um Pokémon — nível/stats, XP, evolução e
learnset — moram hoje em `src/modules/pokedex/domain/`:

- `leveling.ts` — stats derivados por nível + curva de XP
- `evolution.ts` — evolução por nível
- `learnset.ts` — quem aprende o quê, por qual método, em que nível

Mas esses três domínios são consumidos pelo **battle** tanto quanto pelo
**pokedex** (e também por **deck** e **packs**). Como só o pokedex os expõe (via
`pokedex/index.ts`), o `battle` precisa importar de `@/src/modules/pokedex`
apenas para pegar matemática pura:

```ts
// battle/commands/awardBattleXp.ts
import {
  applyXp, xpFromDefeat, LOSER_XP_SHARE,   // leveling
  evolutionTargetFor, pruneLoadout,        // evolution
  mergePlayableMoveIds,                    // learnset
} from "@/src/modules/pokedex";
```

Isso cria uma dependência `battle → pokedex` que existe **só por conta da
localização dos arquivos**, não por uma relação conceitual real. Progressão não
é um conceito do pokedex — é um domínio compartilhado que por acaso nasceu lá.

**Natureza do problema:** é acoplamento **conceitual**, não técnico. Como tudo é
`domain/` puro (interface + função pura) e os consumidores são código de
servidor, o import não pesa bundle nem perf hoje. O ganho da extração é fronteira
honesta, não conserto de bug.

## Objetivo

Extrair leveling + evolution + learnset para um módulo próprio
`src/modules/progression/`, com **corte limpo**: o `pokedex` deixa de reexportar
esses domínios e todo consumidor (inclusive o próprio pokedex) passa a importar
de `@/src/modules/progression`. Resultado: a dependência `battle → pokedex` por
matemática deixa de existir.

## Não-objetivos (fora de escopo, viram TODO)

- **Split `stats.ts × xp.ts` (SRP-B).** O `leveling.ts` mistura duas
  responsabilidades (derivação de stats × curva de XP) — decidido **mover
  inteiro** agora e deixar o split como passo opcional futuro.
- **Abstração de repositório / Dependency Inversion sobre o Prisma (Q1).**
  Descartado por custo/benefício: as semânticas de concorrência do Prisma
  (`$transaction` interativa, `updateMany` com trava otimista, `upsert` com
  `@unique`) são carga de trabalho crítica no serverless (CLAUDE.md §5/§6); uma
  interface genérica ou vaza o Prisma ou perde essas semânticas.

## Desenho

### Estrutura nova

```
src/modules/progression/
  domain/
    leveling.ts     ← movido de pokedex/domain/, sem alteração de conteúdo
    evolution.ts    ← movido de pokedex/domain/, sem alteração de conteúdo
    learnset.ts     ← movido de pokedex/domain/, sem alteração de conteúdo
  index.ts          ← API pública: só re-export de domain/ puro

tests/modules/progression/domain/
  leveling.test.ts  ← movido de tests/modules/pokedex/domain/
  evolution.test.ts ← movido de tests/modules/pokedex/domain/
  learnset.test.ts  ← movido de tests/modules/pokedex/domain/
```

É um módulo **só-domínio** (sem `queries/`, `commands/`, `ui/`). Legítimo: é
regra pura compartilhada. Nada toca o banco. O `index.ts` reexporta exatamente o
que o `pokedex/index.ts` reexportava desses três domínios (mesmos nomes), para
que a única mudança nos consumidores seja a **origem** do import.

### `progression/index.ts` — superfície pública

Reexporta os símbolos que hoje saem do `pokedex/index.ts` (linhas 19-59):

- **leveling:** `MIN_LEVEL`, `MAX_LEVEL`, `STARTING_LEVEL`, `LOSER_XP_SHARE`,
  `FALLBACK_BASE_EXPERIENCE`, `deriveStats`, `calcHp`, `calcStat`, `applyXp`,
  `xpForLevel`, `levelFromXp`, `xpToNextLevel`, `xpFromDefeat` +
  tipos `BaseStats`, `DerivedStats`, `Progress`
- **learnset:** `VERSION_GROUP_PREFERENCE`, `PLAYABLE_LEARN_METHOD`,
  `pickVersionGroup`, `pickLearnEntry`, `isUnlockedAt`, `mergePlayableMoveIds` +
  tipos `LearnDetail`, `LearnsetEntry`
- **evolution:** `parseLevelUpEvolutions`, `evolutionTargetFor`, `pruneLoadout`,
  `birthLevelForSpecies` +
  tipos `EvolutionEdge`, `EvolutionDetail`, `EvolutionChainNode`

### Rewiring dos consumidores (corte limpo)

`pokedex/index.ts` **perde** os blocos de re-export de leveling/learnset/evolution
(linhas 19-59). Cada consumidor troca `@/src/modules/pokedex` →
`@/src/modules/progression` **só para os símbolos de progressão** (os imports de
DTOs/queries do pokedex, ex.: `PokemonCardDTO`, `removeCard`, continuam vindo do
pokedex).

Consumidores conhecidos (varredura fina de type-only fica para o plano):

| Arquivo | Símbolos de progressão | Origem hoje |
|---|---|---|
| `battle/commands/awardBattleXp.ts` | applyXp, xpFromDefeat, LOSER_XP_SHARE, evolutionTargetFor, pruneLoadout, mergePlayableMoveIds | barrel pokedex |
| `battle/commands/buildDuelSnapshot.ts` | deriveStats | barrel pokedex |
| `packs/commands/openPack.ts` | birthLevelForSpecies, STARTING_LEVEL, xpForLevel | barrel pokedex |
| `deck/queries/readLearnset.ts` | isUnlockedAt, PLAYABLE_LEARN_METHOD | barrel pokedex |
| `deck/queries/readDeck.ts` | BaseStats (tipo) | barrel pokedex |
| `pokedex/queries/getUnlockedMoveIds.ts` | PLAYABLE_LEARN_METHOD, mergePlayableMoveIds | `../domain/learnset` |
| `pokedex/commands/syncPokedex.ts` | pickLearnEntry, pickVersionGroup, LearnsetEntry, parseLevelUpEvolutions, EvolutionEdge, BaseStats | `../domain/{learnset,evolution,leveling}` |

> **Nota sobre pokedex como consumidor.** `getUnlockedMoveIds` (query) e
> `syncPokedex` (command) continuam no pokedex — eles fazem I/O de banco, e
> progression é domínio puro. Eles passam a importar as regras puras de
> `@/src/modules/progression` via `index.ts`. Módulo-a-módulo sempre pela
> fronteira do `index.ts` — nunca `progression/domain/*` direto de fora.

### Isolamento e contrato

- **O que o módulo faz:** concentra as regras puras de progressão (nível/stats,
  XP, evolução, learnset).
- **Como se usa:** importar de `@/src/modules/progression`. Só funções puras e
  tipos.
- **Do que depende:** de nada além de si mesmo (é `domain/` puro — sem Prisma,
  sem fetch, sem React).

## Testes

Os testes dos três domínios já existem em `tests/modules/pokedex/domain/` e
**movem junto** para `tests/modules/progression/domain/`, com o import do
sujeito-sob-teste atualizado para o novo caminho. Nenhuma lógica muda, então os
testes devem passar idênticos após o move — se algum quebrar, é sinal de import
mal reapontado, não de regressão de comportamento.

Cobertura que precisa continuar verde (CLAUDE.md — o que exige teste):
- `domain/` puro dos três arquivos (já coberto).

## Riscos e mitigação

- **Import esquecido (type-only).** A tabela acima cobre os símbolos de valor; um
  type-only (ex.: `EvolutionEdge`, `LearnDetail`, `Progress`) pode escapar. O
  plano faz uma varredura exaustiva por nome de símbolo antes de fechar. O `tsc`
  pega o que sobrar.
- **Comentários com caminho antigo.** Vários arquivos citam
  `pokedex/domain/leveling.ts` etc. em **comentário**, sem importar nada —
  `battle/domain/types.ts` (linhas 5, 13), `battle/commands/awardBattleXp.ts`, o
  próprio `leveling.ts`, `lib/pokeapi.ts`. Atualizar para `progression/domain/…`
  faz parte da tarefa (senão apontam pro mundo antigo).
- **graphify desatualizado.** Rodar `graphify update .` depois (CLAUDE.md).

## Verificação (antes de dar por pronto)

- `npx tsc --noEmit`
- `npx vitest run`
- `npx eslint`
- `npx next build`
- `graphify update .`
- Faxina de docs: comentários com caminho antigo atualizados; se algum doc
  (PLANO_JOGO.md, CLAUDE.md, AGENTS.md) referenciar `pokedex/domain/{leveling,
  evolution,learnset}`, reapontar para `progression/domain/`.

## Decisões (registro)

- **Escopo:** módulo `progression/` (opção A), não só `leveling` — porque o
  compartilhado com o battle são os três domínios, não um.
- **Fronteira:** corte limpo — pokedex para de reexportar; consumidores vão
  direto no progression. (vs. re-export de compat, que manteria o acoplamento
  conceitual do battle.)
- **Leveling:** mover inteiro (vs. rachar stats × xp agora) — o split SRP fica de
  TODO opcional.
- **DIP/repositório:** descartado.
