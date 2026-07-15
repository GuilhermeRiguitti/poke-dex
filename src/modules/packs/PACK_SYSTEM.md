# Sistema de pacotes (packs)

Documentação do módulo `src/modules/packs/` — como funciona, o que entra no
cálculo de raridade, as regras, e uma auditoria de segurança (bypass,
integridade, IDOR, concorrência, DoS, CSRF, vazamento de DTO).

> **Contexto:** este é o ÚNICO jeito de obter pokémon. O "Capturar" direto da
> PokéDex morreu (rota `POST /api/cards`, `addCard` e o `CaptureButton` foram
> removidos). A dex virou catálogo view-only (`/catalog`); a coleção sai daqui.

---

## 1. Visão geral do fluxo

```
Cliente                     Servidor
───────                     ────────
[Abrir pacote]  POST /api/packs/open (sem body)
                │
                ├─ auth.api.getSession  ──► 401 se sem sessão
                │
                └─ openPack(userId)                        (commands/openPack.ts)
                     1. upsert PackState  (garante a linha, lê o estado)
                     2. pré-check de elegibilidade  ──► 409 on_cooldown (early)
                     3. drawPack()        (sorteia 6 ids, ponderado por BST)
                     4. fetchAndCachePokemon ×6   (aquece cache — FORA da tx)
                     5. $transaction:
                          a. CLAIM atômico (updateMany condicionado)
                             └─ perdeu a corrida? count 0 ► não escreve nada
                          b. lê quais o jogador já tinha (isNew)
                          c. upsert UserCard ×6  (repetida = no-op)
                     6. monta DTO (whitelist) ──► 201 { cards, packState }
```

Peças (todas em `src/modules/packs/`):

| arquivo | papel |
|---|---|
| `domain/rarity.ts` | peso de raridade, tiers, sorteio. Puro, testado. |
| `domain/rarity.generated.ts` | BST dos 1025 pokémon. Gerado offline. |
| `domain/cooldown.ts` | janela de 24h. Puro, testado. |
| `commands/openPack.ts` | ESCREVE. Sorteia, cobra o cooldown, grava as cartas. |
| `queries/readPackState.ts` | SÓ LÊ. Estado do cofre pro render da page. |
| `queries/toPackDTO.ts` | mapper carta → DTO (whitelist). |
| `ui/packView.ts` | apresentação pura (label/cor de raridade, cronômetro). |
| `ui/PackOpener.tsx` | `"use client"` — botão, cronômetro, revelação. |
| `app/api/packs/open/route.ts` | casca HTTP fina. |
| `scripts/generate-rarity.mjs` | gerador offline do índice de BST. |

---

## 2. O que é usado pra calcular a raridade: **BST**

A "fortitude" de um pokémon é o **BST (Base Stat Total)** — a soma dos 6 base
stats (`hp + attack + defense + special-attack + special-defense + speed`) que a
PokéAPI devolve em `/pokemon/{id}`.

### Por que BST, e não os outros candidatos

Foram medidos três campos reais da PokéAPI. Dois estão quebrados como sinal de
"força":

| campo | problema | evidência |
|---|---|---|
| `base_experience` | é recompensa de XP, não poder | **Blissey = 608** > Arceus (324); Blissey viraria a carta mais rara |
| `capture_rate` (species) | é tuning do minigame de captura | **Eternatus (lendário) = 255**, igual a Caterpie; Rayquaza = 45, igual a Gengar |
| **BST** | monotônico com poder real | Sunkern 180 → Pikachu 320 → Gengar 500 → Dragonite 600 → Mewtwo 680 → Arceus 720, sem inversões |

Bônus decisivo: **BST é o mesmo número que a engine de batalha já usa pra
calcular dano**. Raridade = poder real em partida, sem inventar uma segunda
métrica que discorde da primeira. E `stats[]` já vem no `NormalizedPokemon` que
já cacheamos — nenhum endpoint novo.

### De onde vem o número em runtime

BST de uma geração já lançada é **imutável**. Então ele é pré-computado **uma
vez, offline**, por `scripts/generate-rarity.mjs`, que varre os 1025 pokémon e
grava `domain/rarity.generated.ts`:

```ts
export const BST_BY_ID: readonly number[] = [ /* índice = pokemonId - 1 */ ];
```

Isso **não é um cron** de propósito: um job diário re-buscaria 1025 recursos pra
recalcular exatamente os mesmos números — desperdício e afronta à fair use
policy da PokéAPI. Rode o script à mão só quando sair uma geração nova (~anual).
O gerador **lança** se algum BST vier faltando, então o índice nunca tem buraco.

### A fórmula de peso

Em `domain/rarity.ts`:

```
BST_CEIL        = 800     (acima do máximo real, 720 → nada tem peso 0)
RARITY_EXPONENT = 2.5

peso(bst) = (BST_CEIL - bst) ^ 2.5
```

- Sempre **> 0** para um id válido → nenhum pokémon é impossível, só raro.
- Quanto maior o BST, menor o peso. A razão que importa é do "headroom"
  elevado ao expoente: Magikarp (BST 200) vs Mewtwo (680) →
  `(600/120)^2.5 = 5^2.5 ≈ 56×` mais raro por carta.
- `RARITY_EXPONENT` é o botão de tuning: sobe pra deixar os fortes mais raros.

### Tiers (só apresentação)

`rarityTier(bst)` classifica pela cor/borda da carta — **não** entra no sorteio
(o sorteio usa o peso contínuo):

| tier | BST | cor (token) |
|---|---|---|
| `common` | < 350 | `ink-dim` (cinza) |
| `uncommon` | < 480 | `ok` (verde) |
| `rare` | < 580 | `energy` (ciano) |
| `legendary` | ≥ 580 | `gold` (dourado, com aura) |

### O sorteio

`drawPack(rng, count=6, pool=1..1025)`: **roleta ponderada sem reposição**. A
cada uma das 6 rodadas, sorteia um id proporcional ao peso e o remove do pool —
então as 6 cartas são pokémon **distintos** dentro do pacote. O `rng` é injetado
(`Math.random` em produção; determinístico nos testes). `O(6 × pool)`, barato.

---

## 3. As regras

- **6 cartas por pacote**, distintas entre si.
- **1 pacote grátis a cada 24h**, medido por `PackState.lastFreePackAt`
  (`FREE_PACK_INTERVAL_MS = 24h`, em `domain/cooldown.ts`).
- **Conta nova nasce jogável**: `lastFreePackAt = null` ⇒ o primeiro pacote está
  disponível de cara, sem precisar de um "pacote inicial" separado.
- **Pacotes-bônus** (`PackState.extraPacks`): furam o cooldown. O `openPack`
  prefere o diário e só gasta um extra se o diário não estiver disponível. São
  concedidos pelo **streak de login** (ver §3.1).
- **Carta repetida**: se o jogador já tem o pokémon sorteado, a carta **sai
  mesmo assim**, marcada `isNew: false`. O `upsert` na constraint
  `@unique([userId, pokemonId])` do `UserCard` é no-op — não cria duplicata. É o
  gancho pra troca/pó no futuro.

### 3.1 Streak de login (recompensa por presença)

Uma marcação de presença diária concede os pacotes-bônus. Peças:
`domain/streak.ts` (puro, testado), `commands/checkInLogin.ts` (escreve),
`POST /api/packs/checkin` (casca), `ui/DailyCheckIn.tsx` (dispara no layout).

- **"Dia" é o dia UTC** (`utcDayIndex = floor(ms / 86.4M)`). O servidor não sabe
  o fuso do jogador de forma confiável; UTC é determinístico. Trade-off
  consciente: quem está perto da meia-noite vê o dia virar cedo/tarde pelo
  relógio local.
- **Regra do streak** (`nextStreak`): último check-in ontem → **+1**; hoje de
  novo → mantém (o claim no-opa); pulou ≥1 dia → **reseta pra 1**; nunca fez → 1.
- **Recompensa** (`earnsReward`): a cada **7 dias seguidos** (múltiplo de
  `STREAK_REWARD_CYCLE`), **+1 `extraPacks`**. O incremento vai no **mesmo
  `updateMany`** do check-in — atômico com a contagem, sem escrita separada que
  pudesse duplicar o bônus.
- **Quem dispara**: não há worker, então é um request que credita. O
  `<DailyCheckIn>` (client, montado no layout de `(game)`) chama a rota **uma
  vez por carga**, com guard em `sessionStorage` por dia UTC. Quando um novo dia
  conta, dá `router.refresh()` (atualiza o streak no dashboard); ao fechar um
  ciclo, mostra um toast do bônus.
- **Idempotência por dia**: `checkInLogin` cobra no máximo uma vez por dia via o
  claim condicionado a "ainda não fez check-in hoje" (`lastCheckIn < todayStart`
  ou null). Duas abas / dois refreshes no mesmo dia → o segundo sai com
  `count 0` e **não credita streak nem bônus** (travado por teste).

### Modelo de dados

