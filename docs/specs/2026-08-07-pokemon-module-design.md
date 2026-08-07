# Módulo `pokemon` — desenho e plano de migração

**Data:** 2026-08-07 · **Estado:** proposto, nada implementado

Objetivo: reunir num módulo só tudo que responde *"o que é este pokémon e como
ele muda"* — hoje espalhado por `progression`, `training`, `pokedex`, `deck`,
`packs` e `battle`. O pokémon é o núcleo do jogo e não tem casa própria.

---

## 1. Diagnóstico: onde o pokémon mora hoje

| onde está | o que é |
|---|---|
| `progression/domain/{leveling,learnset,evolution}.ts` | stats derivados, XP/nível, learnset, evolução |
| `training/domain/tm.ts` + `commands/applyTM.ts` + `ui/SkillSheet.tsx` | ensinar golpe por TM |
| `pokedex/commands/{syncPokedex,refreshPokedex}.ts` | o espelho da PokéAPI (espécie, move, learnset n:n) |
| `pokedex/queries/getUnlockedMoveIds.ts` | os golpes que uma carta pode usar |
| `pokedex/queries/{getPokemonDetail,toPokemonDTO}.ts` + `ui/Pokemon{Stats,Portrait,Moves}.tsx` + `detailView` | a ficha da espécie |
| `pokedex/ui/{PokeCard,HoloCard,pokeCardView}.ts(x)` + `dexNumber` | a CARTA desenhada |
| `deck/queries/readLearnset.ts` + `LearnsetMoveDTO` | repertório da espécie + flag de TM |
| `packs/domain/rarity.ts` (`bstOf`, `weightForBst`, `rarityTier`) | BST e raridade — fato imutável da espécie |
| `battle/commands/awardBattleXp.ts` (a metade que escreve) | aplicar XP e evoluir o `UserPokemon` |

### As três provas de que a fronteira atual está errada

1. **Ninguém respeita o barril do `progression`.** 12 arquivos importam
   `@/src/modules/progression/domain/leveling` por caminho direto (`deck/ui/types.ts`,
   `packs/ui/types.ts`, `pokedex/types.ts`, `design-system/page.tsx`…). Quando todo
   mundo fura a porta da frente, a porta está no lugar errado.
2. **O `battle` importa golpe do `deck`.** `getLoadoutOptions.ts` e
   `buildDuelSnapshot.ts` pegam `readLearnset` e `LearnsetMoveDTO` em
   `@/src/modules/deck` — mas o learnset não tem nada a ver com montar time. A
   própria rota `/api/training/skills/[userPokemonId]` já escreve no comentário
   que "mora em training e não em deck porque ensinar é treino". A rota mora num
   módulo e a query dela mora em outro.
3. **A carta é do `pokedex` e todo mundo pede emprestado.** `PokeCard` é
   importado por `packs/ui/PackRevealCard`, `battle/ui/ReserveHand`,
   `pokedex/ui/CollectionGrid`, `PokedexGrid` e pela página do design-system; o
   `dexNumber` é importado do `pokedexView` pelo `deck/ui/deckBoardView` e pelo
   `PackRevealCard`. A carta não é da PokéDex — é do pokémon.

---

## 2. A linha que separa

- **`pokemon`** — a espécie (espelho da PokéAPI), a carta do jogador
  (`UserPokemon`), e as regras que fazem ela mudar: nível, stats, XP, evolução,
  learnset, TM, BST/raridade. Mais o desenho da CARTA, que é o mesmo em toda tela.
- **`pokedex`** — a LISTA: filtrar, ordenar, paginar e navegar (coleção do
  jogador e catálogo). Não sabe o que é um nível; sabe ordenar por ele.
- **`deck`** montar o time · **`packs`** sortear e abrir · **`battle`** a partida.

> **Regra de bolso:** se a resposta muda quando o pokémon sobe de nível ou
> evolui, é `pokemon`. Se muda quando o jogador troca o filtro ou a página, é
> `pokedex`.

Direção das dependências depois do movimento — `pokemon` não importa nenhum dos
outros módulos de feature:

```
pokedex ─┐
deck  ───┼──▶ pokemon ──▶ (domain puro + lib/prisma + lib/pokeapi)
packs ───┤
battle ──┘
```

Se em algum momento um arquivo dentro de `pokemon/` precisar importar de
`pokedex/`, `deck/` ou `battle/`, a linha foi cortada no lugar errado — pare e
reveja, não adicione o import.

---

## 3. Estrutura alvo

