@AGENTS.md

# Arquitetura

Sistema organizado em **módulos** com **separação command/query (CQRS "lite")**.
`src/modules/battle/` é a implementação de referência — na dúvida, copie o que
está lá.

> **CQRS aqui é separação de responsabilidade por pasta, não event sourcing.**
> Não existe event store, event bus, read model separado nem eventual
> consistency. Não introduza isso. `command` escreve, `query` lê. Só isso.

## Estrutura de um módulo

```
src/modules/<modulo>/
  index.ts        API pública. SÓ código de servidor.
  domain/         Regras puras. Sem Prisma, sem fetch, sem React.
  queries/        LEITURA. Recebe ids, devolve DTO.
  commands/       ESCRITA. Recebe intenção, aplica no banco.
  ui/             Apresentação. Componentes, hooks, view-model, DTOs.
```

| pasta | pode importar | NÃO pode importar |
|---|---|---|
| `domain/` | só a si mesma | Prisma, `fetch`, React |
| `queries/` | `domain/`, `lib/prisma`, `lib/pokeapi` | React, `commands/` |
| `commands/` | `domain/`, `queries/`, `lib/*` | React |
| `ui/` | `ui/`, tipos de `domain/` | **Prisma, `lib/auth`, `commands/`, `queries/`** |

`ui/` nunca importa nada que toque o banco — se importar, o Prisma vai parar no
bundle do browser.

### `index.ts` é a fronteira

Rotas (`app/api/**`) e pages (`app/**/page.tsx`) importam **só do `index.ts`**,
nunca de `domain/` / `queries/` / `commands/` direto.

**Componentes NÃO entram no `index.ts`.** As pages importam de
`@/src/modules/<mod>/ui/<Componente>` por caminho direto. Se um componente
`"use client"` fosse reexportado pelo barrel, toda rota de API que importa uma
query arrastaria a UI (e as libs pesadas dela) junto.

## Regras que valem ouro (foram aprendidas errando)

### 1. Page é servidor. Sempre.

Nenhum `page.tsx` leva `"use client"`. A page busca os dados no servidor e passa
por prop pro componente cliente. O `"use client"` desce o mais fundo possível na
árvore — idealmente só no componente que tem estado ou evento.

**O sintoma de que você errou:** a page virou servidor mas renderiza um único
componente cliente que é a página inteira. Isso não é refatorar, é mover o
`"use client"` de arquivo. O bundle continua idêntico.

**O ganho real** de tornar a page servidor não é organização — é **matar os
`fetch` de cliente que só existiam porque a page era cliente**. Se depois da
refatoração ainda sobrou um `useEffect` buscando os dados da primeira pintura,
com estado `loading` e um texto "Carregando...", **o trabalho não foi feito**.

### 2. Nunca escreva durante o render de uma page

Render de página **lê**. Escrita é `command`, disparada por rota de API ou
Server Action.

Não é purismo: uma escrita no render pode ser disparada por prerender no build
ou por prefetch, e se ela lançar (ou estourar o tempo da função), o usuário leva
**tela de erro no lugar da página** — não há estado de "carregando" pra segurar.

Por isso o módulo battle tem dois irmãos explícitos:

- `getBattleState()` — resolve o turno (**escreve**, pode bater na PokéAPI). Só rota de API.
- `readBattleState()` — só lê. É o que a page usa.

**Se uma query escreve ou faz I/O de rede, ela não pode ser chamada no render de
uma page.** Crie a versão só-leitura.

### 3. Toda saída pro cliente passa por um DTO

Linha do Prisma **nunca** vai crua pro browser — nem por `NextResponse.json()`,
nem por prop de Server Component.

Escreva um mapper explícito (`queries/toXxxDTO.ts`), campo a campo. Não é
boilerplate: no battle, a linha crua carregava `pendingMoves` — a jogada do
oponente **antes do turno resolver**. Dava pra ler no devtools e trapacear.
Whitelist explícita fecha isso por construção, e um teste trava o buraco:

```ts
expect(JSON.stringify(dto)).not.toContain("pendingMoves");
```

Os DTOs ficam em `ui/types.ts` — são o contrato entre servidor e UI, e como são
`interface`, não pesam no bundle.

### 4. Lógica de apresentação sai do componente

Mapear DTO → o que a tela desenha é **função pura**, mora em `ui/<x>View.ts` e
**tem teste**. Ver `ui/battleView.ts`. Componente é costura, não é onde regra mora.

### 5. Serverless (Vercel Hobby) não é detalhe, é restrição de projeto

- Toda page/rota é uma **função efêmera**. Depois que a resposta sai, a execução
  pode ser morta. Não existe processo longo nem trabalho em background.
- **Cron no Hobby roda 1x por dia.** Não dá pra ter worker. É por isso que a
  batalha resolve o turno **na leitura** (o polling do cliente empurra a
  partida). Não é gambiarra, é a única opção — e por isso **não existe nada pra
  reparar um estado corrompido depois**.
- **Toda escrita multi-passo vai numa `$transaction` interativa.** Se a função
  morrer no meio de uma sequência de escritas soltas, o dado quebra pra sempre.
  Ver `commands/resolveTurn.ts`: o claim (trava otimista) é a **primeira
  operação dentro da transação**, e o I/O lento (rede) fica **fora e antes** dela.
- Suba o `timeout` da transação — o default do Prisma (5s) é apertado pra lambda
  fria.

### 6. Concorrência: assuma duas lambdas ao mesmo tempo

Os dois jogadores fazem polling a cada 2s. Todo `command` roda concorrente com
ele mesmo.

- `findFirst` → `create` **é corrida.** Use `upsert` com constraint `@unique`.
- Sem `@unique` (ex: `Deck.userId`, que **ainda não tem**), no mínimo use um
  `orderBy` determinístico pra todo mundo convergir na mesma linha.
- Trava otimista: `updateMany({ where: { id, valor_esperado } })` e cheque o
  `count`. `count === 0` significa que você perdeu a corrida — **não escreva nada**.

## Onde as coisas moram

- `src/lib/` — infra **compartilhada** entre módulos: `prisma`, `auth`,
  `pokeapi`, `storage`, `typeColors`. Não é módulo, não tem regra de negócio.
- `src/components/` — só o que é **genuinamente global** (`NavBar`, `TypeBadge`,
  `icons`). Componente que serve um módulo só mora no `ui/` **dele**.
- `src/modules/<mod>/` — a feature inteira: regra, leitura, escrita e tela.

## Verificação

`npx tsc --noEmit` · `npx vitest run` · `npx eslint` · `npx next build`

O que **precisa** de teste:
- `domain/` — é puro, não tem desculpa.
- `ui/<x>View.ts` — a regra de apresentação.
- o mapper de DTO — provando que não vaza o que não pode.
- `command` concorrente — provando que quem perde o claim **não escreve nada**.

**Teste que passa não prova nada se não for capaz de falhar.** Quebre o código
de propósito e confirme que o teste acusa.

## Dívida conhecida

- `Deck.userId` não é `@unique` → requests concorrentes criam decks duplicados.
  Mitigado com `orderBy: createdAt asc` em quem lê; a cura é migration + `upsert`.
- Não existe `error.tsx` — qualquer throw em Server Component cai na tela de erro
  padrão do Next.
