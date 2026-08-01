# Coleção: filtros, busca e paginação no banco — e a progressão com uma fonte de verdade

Data: 2026-08-01

## Objetivo

Deixar a coleção navegável: filtro por raridade, filtro por tipo elemental, busca
por nome, ordenação por nível e paginação de 16 cartas. **Tudo resolvido no
banco** — nenhuma carta fora da página sai do Postgres.

Pra isso o banco precisa entender "raridade", que hoje só existe em JS. Isso abriu
um levantamento da progressão inteira, e a Fase 1 arruma o que ele achou.

## O que existe hoje

`getCollection(userId)` carrega a coleção **inteira** do usuário e calcula `bst` e
`rarity` em JS, pela tabela gerada `BST_BY_ID` (`packs/domain/rarity.ts`). A page
(`app/(game)/pokedex/page.tsx`) já é Server Component e não faz fetch de cliente.

No banco existem `UserPokemon.level`, `Pokemon.name` e `Pokemon.types` (Json).
**Não existe** coluna de BST nem de raridade — então filtrar raridade em SQL é
impossível sem mudar o schema.

### Quem escreve progressão (levantamento completo)

| Onde | Escreve |
|---|---|
| `packs/commands/openPack.ts:149` | `level` + `xp: xpForLevel(level)` |
| `battle/commands/awardBattleXp.ts:103` | `xp` + `level` (do `applyXp`) |
| `battle/commands/awardBattleXp.ts:142` | `pokemonId` (evolução) |
| `pokedex/commands/syncPokedex.ts:146` | a espécie inteira (único escritor de `Pokemon`) |

O motor de progressão **já calcula e persiste**: `applyXp` resolve o nível novo,
`maybeEvolve` evolui em cadeia, os dois gravam dentro da transação que encerra a
partida. O que não se guarda são os 6 stats de combate — eles derivam na leitura
por `deriveStats(baseStats, level)`, o que é possível porque **não há IV, EV nem
natureza**: o stat é função pura de (espécie, nível).

A exceção é `BattlePokemon.stats`, que guarda os stats derivados. Isso **não é
cache, é isolamento**: o snapshot é congelado de propósito pra um level-up no meio
da partida não mudar a partida em andamento, e pra sobreviver se a carta for
solta da coleção.

## A regra de decisão

> **Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto na leitura.**

Guardar valor derivado não remove uma fonte de verdade — **adiciona** uma. Só
compensa quando o banco precisa filtrar ou ordenar por aquilo, porque aí não há
alternativa. Fora disso o custo é real: todo valor materializado tem que ser
reescrito em todo evento que o afeta, e o CLAUDE.md §5 é explícito que aqui não
existe worker pra reparar estado corrompido depois.

Aplicando:

| Valor | Onde mora | Por quê |
|---|---|---|
| `xp` | `UserPokemon` | é a verdade |
| `level` | `UserPokemon` (já existe) | é `f(xp)`, mas a coleção **ordena** por ele |
| `pokemonId` | `UserPokemon` (já existe) | muda por evento (evolução) |
| `bst` | **`Pokemon` (novo)** | fato imutável da espécie; a coleção **filtra** por ele |
| `rarity` | **`Pokemon` (novo)** | idem — vira igualdade indexada |
| stats derivados | **lugar nenhum** | ninguém consulta por eles; `deriveStats` na leitura |
| `BattlePokemon.stats` | fica como está | isolamento, não cache |

`bst` e `rarity` vão em `Pokemon` (espécie) e **não** em `UserPokemon`. A evolução
troca `UserPokemon.pokemonId` (`awardBattleXp.ts:142`), então a carta muda de
raridade sozinha ao evoluir — Charmander 309 `common` → Charmeleon 405
`uncommon` → Charizard 534 `rare`. Se o valor estivesse cravado no `UserPokemon`,
evoluir deixaria o número velho pra trás e a carta ficaria classificada errada pra
sempre.

Subir de nível **não** muda raridade: BST é da espécie, não do nível.

---

# Fase 1 — Integridade da progressão

## 1.1 `Pokemon.bst` e `Pokemon.rarity`

```prisma
model Pokemon {
  // ...
  bst    Int    @default(0)        // soma dos 6 base stats — fortitude da espécie
  rarity String @default("common") // rarityTier(bst), congelado na importação

  @@index([rarity])
}
```