```
src/modules/pokemon/
  index.ts                    API pública. Só servidor. Componentes NÃO entram.
  domain/
    leveling.ts               ← progression/domain/leveling.ts
    learnset.ts               ← progression/domain/learnset.ts
    evolution.ts              ← progression/domain/evolution.ts
    tm.ts                     ← training/domain/tm.ts
    rarity.ts                 ← packs/domain/rarity.ts (menos drawPack)
    rarity.generated.ts       ← packs/domain/rarity.generated.ts
  queries/
    getUnlockedMoveIds.ts     ← pokedex/queries/
    readLearnset.ts           ← deck/queries/
    getPokemonDetail.ts       ← pokedex/queries/
    toPokemonDTO.ts           ← pokedex/queries/
  commands/
    syncPokedex.ts            ← pokedex/commands/
    refreshPokedex.ts         ← pokedex/commands/
    applyTM.ts                ← training/commands/
    grantXp.ts                ← metade de battle/commands/awardBattleXp.ts
  ui/
    types.ts                  PokemonCardDTO, PokemonDetailDTO, PokemonStatDTO,
                              LearnsetMoveDTO, TeachTmResponseDTO
    PokeCard.tsx, HoloCard.tsx, pokeCardView.ts (com dexNumber)
    PokemonPortrait.tsx, PokemonStats.tsx, PokemonMoves.tsx, detailView
    SkillSheet.tsx            ← training/ui/
```

`src/modules/progression/` e `src/modules/training/` deixam de existir.

O que sobra em cada vizinho:

- **`pokedex/`** — `domain/{collectionFilters,pagination}.ts`,
  `queries/{collectionWhere,getCollectionPage,toCollectionPageDTO,listPokedexPage}.ts`,
  `commands/removeCard.ts`, `types.ts` (só `CollectionCardDTO`, `CollectionPageDTO`,
  `PokedexPageDTO`), `ui/{CollectionGrid,CollectionFilterBar,CollectionCardDrag,
  CollectionDropZone,CollectionCardActions,PokedexGrid,Pagination,DetailPanel}` +
  `collectionFilterView`, `paginationView`, `collectionView`.
- **`deck/`** — tudo menos `readLearnset` e `LearnsetMoveDTO`.
- **`packs/`** — `drawPack` (vira `domain/draw.ts`), cooldown, streak, check-in,
  `openPack`, DTOs do pacote.
- **`battle/`** — tudo menos a metade que escreve XP.

---

## 4. Plano de migração — fatias

Cada fatia termina verde (`npx tsc --noEmit` · `npx vitest run` · `npx eslint` ·
`npx next build`) e vira um commit. Use `git mv` para o histórico seguir o
arquivo. Nenhuma fatia muda comportamento — é mudança de endereço.

### Fatia 0 — limpar a mesa

A árvore hoje tem o refactor do deck em andamento (`saveDeck`, arquivos
apagados, `PLANO_JOGO.md`/`TODO.md` modificados). Commitar ou guardar isso
**antes**: renomeação em massa por cima de mudança não commitada faz um diff
que ninguém consegue revisar.

### Fatia 1 — nasce o módulo com o domínio puro

- `git mv src/modules/progression/domain/*` → `src/modules/pokemon/domain/`
- `git mv src/modules/training/domain/tm.ts` → `src/modules/pokemon/domain/`
- Criar `pokemon/index.ts` reexportando o que os dois barris exportavam,
  agrupado por assunto com comentário (o `progression/index.ts` de hoje é o
  modelo). Apagar `progression/index.ts`.
- Mover os testes: `tests/modules/{progression,training}/domain/*` →
  `tests/modules/pokemon/domain/`.
- Atualizar os imports. Convenção, para não repetir o furo de hoje: **quem é de
  fora importa do `index.ts`**; **`ui/` importa de `domain/` por caminho
  relativo** (o barril arrasta Prisma para o bundle — é a exceção que o
  `pokeCardView.ts` já documenta).

*Fim da fatia:* `grep -rn "modules/progression" src tests` volta vazio.

### Fatia 2 — a raridade volta para a espécie

- `git mv packs/domain/rarity.generated.ts` → `pokemon/domain/`
- Partir `packs/domain/rarity.ts` em dois: `bstOf`, `weightForBst`,
  `rarityTier`, `RarityTier` vão para `pokemon/domain/rarity.ts` (levando junto o
  bloco de comentário "FRONTEIRA", que continua valendo); `drawPack` e
  `PACK_SIZE` ficam em `packs/domain/draw.ts`, importando `bstOf`/`weightForBst`
  de `@/src/modules/pokemon`.
- Partir `tests/modules/packs/domain/rarity.test.ts` na mesma linha.
- Consumidores de `RarityTier`: `pokedex/types.ts`, `pokedex/ui/pokedexView.ts`,
  `pokeCardView.ts`, `syncPokedex.ts`.

### Fatia 3 — o espelho e a ficha da espécie

