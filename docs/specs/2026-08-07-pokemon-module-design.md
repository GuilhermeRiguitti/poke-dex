# Módulo `pokemon` — desenho e plano de migração

**Data:** 2026-08-07 · **Estado:** ✅ EXECUTADO (etapas 1–6 e 8) em 2026-08-07

> Verificação no fim: `tsc` limpo, **395 testes em 43 arquivos**, `eslint` limpo,
> `next build` OK. As três conferências da seção 7 voltam vazias.
>
> **Desvios do plano** (decididos durante a execução, com o motivo):
>
> 1. **`weightForBst` NÃO foi pro `pokemon`.** O plano mandava mover junto com
>    `bstOf`/`rarityTier`. Olhando de perto, ele usa `BST_CEIL` e
>    `RARITY_EXPONENT`, que o próprio comentário chama de "botão de tuning do
>    drop rate" — é economia de pacote, não fato da espécie. Ficou em
>    `packs/domain/draw.ts` com o `drawPack`. O `pokemon` exporta `DEX_SIZE` pro
>    `draw.ts` montar o pool sem alcançar a tabela gerada.
> 2. **A apresentação da RARIDADE mudou de módulo, e isso não estava no plano.**
>    `rarityLabel`/`rarityColor`/`isTopRarity`/`holoIntensity` viviam em
>    `packs/ui/packView.ts`, e o `PokeCard` (agora em `pokemon/ui`) importava de
>    lá — o que criava exatamente o ciclo que a seção 6 mandava evitar. Foram
>    pra `pokemon/ui/rarityView.ts`, com o teste junto. Foi a conferência
>    "nenhum arquivo em `pokemon/` importa um irmão" que pegou isso.
> 3. **`DetailPanel.tsx` foi junto** com `PokemonStats`/`PokemonMoves` (o plano
>    não o listava): é a moldura das seções da ficha e não tem outro consumidor.
> 4. **Costura nova entre battle e pokemon:** `xpAwardsOf(context)` no
>    `awardBattleXp`, que achata o par vencedor/perdedor na lista que o `grantXp`
>    recebe. Sem ela, o `pokemon` teria que conhecer o formato `XpContext`, que é
>    da partida.
> 5. **`scripts/generate-rarity.mjs`** passou a escrever em
>    `src/modules/pokemon/domain/rarity.generated.ts`. Não estava no plano e
>    quebraria calado na próxima geração.
>
> A etapa 7 seguiu recusada, como planejado. A etapa 0 (commitar) ficou pro dono.

Objetivo: reunir num módulo só tudo que responde *"o que é este pokémon e como
ele muda"* — hoje espalhado por `progression`, `training`, `pokedex`, `deck`,
`packs` e `battle`. O pokémon é o núcleo do jogo e não tem módulo próprio.

---

## 1. Onde o pokémon mora hoje

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

### Três sinais de que a divisão atual está errada

1. **O `BaseStats` está arquivado no lugar errado.** O tipo mais compartilhado
   do código — 10 arquivos, em 5 módulos diferentes, precisam dele — mora num
   módulo chamado *progression*. O endereço descreve outra coisa: progressão é o
   que ACONTECE com o pokémon; `BaseStats` é o que ele É. Por isso ninguém acha:
   é o único tipo que aparece em `deck`, `packs`, `pokedex`, `battle` e na página
   do design-system ao mesmo tempo.

   > **Nota (2026-08-07):** a primeira versão deste doc dizia que "11 arquivos
   > furam a API pública do módulo". Estava errado. A maioria era `import type`
   > em `ui/`, onde o import direto é a convenção CERTA do projeto. Havia 4
   > imports diretos de fato indevidos (`deck/queries/toDeckBoardDTO`,
   > `packs/commands/openPack`, `packs/queries/toPackDTO`,
   > `app/design-system/page`) — **corrigidos fora deste plano**, antes de
   > começar. Hoje sobram 7 diretos, todos legítimos: 6 em `ui/` e o
   > `pokedex/types.ts`, que faz o papel de `ui/types.ts`.

   Sobra um detalhe que reforça a mudança: a convenção "`ui/` importa `domain/`
   direto" existe para o `index.ts` não arrastar Prisma até o browser. Só que o
   `progression` é 100% domínio puro — não reexporta uma query sequer. Hoje é
   regra sem motivo, seguida por imitação dos outros módulos. No `pokemon` ela
   passa a ter motivo de verdade, porque o módulo vai ter `queries/` e
   `commands/` com Prisma.