```prisma
model PackState {
  userId         String    @id          // 1 linha por jogador — @id => único
  lastFreePackAt DateTime?              // null = nunca abriu
  extraPacks     Int       @default(0)
  loginStreak    Int       @default(0)  // dias seguidos de login (§3.1)
  lastCheckIn    DateTime?              // último check-in (dia UTC) (§3.1)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`userId` é `@id` (chave primária) **de propósito**: garante uma linha por
jogador por construção, e é o que deixa o claim otimista caber num `updateMany`
condicionado. (Contraste com a dívida do `Deck.userId`, que NÃO é `@unique` e
por isso gera decks duplicados — ver CLAUDE.md.)

---

## 4. Auditoria de segurança

Metodologia: seguir cada input que cruza a fronteira cliente→servidor e cada
escrita, procurando bypass (burlar a regra), quebra de integridade (estado
corrompido), IDOR (agir sobre recurso alheio), corrida e amplificação.

### 4.1 Achados (ranqueados por severidade)

| # | severidade | achado |
|---|---|---|
| 1 | **Baixa** | Rajada concorrente na janela elegível sorteia + busca por request antes do claim rejeitar os excedentes |
| 2 | **Baixa** | `POST /api/packs/open` sem proteção CSRF/`trustedOrigins` |
| 3 | Informativa | `Math.random` não é CSPRNG |

Nenhum achado **crítico ou alto**. As defesas de bypass, IDOR e integridade
estão corretas por construção (ver 4.3).

#### Achado 1 — amplificação por rajada concorrente (Baixa)

**Onde:** `commands/openPack.ts`, passos 3–5.

O pré-check barato (passo 2) faz o caminho de spam em cooldown retornar 409 sem
sortear nem tocar a PokéAPI. Mas, na **janela em que o jogador ESTÁ elegível**,
o sorteio (passo 3) e o aquecimento de cache (passo 4, até 6 `fetchAndCachePokemon`)
acontecem **antes** do claim atômico (passo 5). Se o jogador dispara N requests
concorrentes nesse instante, cada um roda o sorteio + até 6 buscas antes de o
claim decidir — mesmo que só **um** pacote seja concedido.

**Impacto:** limitado. É 1 vez a cada 24h por jogador (assim que um request
vence o claim, os outros e os próximos caem no cooldown). O `PokeApiCache`
absorve as buscas repetidas. Pior caso: um cold cache + rajada = alguns ×6
fetches numa janela por dia por jogador.

**Por que está assim:** o I/O de rede tem que ficar **fora** da transação
(CLAUDE.md, consequência #2 — transação aberta esperando rede estoura e segura
conexão do pooler). Mover o sorteio pra depois do claim colocaria rede dentro da
tx. O trade-off foi consciente.

**Mitigação (se um dia incomodar):** um rate-limit por usuário no endpoint (o
projeto ainda não tem rate-limit em lugar nenhum — ver TODO.md), ou um lock por
usuário antes do sorteio. Hoje: aceito e documentado.

#### Achado 2 — CSRF no POST (Baixa)

**Onde:** `app/api/packs/open/route.ts` + `src/lib/auth.ts` (sem `trustedOrigins`).

A rota é um POST que muda estado, autenticado por **cookie de sessão** e **sem
body**. Sem `trustedOrigins`/proteção CSRF configurada no better-auth (já
anotado no TODO.md), um site malicioso poderia forçar a vítima logada a disparar
`POST /api/packs/open`.

**Impacto:** muito baixo. O "ataque" faz a vítima abrir o **próprio** pacote
diário — algo que ela ia fazer de qualquer jeito, só que no timing do atacante.
Não vaza dado, não dá pacote ao atacante, não consome recurso alheio. É
incômodo, não dano.

**Mitigação:** a mesma que resolve o item de CSRF já aberto no TODO (configurar
`trustedOrigins`/`baseURL` no better-auth) cobre este endpoint junto.

#### Achado 3 — `Math.random` no sorteio (Informativa)

`drawPack` usa `Math.random`, que não é criptograficamente seguro. **Não é uma
fronteira de segurança:** o cliente não fornece seed nem influencia o RNG (ver
4.3), então não há como prever ou enviesar o sorteio remotamente. Trocar por
CSPRNG não muda nada explorável — fica como nota.

### 4.2 Superfícies checadas e LIMPAS

- **IDOR — nenhum.** O fluxo inteiro opera sobre o `userId` **da sessão**. A
  rota não aceita body, não há id de recurso vindo do cliente. O `upsert` de
  `UserCard` e o claim de `PackState` escopam `userId` no próprio `where`. Não há
  como abrir o pacote de outro, nem gravar carta na coleção alheia.
- **Manipulação de raridade — impossível pelo cliente.** O sorteio roda no
  servidor, com o índice de BST do servidor e `Math.random` do servidor. O
  cliente não manda seed, nem lista de ids, nem peso. Não dá pra "forçar um
  lendário".
- **Bypass de cooldown por relógio do cliente — não rola.** O `PackOpener`
  mostra um cronômetro e habilita o botão quando *acha* que 24h passaram, mas a
  autoridade é o servidor: `now = Date.now()` do servidor no `openPack`, e o
  claim condicionado. Cliente com relógio adiantado que dispara cedo leva **409**
  e um `router.refresh()`. Nenhum pacote é concedido antes da hora.
- **Vazamento de DTO — fechado.** `OpenPackResultDTO` passa por `toPackCardDTO`,
  que reusa a whitelist de 5 campos do `toPokemonCardDTO` + `bst/rarity/isNew`.
  O movepool inteiro (~130 moves com url) do `NormalizedPokemon` **não** trafega
  (travado por teste em `toPackDTO.test.ts`). `PackStateDTO` só expõe
  `canOpen/nextFreePackAt/extraPacks` — nada sensível.
- **Id inválido/injeção no sorteio — não há entrada.** Os ids saem do pool
  `1..1025` do próprio índice; nada vem do cliente.

### 4.3 Integridade e concorrência (o que está CERTO — não "conserte")

Estas são as defesas de que o serverless depende (CLAUDE.md, regras 5 e 6). Se
alguém mexer, quebra:

- **Claim atômico via `updateMany` condicionado.** O diário é
  `updateMany({ where: { userId, OR: [{ lastFreePackAt: null }, { lastFreePackAt: { lte: cutoff } }] }, data: { lastFreePackAt: now } })`.
  Sob **READ COMMITTED** (default do Postgres), quando dois requests disputam a
  MESMA linha, o segundo `UPDATE` espera o primeiro commitar e **reavalia o
  `WHERE` contra a linha já atualizada** (EvalPlanQual): `lastFreePackAt` virou
  `now`, a condição falha, `count = 0`. **Quem perde a corrida não escreve
  nenhuma carta** (travado por teste em `openPack.test.ts`). O extra é análogo:
  `updateMany({ where: { userId, extraPacks: { gt: 0 } }, data: { extraPacks: { decrement: 1 } } })`.
- **Tudo-ou-nada.** Claim + leitura de repetidas + `upsert` das 6 cartas vivem
  numa `$transaction` interativa (`{ timeout: 15_000, maxWait: 5_000 }`). A
  função morrendo no meio faz o Postgres dar rollback — não existe estado onde o
  cooldown foi cobrado mas as cartas não entraram, ou vice-versa. Não há worker
  pra reparar, então isso **tem** que ser atômico.
- **I/O lento antes e fora da transação.** O `fetchAndCachePokemon` (rede) roda
  antes do claim; a transação abre só pra escrever. É o que evita segurar
  conexão do pooler esperando rede.
- **Check-in idempotente por dia.** `checkInLogin` credita o streak/bônus num
  único `updateMany` condicionado a `lastCheckIn < todayStart` (ou null). Duas
  abas no mesmo dia → o segundo reavalia o `WHERE` (lastCheckIn já é hoje) e sai
  com `count 0`, sem dobrar streak nem bônus. O `+1` do bônus vai no MESMO
  `updateMany`, atômico com a contagem (travado por teste em `checkInLogin.test.ts`).
- **Uma linha por jogador por construção.** `PackState.userId @id` — sem
  `findFirst`+`create` (que seria corrida), sem risco de duplicata.
- **Escrita fora do render.** `readPackState` (usada no render das pages `/` e
  `/packs`) só faz `findUnique`, nunca escreve. A escrita mora no command,
  disparado por rota. (CLAUDE.md, regra 2.)
- **Autolimitação mata a amplificação antiga.** O "Capturar" antigo permitia
  1025 escritas + 1025 fetches num loop (item de segurança aberto no TODO).
  Trocá-lo pelo pacote (1/dia por jogador) **fecha esse item**: o volume de
  escrita e de chamadas à PokéAPI passa a ser limitado por construção.

### 4.4 Pendências relacionadas (não são deste módulo)

- **Rate-limit global** continua ausente no projeto (TODO.md). Resolveria o
  Achado 1 de tabela.
- **`trustedOrigins`/CSRF** no better-auth continua por configurar (TODO.md).
  Resolve o Achado 2 — e vale também pro `POST /api/packs/checkin`, que tem a
  mesma exposição (POST com cookie, sem body). Impacto igualmente baixo: forçar
  a vítima a fazer o próprio check-in do dia.
- **Fuso do streak é UTC.** Não é um bug, é a escolha documentada em §3.1.
  Migrar pro fuso do jogador exigiria capturar/persistir o timezone dele.