Índice só em `rarity` — é o único dos dois que entra em `WHERE`. `bst` é lido
sempre pela chave primária da linha que o join já trouxe; indexar seria peso de
escrita sem leitura que aproveite. Se um dia entrar "ordenar por força", o índice
entra junto.

`rarity` é `String` no Prisma (não há enum no schema hoje). O `RarityTier` é
recuperado no mapper do DTO com um cast, no mesmo ponto e pelo mesmo motivo que
o `baseStats` Json já faz — é a leitura do contrato que o `syncPokedex` escreveu.

Migration gerada por **`npx prisma migrate dev --create-only --name=pokemon_bst_rarity`**
contra o stack local (`127.0.0.1:54322`), seguindo o fluxo do CLAUDE.md. O
`--create-only` é obrigatório aqui: o arquivo precisa levar o backfill junto com o
`ALTER TABLE`, e sem ele a migration já nasce aplicada — editar depois quebra o
checksum.

Backfill no mesmo arquivo, somando o Json que já está lá (chaves de `BaseStats`:
`hp, atk, def, spa, spd, spe`):

```sql
UPDATE "Pokemon" SET "bst" =
    COALESCE(("baseStats"->>'hp')::int, 0)
  + COALESCE(("baseStats"->>'atk')::int, 0)
  + COALESCE(("baseStats"->>'def')::int, 0)
  + COALESCE(("baseStats"->>'spa')::int, 0)
  + COALESCE(("baseStats"->>'spd')::int, 0)
  + COALESCE(("baseStats"->>'spe')::int, 0);

UPDATE "Pokemon" SET "rarity" = CASE
  WHEN "bst" < 350 THEN 'common'
  WHEN "bst" < 480 THEN 'uncommon'
  WHEN "bst" < 580 THEN 'rare'
  ELSE 'legendary'
END;
```

Os cortes do `CASE` são os mesmos do `rarityTier` (`packs/domain/rarity.ts:50`).
Duplicar a regra em SQL é aceitável **só aqui**, porque a migration é imutável e
retrata o estado daquele dia; daí em diante quem decide é o TypeScript.

RLS: `Pokemon` já tem RLS ligada pela `20260714010000_enable_rls_all_tables`.
`ALTER TABLE ... ADD COLUMN` não mexe nisso — não há tabela nova, então não há
nada a ligar (AGENTS.md).

## 1.2 `syncPokedex` passa a gravar os dois

No `data` do upsert (`syncPokedex.ts:138`):

```ts
const baseStats = toBaseStats(p);
const bst = sumBaseStats(baseStats);
const data = {
  // ...campos atuais
  baseStats: baseStats as unknown as Prisma.InputJsonObject,
  bst,
  rarity: rarityTier(bst),
};
```

`sumBaseStats(base: BaseStats): number` é novo, puro, e mora em
`progression/domain/leveling.ts` — junto do `BaseStats` que ele soma.

Somar o `baseStats` que o próprio sync acabou de buscar (e **não** ler o
`BST_BY_ID`) é deliberado: a linha fica consistente consigo mesma, e uma espécie
que a tabela gerada não conhece ainda recebe o valor certo.

`refreshPokedex` reaproveita o `syncPokedex`, então re-sincronizar já regrava as
duas colunas — se um dia os cortes de raridade mudarem, a tabela gira sozinha ao
longo dos dias do cron. Pra valer na hora, é o mesmo `UPDATE ... CASE` acima numa
migration nova.

## 1.3 A fronteira do `BST_BY_ID`

`BST_BY_ID`/`bstOf` **continuam existindo** e não podem sumir: `drawPack` pondera
as 1025 espécies da dex, e a maioria não está no espelho `Pokemon` — não há linha
pra ler coluna de.

A fronteira, escrita no cabeçalho do `packs/domain/rarity.ts`:

- **`bstOf(apiId)` é do SORTEIO.** Serve `drawPack`, que trabalha sobre a dex
  inteira. Não use em nada que já tenha uma linha `Pokemon` na mão.
- **Quem tem a linha lê `pokemon.bst` / `pokemon.rarity`.**