- `git mv pokedex/commands/{syncPokedex,refreshPokedex}.ts` → `pokemon/commands/`
- `git mv pokedex/queries/{getPokemonDetail,toPokemonDTO}.ts` → `pokemon/queries/`
- Partir `pokedex/types.ts`: `PokemonCardDTO`, `PokemonDetailDTO`,
  `PokemonStatDTO` vão para `pokemon/ui/types.ts` (o padrão do `battle` e do
  `deck` é DTO em `ui/types.ts`); `CollectionCardDTO`, `CollectionPageDTO`,
  `PokedexPageDTO` ficam no `pokedex`, importando `PokemonCardDTO` do `pokemon`.
- Consumidores a reapontar: `app/api/cron/refresh-pokedex/route.ts`,
  `app/(game)/pokemon/[id]/page.tsx`, `packs/{ui/types.ts,queries/toPackDTO.ts,
  commands/openPack.ts}`, `prisma/seed` se houver.
- Testes: `tests/modules/pokedex/queries/toPokemonDTO.test.ts` →
  `tests/modules/pokemon/queries/`.

### Fatia 4 — os golpes da carta (mata o `training`)

- `git mv pokedex/queries/getUnlockedMoveIds.ts` → `pokemon/queries/`
- `git mv deck/queries/readLearnset.ts` → `pokemon/queries/`; `LearnsetMoveDTO`
  sai de `deck/ui/types.ts` para `pokemon/ui/types.ts`.
- `git mv training/commands/applyTM.ts` → `pokemon/commands/`;
  `git mv training/ui/SkillSheet.tsx` → `pokemon/ui/`; `TeachTmResponseDTO` para
  `pokemon/ui/types.ts`. Apagar `src/modules/training/`.
- Reapontar: `app/api/training/tm/route.ts`,
  `app/api/training/skills/[userPokemonId]/route.ts`,
  `battle/queries/getLoadoutOptions.ts`, `battle/commands/buildDuelSnapshot.ts`,
  `battle/ui/LoadoutPicker.tsx`, `pokedex/ui/CollectionCardActions.tsx`.
- Testes: `tests/modules/training/**` e
  `tests/modules/pokedex/queries/getUnlockedMoveIds.test.ts` →
  `tests/modules/pokemon/`.

**Decisão:** as rotas continuam em `/api/training/*` nesta fatia. Renomear para
`/api/pokemon/*` é mudança de contrato com o cliente e merece fatia própria (ou
ficar como está — o nome "training" descreve bem a ação).

*Fim da fatia:* `grep -rn "modules/training" src tests` volta vazio.

### Fatia 5 — a carta

- `git mv pokedex/ui/{PokeCard.tsx,HoloCard.tsx,pokeCardView.ts,PokemonPortrait.tsx,
  PokemonStats.tsx,PokemonMoves.tsx}` → `pokemon/ui/`
- `dexNumber` sai do `pokedexView.ts` para o `pokeCardView.ts` (é formatação da
  carta, e hoje o `deck` e o `packs` já vão buscar lá). `detailView` +
  `STAT_LABELS`/`STAT_MAX` vão para `pokemon/ui/detailView.ts`. `collectionView`
  e `CollectionCardView` **ficam** no `pokedex` — é a view da lista — passando a
  importar `dexNumber` do `pokemon`.
- Reapontar: `CollectionGrid`, `PokedexGrid`, `battle/ui/ReserveHand`,
  `packs/ui/PackRevealCard`, `deck/ui/deckBoardView`, `deck/ui/DeckSlotCard`,
  `app/design-system/page.tsx`, `app/(game)/pokemon/[id]/page.tsx`.
- Testes: `tests/components/pokeCardView.test.ts` e `holoTilt.test.ts` →
  `tests/modules/pokemon/ui/`; a parte de `detailView` sai do
  `tests/modules/pokedex/ui/pokedexView.test.ts`.

### Fatia 6 — XP e evolução saem do `battle`

Partir `battle/commands/awardBattleXp.ts` em dois, na costura que ele já tem:

- **fica no `battle`:** `loadXpContext` — lê as duas linhas de combatente e
  traduz para `{ userPokemonId, gainedXp }` usando `xpFromDefeat`/`LOSER_XP_SHARE`.
  É a tradução de partida → prêmio, e roda **fora** da transação (só lê).
- **vai para `pokemon/commands/grantXp.ts`:** `awardBattleXp` + `maybeEvolve` —
  aplicar XP, reescrever o par `(xp, level)` e evoluir em cadeia. É escrita sobre
  `UserPokemon`.

Cuidados que **não** podem mudar no movimento: a função continua recebendo
`tx: Prisma.TransactionClient` e rodando dentro da transação do `resolveTurn`
(fora dela pagaria XP duplicado a cada polling); a evolução continua retroativa
(checa em toda aplicação de XP, não só quando o nível sobe — não há worker para
consertar depois); e continua sem tocar no snapshot `BattlePokemon`. Os
comentários que explicam isso vão junto.