2. **O `battle` importa golpe do `deck`.** `getLoadoutOptions.ts` e
   `buildDuelSnapshot.ts` pegam `readLearnset` e `LearnsetMoveDTO` em
   `@/src/modules/deck` — mas learnset não tem nada a ver com montar time. A rota
   `/api/training/skills/[userPokemonId]` já escreve no comentário que "mora em
   training e não em deck porque ensinar é treino". A rota está num módulo e a
   query dela em outro.
3. **A carta é do `pokedex` e todo mundo importa de lá.** `PokeCard` é usado por
   `packs/ui/PackRevealCard`, `battle/ui/ReserveHand`, `pokedex/ui/CollectionGrid`,
   `PokedexGrid` e pelo design-system; o `dexNumber` é importado do `pokedexView`
   pelo `deck/ui/deckBoardView` e pelo `PackRevealCard`. A carta não é da PokéDex,
   é do pokémon.

---

## 2. O que fica em cada módulo

- **`pokemon`** — a espécie (espelho da PokéAPI), a carta do jogador
  (`UserPokemon`), e as regras que fazem ela mudar: nível, stats, XP, evolução,
  learnset, TM, BST/raridade. Mais o desenho da CARTA, que é o mesmo em toda tela.
- **`pokedex`** — a LISTA: filtrar, ordenar, paginar e navegar (coleção do
  jogador e catálogo). Não sabe o que é um nível; sabe ordenar por ele.
- **`deck`** montar o time · **`packs`** sortear e abrir · **`battle`** a partida.

> **Como decidir onde uma coisa vai:** se a resposta muda quando o pokémon sobe
> de nível ou evolui, é `pokemon`. Se muda quando o jogador troca o filtro ou a
> página, é `pokedex`.

Direção dos imports depois da mudança — `pokemon` não importa nenhum dos outros
módulos de feature:

```
pokedex ─┐
deck  ───┼──▶ pokemon ──▶ (domain puro + lib/prisma + lib/pokeapi)
packs ───┤
battle ──┘
```

Se em algum momento um arquivo dentro de `pokemon/` precisar importar de
`pokedex/`, `deck/` ou `battle/`, a divisão foi feita no lugar errado — pare e
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

## 4. Plano de migração — etapas

Cada etapa termina verde (`npx tsc --noEmit` · `npx vitest run` · `npx eslint` ·
`npx next build`) e vira um commit. Use `git mv` para o histórico seguir o
arquivo. Nenhuma etapa muda **comportamento** — é mudança de endereço.

**Comentário não é imutável.** Ao mover um arquivo, os comentários dele podem (e
devem) ser reescritos quando ficarem errados ou mal organizados no endereço novo:
referência a caminho que mudou, aviso que deixou de valer, bloco grande que cabe
melhor no `index.ts` do módulo. O que **não** pode sumir é o *porquê* de uma
decisão — quando um comentário explica uma armadilha já vivida (o claim
transacional, a evolução retroativa, o motivo de a barra da carta usar o base
stat e não o derivado), esse conteúdo continua, mesmo que reescrito com outras
palavras ou em outro arquivo.

### Etapa 0 — commitar o que está pendente

A árvore hoje tem mudança em andamento no `battle` (`resolveTurn`, `battleView`,
`DuelArena`, `toBattleDTO`) e no `PLANO_JOGO.md`. Commitar ou guardar isso
**antes**: renomeação em massa por cima de mudança não commitada faz um diff
que ninguém consegue revisar.