Consequência direta: `getCollection` para de chamar `bstOf()` e `rarityTier()` e
passa a ler as colunas. Isso é o que garante que a raridade desenhada na carta é a
**mesma** que o filtro usou pra achar ela.

`rarityTier(bst)` continua sendo a única definição dos cortes — só que agora ela
roda na importação, não na leitura.

## 1.4 Evolução retroativa (bug)

`awardBattleXp.ts:110` só chama `maybeEvolve` quando `progress.gained > 0`, e
`maybeEvolve` (linha 140) desiste calado quando a espécie-alvo não está no
espelho.

Juntando os dois: se o Charmander cruza o nível 16 numa batalha em que o Charizard
ainda não foi semeado, ele não evolui — e **não evolui nunca mais**, porque a
checagem só volta a rodar no próximo nível ganho. No `MAX_LEVEL`, `gained` é
sempre 0, então trava de vez. `refreshPokedex` não salva: ele só re-sincroniza
espécies que **já existem** na tabela, nunca acrescenta as que faltam.

Correção: tirar a guarda `if (progress.gained > 0)` e chamar `maybeEvolve` em toda
aplicação de XP. É o mesmo padrão retroativo que o CLAUDE.md §5 exige do timeout de
turno — o estado se conserta quando alguém chega, em vez de depender de ter
acontecido na hora exata.

**Custo zero no caso saudável:** `evolutionTargetFor` é puro e devolve `null` sem
tocar no banco quando o nível não bate o gatilho da espécie atual. Um pokémon que
já evoluiu aponta pro estágio seguinte, cujo `evolvesToLevel` é mais alto — nenhum
`findUnique` extra. A ida ao banco só acontece no caso que hoje está quebrado.

## 1.5 `progressionFields(xp)`

`level` e `xp` têm que ser escritos juntos, sempre. Hoje isso é garantido por
convenção e por comentário nos dois escritores. Vira construção:

```ts
// progression/domain/leveling.ts
export function progressionFields(totalXp: number): { xp: number; level: number } {
  const xp = Math.max(0, Math.floor(totalXp));
  return { xp, level: levelFromXp(xp) };
}
```

`openPack` e `awardBattleXp` passam a montar o `data` com ele. Um escritor futuro
que use o helper não consegue produzir o par inválido.

## 1.6 Testes da Fase 1

- `sumBaseStats` bate com `bstOf` em espécies conhecidas: Charmander 309,
  Charizard 534, Magikarp 200, Arceus 720. **É o teste que prova que a coluna e a
  tabela gerada não divergiram.**
- `progressionFields(xp).level === levelFromXp(xp)` em toda a faixa, e nas bordas
  (0, 1, `xpForLevel(MAX_LEVEL)`, acima do teto, negativo, `NaN`).
- Evolução retroativa: pokémon acima do nível de gatilho que recebe XP **sem**
  subir de nível ainda assim evolui. Quebrar de propósito (repor o
  `if (gained > 0)`) tem que fazer o teste falhar.
- Evolução com alvo fora do espelho não lança e não escreve nada.

---

# Fase 2 — A tela da coleção

Depende das colunas da Fase 1.

## 2.1 Parser de filtros (puro)

`pokedex/domain/collectionFilters.ts`:

```ts
export const COLLECTION_PAGE_SIZE = 16;

export type CollectionSort = "captured" | "level_desc" | "level_asc";

export interface CollectionFilters {
  q: string | null;              // busca por nome, já trimada; null se vazia
  type: string | null;           // tipo elemental válido, senão null
  rarity: RarityTier | null;     // faixa válida, senão null
  sort: CollectionSort;          // default "captured"
  page: number;                  // >= 1
}

export function parseCollectionFilters(raw: Record<string, string | undefined>): CollectionFilters;
```

**Nunca lança.** Entrada de URL é entrada de usuário e isso roda no render de uma
page — um throw aqui vira tela de erro em vez de listagem (mesma razão do
`clampPage` atual, `pokedex/domain/pagination.ts:17`). Valor inválido vira `null`
ou o default.

A busca é **truncada** em 50 caracteres (não rejeitada — rejeitar faria a tela
piscar vazia por causa de um paste acidental), e os `%`/`_` são tratados pelo
Prisma, que parametriza o `contains` em vez de concatenar.