Testes: `tests/modules/battle/commands/awardBattleXp.test.ts` se divide entre
`tests/modules/battle/` (o contexto) e `tests/modules/pokemon/commands/` (a
escrita e a cadeia de evolução).

### Fatia 7 — o nascimento da carta (avaliada e recusada)

`openPack` calcula `birthLevelForSpecies` + `progressionFromLevel` e faz o
`createMany` de `UserPokemon`. Tentador mover para
`pokemon/commands/createUserPokemon.ts`, mas **não fazer**: o `createMany` está
dentro do claim transacional do pacote, junto do débito do token; extrair
significa passar o `tx` para fora e espalhar o passo atômico por dois módulos,
sem ganho. A regra pura (o nível de nascimento) já mora no `pokemon` depois da
fatia 1, que era o que importava. Registrar a decisão e seguir.

### Fatia 8 — documentação

Parte da tarefa, não passo extra (CLAUDE.md):

- `CLAUDE.md` — a seção "Onde as coisas moram", os exemplos da regra 3.1 (que
  citam `progressionFromXp`/`deriveStats`) e o parágrafo da "Fronteira do BST"
  passam a apontar para `pokemon/`.
- `README.md` — a lista de módulos.
- `TODO.md` — o item "Split opcional do `progression/domain/leveling.ts`" muda
  para `pokemon/domain/leveling.ts` (e o link para o spec, que hoje aponta para
  um `docs/superpowers/specs/` que não existe mais).
- `PLANO_JOGO.md` — só se alguma seção citar caminho de arquivo movido.
- `src/modules/packs/PACK_SYSTEM.md` — cita `domain/rarity.ts`.
- `graphify update .` no fim.

---

## 5. O que NÃO se move (e por quê)

- **`src/lib/pokeapi.ts` e `lib/pokeapiCache.ts`** — cliente HTTP e cache são
  infra compartilhada, não regra de pokémon. `syncPokedex` continua consumindo.
- **`battle/domain/typeChart.ts`** — efetividade de tipo é regra de DANO e só a
  batalha usa. Mover criaria dependência nova sem consumidor novo.
- **`battle/queries/loadMoveDefs.ts`** — lê `Move` do espelho, mas o formato de
  saída (`BattleMoveDef`, com PP corrente) é do motor de combate.
- **`deck/domain/defaultLoadout.ts`** — "qual barra montar quando o jogador não
  escolhe" é regra de deck/batalha, não da espécie.
- **`drawPack`, `cooldown`, `streak`** — sorteio e economia são do `packs`.
- **A coleção inteira** (filtros, paginação, `collectionWhere`, `removeCard`,
  grades, `CollectionCardActions`) — é `pokedex`.

---

## 6. Riscos

1. **Módulo-deus.** `pokemon` fica com ~25 arquivos. O que segura é a lista da
   seção 5 e um `index.ts` agrupado por assunto. Se depois de tudo o
   `pokemon/index.ts` passar de ~80 linhas de export sem separação clara por
   assunto, é sinal de que faltou recusar alguma coisa.
2. **Prisma no bundle do browser.** Ao trazer `PokeCard` e `SkillSheet` para
   `pokemon/ui`, manter as duas regras: componente **não** entra no `index.ts`, e
   `ui/` importa `domain/` por caminho relativo, nunca o barril.
3. **Ciclo `pokemon` ↔ `pokedex`.** Hoje existe uma volta (`pokedex/types.ts` →
   `packs/domain/rarity`, e `packs` → `pokedex`). Depois da fatia 2 e 3 ela
   desaparece. Conferir no fim: nenhum arquivo em `src/modules/pokemon/` importa
   `modules/{pokedex,deck,packs,battle}`.
4. **Renome em massa.** Sempre `git mv`, um commit por fatia, e rodar a
   verificação completa antes de passar para a próxima.

## 7. Verificação

Por fatia: `npx tsc --noEmit` · `npx vitest run` · `npx eslint` · `npx next build`.

Greps de sanidade ao fim:

```
grep -rn "modules/progression" src tests   # vazio (fatia 1)
grep -rn "modules/training"    src tests   # vazio (fatia 4)
grep -rn "modules/\(pokedex\|deck\|packs\|battle\)" src/modules/pokemon  # vazio
```

Nenhum teste novo é exigido por este refactor — os que existem já cobrem
`domain/`, os views e os mappers, e devem continuar passando **sem alteração de
asserção**. Se um teste precisar mudar de expectativa, alguma fatia mudou
comportamento e isso não era para acontecer.