Nessa mesma leva vão os 4 imports diretos corrigidos em 2026-08-07 (ver a nota
da seção 1) — é conserto de convenção, não faz parte desta migração.

### Etapa 1 — criar o módulo com o domínio puro

- `git mv src/modules/progression/domain/*` → `src/modules/pokemon/domain/`
- `git mv src/modules/training/domain/tm.ts` → `src/modules/pokemon/domain/`
- Criar `pokemon/index.ts` reexportando o que os dois `index.ts` exportavam,
  agrupado por assunto com comentário (o `progression/index.ts` de hoje é o
  modelo). Apagar `progression/index.ts`.
- Mover os testes: `tests/modules/{progression,training}/domain/*` →
  `tests/modules/pokemon/domain/`.
- Atualizar os imports, mantendo a convenção que a árvore já respeita: **quem é
  de fora importa do `index.ts`**; **`ui/` importa de `domain/` por caminho
  relativo** (o `index.ts` arrasta Prisma para o bundle — é a exceção que o
  `pokeCardView.ts` já documenta). São 12 arquivos no primeiro grupo e 7 no
  segundo; a lista está na seção 1.

*Fim da etapa:* `grep -rn "modules/progression" src tests` volta vazio.

### Etapa 2 — a raridade volta para a espécie

- `git mv packs/domain/rarity.generated.ts` → `pokemon/domain/`
- Partir `packs/domain/rarity.ts` em dois: `bstOf`, `weightForBst`,
  `rarityTier`, `RarityTier` vão para `pokemon/domain/rarity.ts` (levando junto o
  bloco de comentário "FRONTEIRA", que continua valendo); `drawPack` e
  `PACK_SIZE` ficam em `packs/domain/draw.ts`, importando `bstOf`/`weightForBst`
  de `@/src/modules/pokemon`.
- Partir `tests/modules/packs/domain/rarity.test.ts` do mesmo jeito.
- Consumidores de `RarityTier`: `pokedex/types.ts`, `pokedex/ui/pokedexView.ts`,
  `pokeCardView.ts`, `syncPokedex.ts`.

### Etapa 3 — o espelho e a ficha da espécie

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

### Etapa 4 — os golpes da carta (apaga o `training`)

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

**Decisão:** as rotas continuam em `/api/training/*` nesta etapa. Renomear para
`/api/pokemon/*` é mudança de contrato com o cliente e merece etapa própria (ou
ficar como está — o nome "training" descreve bem a ação).

*Fim da etapa:* `grep -rn "modules/training" src tests` volta vazio.

### Etapa 5 — a carta

- `git mv pokedex/ui/{PokeCard.tsx,HoloCard.tsx,pokeCardView.ts,PokemonPortrait.tsx,
  PokemonStats.tsx,PokemonMoves.tsx}` → `pokemon/ui/`
- `dexNumber` sai do `pokedexView.ts` para o `pokeCardView.ts` (é formatação da
  carta, e hoje o `deck` e o `packs` já importam de lá). `detailView` +
  `STAT_LABELS`/`STAT_MAX` vão para `pokemon/ui/detailView.ts`. `collectionView`
  e `CollectionCardView` **ficam** no `pokedex` — é a view da lista — passando a
  importar `dexNumber` do `pokemon`.
- Reapontar: `CollectionGrid`, `PokedexGrid`, `battle/ui/ReserveHand`,
  `packs/ui/PackRevealCard`, `deck/ui/deckBoardView`, `deck/ui/DeckSlotCard`,
  `app/design-system/page.tsx`, `app/(game)/pokemon/[id]/page.tsx`.
- Testes: `tests/components/pokeCardView.test.ts` e `holoTilt.test.ts` →
  `tests/modules/pokemon/ui/`; a parte de `detailView` sai do
  `tests/modules/pokedex/ui/pokedexView.test.ts`.

### Etapa 6 — XP e evolução saem do `battle`

Partir `battle/commands/awardBattleXp.ts` em dois, na divisão que ele já tem:

- **fica no `battle`:** `loadXpContext` — lê as duas linhas de combatente e
  traduz para `{ userPokemonId, gainedXp }` usando `xpFromDefeat`/`LOSER_XP_SHARE`.
  É a tradução de partida → prêmio, e roda **fora** da transação (só lê).
- **vai para `pokemon/commands/grantXp.ts`:** `awardBattleXp` + `maybeEvolve` —
  aplicar XP, reescrever o par `(xp, level)` e evoluir em cadeia. É escrita sobre
  `UserPokemon`.

Cuidados que **não** podem mudar na mudança de lugar: a função continua recebendo
`tx: Prisma.TransactionClient` e rodando dentro da transação do `resolveTurn`
(fora dela pagaria XP duplicado a cada polling); a evolução continua retroativa
(checa em toda aplicação de XP, não só quando o nível sobe — não há worker para
consertar depois); e continua sem tocar no snapshot `BattlePokemon`. O *porquê*
desses três continua registrado — reescrito no endereço novo se couber melhor
(ver a nota sobre comentários no começo desta seção).

Testes: `tests/modules/battle/commands/awardBattleXp.test.ts` se divide entre
`tests/modules/battle/` (o contexto) e `tests/modules/pokemon/commands/` (a
escrita e a cadeia de evolução).

### Etapa 7 — o nascimento da carta (avaliada e recusada)

`openPack` calcula `birthLevelForSpecies` + `progressionFromLevel` e faz o
`createMany` de `UserPokemon`. Dá vontade de mover para
`pokemon/commands/createUserPokemon.ts`, mas **não fazer**: o `createMany` está
dentro do claim transacional do pacote, junto do débito do token; extrair
significa passar o `tx` para fora e espalhar o passo atômico por dois módulos,
sem ganho. A regra pura (o nível de nascimento) já fica no `pokemon` depois da
etapa 1, que era o que importava. Registrar a decisão e seguir.

### Etapa 8 — documentação

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

- **`src/lib/pokeapi.ts`** — o cliente HTTP é infra compartilhada, não regra de
  pokémon. `syncPokedex` continua consumindo. (O `lib/pokeapiCache.ts` que estava
  nesta linha foi removido em 2026-08-15 junto com a tabela `PokeApiCache`.)
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

1. **`pokemon` virar grande demais.** Fica com ~25 arquivos. O que segura isso é
   a lista da seção 5 e um `index.ts` agrupado por assunto. Se no fim o
   `pokemon/index.ts` passar de ~80 linhas de export sem separação clara por
   assunto, é sinal de que faltou recusar alguma coisa.
2. **Prisma no bundle do browser.** Ao trazer `PokeCard` e `SkillSheet` para
   `pokemon/ui`, manter as duas regras: componente **não** entra no `index.ts`, e
   `ui/` importa `domain/` por caminho relativo, nunca o barrel.
3. **Ciclo de import `pokemon` ↔ `pokedex`.** Hoje existe uma volta
   (`pokedex/types.ts` → `packs/domain/rarity`, e `packs` → `pokedex`). Depois
   das etapas 2 e 3 ela desaparece. Conferir no fim: nenhum arquivo em
   `src/modules/pokemon/` importa `modules/{pokedex,deck,packs,battle}`.
4. **Renome em massa.** Sempre `git mv`, um commit por etapa, e rodar a
   verificação completa antes de passar para a próxima.

## 7. Verificação

Por etapa: `npx tsc --noEmit` · `npx vitest run` · `npx eslint` · `npx next build`.

Conferências no fim:

```
grep -rn "modules/progression" src tests   # vazio (etapa 1)
grep -rn "modules/training"    src tests   # vazio (etapa 4)
grep -rn "modules/\(pokedex\|deck\|packs\|battle\)" src/modules/pokemon  # vazio
```

Nenhum teste novo é exigido por esta mudança — os que existem já cobrem
`domain/`, os views e os mappers, e devem continuar passando **sem alteração de
asserção**. Se um teste precisar mudar de expectativa, alguma etapa mudou
comportamento e isso não era para acontecer.