Os 18 tipos válidos saem das chaves de `lib/typeColors.ts`, numa constante
ordenada exportada pelo domain.

## 2.2 A query

`pokedex/queries/getCollectionPage.ts`:

```ts
const where: Prisma.UserPokemonWhereInput = {
  userId,
  pokemon: {
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
    ...(filters.type ? { types: { array_contains: [filters.type] } } : {}),
    ...(filters.rarity ? { rarity: filters.rarity } : {}),
  },
};

const [rows, total, deck] = await Promise.all([
  prisma.userPokemon.findMany({
    where,
    orderBy: orderByFor(filters.sort),
    skip: (filters.page - 1) * COLLECTION_PAGE_SIZE,
    take: COLLECTION_PAGE_SIZE,
    select: { /* mesma whitelist de hoje + pokemon.bst, pokemon.rarity */ },
  }),
  prisma.userPokemon.count({ where }),
  readDeck(userId),
]);
```

Só leitura, sem I/O de rede — pode ser chamada do render da page (CLAUDE.md,
regra 2). Não precisa de `$transaction`: é leitura, e uma pequena divergência
entre `count` e `findMany` não corrompe nada.

**`getCollection` é apagado, não mantido em paralelo.** O único consumidor é
`app/(game)/pokedex/page.tsx:20` — nenhuma rota de API, nenhum teste. Corte limpo:
sai a query, sai o export do `pokedex/index.ts:33`, entra `getCollectionPage`.
Deixar os dois vivos criaria duas leituras da coleção que podem discordar de
raridade.

`collectionView` (`ui/pokedexView.ts:64`), pelo mesmo motivo, é **adaptado** pra
receber o `CollectionPageDTO` em vez de duplicado. Ele hoje **não tem teste**,
apesar de ser exatamente o tipo de função que a regra 4 do CLAUDE.md manda testar;
esta fatia mexe nele, então o teste entra junto (é a melhoria pontual no código
que estamos tocando, não refatoração à parte).

### O `orderBy` precisa terminar em `id`

```ts
function orderByFor(sort: CollectionSort): Prisma.UserPokemonOrderByWithRelationInput[] {
  const head =
    sort === "level_desc" ? [{ level: "desc" as const }]
  : sort === "level_asc"  ? [{ level: "asc" as const }]
  : [];
  return [...head, { capturedAt: "asc" }, { id: "asc" }];
}
```

`openPack` cria as 6 cartas num `createMany` dentro de uma transação, e o `now()`
do Postgres é o mesmo pra todas — **as 6 cartas de um pacote têm `capturedAt`
idêntico**. Nível empata ainda mais (todo mundo nasce no mesmo nível).

Hoje isso não aparece porque a coleção inteira vem numa query só. Com
`LIMIT/OFFSET` aparece: em ordenação empatada o Postgres não garante a mesma
ordem entre duas queries, então uma carta pode sair na página 1 **e** na 2, e
outra sumir das duas. `id` é cuid e único — é o desempate final, e vale inclusive
pra ordenação padrão, que hoje é só `capturedAt`.

Isso é conserto obrigatório da paginação, não extra.

### Página fora do fim

`totalPages = max(1, ceil(total / 16))`. O parser garante `page >= 1`, mas não tem
como clampar o teto antes de saber o total. Se `page > totalPages`, a query volta
vazia e a tela mostra o estado vazio de filtro com um link pra página 1. Uma
query, sem re-consulta.

### Índices

Não vou adicionar `@@index([userId, level])`. Os filtros vivem na tabela
**juntada** (`Pokemon`), então o planner materializa o join e ordena de qualquer
jeito; e a coleção de um jogador é de dezenas a poucas centenas de linhas. O
índice `[userId, pokemonId]` que já existe cobre o recorte inicial.

**A verificar na implementação:** `array_contains: ["fire"]` em coluna Json do
Postgres vira `@>`, e `'["fire","flying"]'::jsonb @> '["fire"]'::jsonb` é `true`.
Confirmar com uma query real contra o banco local antes de fechar — se não
funcionar, o plano B é `types` virar tabela de relação, o que é migration maior.

## 2.3 DTO

`ui/types.ts` ganha:

```ts
export interface CollectionPageDTO {
  cards: CollectionCardDTO[];   // inalterado
  deck: { id: string; slots: { id: string; userPokemonId: string }[] } | null;
  page: number;
  totalPages: number;
  totalCards: number;           // total do filtro, pro "N cartas"
  totalInCollection: number;    // sem filtro — distingue os dois estados vazios
  filters: CollectionFilters;
}
```

Mapper explícito, campo a campo, como hoje. Teste provando que nada além da
whitelist passa.

`totalInCollection` custa um `count({ where: { userId } })` a mais, e paga: sem ele
não dá pra distinguir "não tem carta nenhuma" de "o filtro não achou nada", e as
duas telas são diferentes. **Esse count só é disparado quando há filtro ativo** —
sem filtro os dois totais são o mesmo número, e mandar a query duas vezes seria
uma invocação a mais por page load sem nada em troca (CLAUDE.md §5: cota).

## 2.4 UI

A page **continua Server Component**. Nenhum `useEffect`, nenhum estado de
carregando: muda a URL, o servidor repinta.

- **`CollectionFilterBar`** (`"use client"` — o único cliente novo): busca com
  debounce de ~300ms, select de raridade, select de tipo, select de ordenação.
  Escreve na URL com `useRouter().replace` dentro de `useTransition`. Mexer em
  qualquer filtro **volta pra página 1** (o href não carrega `page`).
- **`collectionFilterView.ts`** (puro, testado): filtros → o que os controles
  desenham (opções, valor selecionado, se aparece o "limpar filtros", o texto de
  resultado). Regra de apresentação não mora no componente (CLAUDE.md, regra 4).
- **`Pagination`** precisa de conserto pra ser reaproveitado: hoje tem
  `href="/?page=N"` cravado (`ui/Pagination.tsx:23`), o que joga o usuário do
  catálogo pra home. Passa a receber `hrefFor: (page: number) => string`, e cada
  página monta o seu preservando os outros parâmetros. Conserta o catálogo de
  quebra.
- **`CollectionGrid`** não muda.
- **`DeckSlots`** fica onde está, com as 6 vagas sempre, **fora** do filtro.
  `canToggle` continua vindo do deck inteiro, não da página.
- Dois estados vazios: "coleção vazia" (o de hoje, com link pro catálogo) e
  "nenhuma carta com esses filtros" (com botão de limpar).

## 2.5 Testes da Fase 2

- `parseCollectionFilters` com lixo: `page=abc`, `page=-3`, `rarity=ultra`,
  `type=<script>`, `q` de 500 caracteres, parâmetros ausentes.
- `orderByFor` termina em `id` nas três ordenações. Tirar o `id` tem que fazer o
  teste falhar.
- Mapper do `CollectionPageDTO` — nada fora da whitelist.
- `collectionFilterView` — opções, seleção e os dois estados vazios.

---

## Fora do escopo

- Filtrar por mais de um tipo ao mesmo tempo.
- Ordenar por nome, número da dex ou força — só nível, por decisão do dono.
- Favoritar / marcar carta.
- Paginação por cursor. `OFFSET` basta pra coleções deste tamanho.
- `Deck.userId` sem `@unique` (dívida conhecida, não relacionada).

## Comportamento aceito

Se uma batalha subir o nível de um pokémon enquanto o jogador está na página 2
ordenando por nível, a carta pula pra página 1 no próximo carregamento. É
inerente a paginar por `OFFSET` com chave que muda. Não é bug de progresso e não
vale a complexidade de um cursor.

## Verificação

`npx tsc --noEmit` · `npx vitest run` · `npx eslint` · `npx next build`

Mais, por ser mudança de schema: rodar o advisor de segurança do Supabase depois
da migration e confirmar que não apareceu `rls_disabled_in_public`.

## Docs a atualizar ao terminar

- `CLAUDE.md` — a regra "guarda o que o banco consulta, deriva o resto", e a
  fronteira `bstOf` (sorteio) × `pokemon.bst` (quem tem a linha).
- `AGENTS.md` — nada a mudar (não há tabela nova).
- `PLANO_JOGO.md` — registrar o conserto da evolução retroativa.
- `README.md` — a coleção agora é paginada e filtrável.
