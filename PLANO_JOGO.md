# Plano — de "batalha simultânea de 4 cartas" para duelo tático 1v1

> **Status: plano de design + estado de implementação.** É o mapa da virada que
> combinamos: turno **alternado** e reativo, coleção com **nível incremental**, e
> tudo de stat vindo da **PokéAPI**. A camada de infra (cron/Realtime) já está
> **parcialmente feita** (ver §8); o jogo em si (turno, coleção, dados) é proposta.
> **Documento único** — o antigo `TODO_TURNO.md` foi fundido aqui.

---

## 1. A visão em um parágrafo

**PokéDuel.** Você **coleciona Pokémon** — cada um nasce **nível 1** e sobe jogando.
Todo Pokémon tem acesso ao **learnset inteiro** que a PokéAPI devolve. Pra montar o
deck, você escolhe **um Pokémon** e **6 cartas (skills)** dele — sua "barra de
golpes". A batalha é **1×1, por turnos alternados**: você age, o oponente **vê ao
vivo** e **reage**, depois joga. A profundidade não vem de trocar de Pokémon; vem
de **ler o oponente, administrar recurso e reagir na hora certa** — e é exatamente
onde o Realtime deixa de ser enfeite e vira mecânica (a janela de reação é um
relógio real, sincronizado, empurrado pelo servidor).

Nada de stat é inventado por nós: **tudo deriva das base stats da API + o nível**.

---

## 2. Decisões travadas × decisões abertas

**Travadas (minhas escolhas de design; mexo se você quiser):**
- Turno **alternado** (não simultâneo). Speed vira **iniciativa** (quem começa a rodada).
- Deck = **1 Pokémon + 6 cartas** desse Pokémon (a carta é uma *skill*, não um Pokémon).
- **Stats 100% da API.** Some o nível 50 fixo e todo stat montado à mão.
- **Nível incremental**: captura no nv.1, sobe com XP, e o nível **multiplica** o
  efeito das skills (fórmula na §6).
- **Espelhar a PokéAPI no nosso banco** (tabelas `Pokemon`/`Move`) com **rotina de
  refresh** — revertendo de propósito a decisão atual de "nunca espelhar" (§7).

**Também travadas (respondidas):**
- **F1 — 1×1 puro**, com o schema já pronto pra time (troca vira uma fase depois).
- **F2 — o MVP (Fase A) já entra com energia + reação.** Não é o loop mínimo: é o
  jogo tático completo desde a primeira versão jogável (decisão do dono).
- **F3 — reset total liberado.** A base de dev pode ser recriada à vontade; não há
  dado válido a preservar (nem em prod). Sem migração de compatibilidade.

**Ainda aberta:**
- **F4 — curva de XP e multiplicador de skill por nível.** Proponho valores (§6) e
  a gente afina jogando.

---

## 3. O modelo de turno alternado (o coração criativo)

O risco do alternado ingênuo (que eu já te alertei): quem joga em 2º sempre tem mais
informação → desvantagem de quem começa; e o Speed perde sentido. As três peças
abaixo curam isso e criam o "tático e reativo".

### 3.1 Iniciativa (o Speed volta a importar)
No começo de cada **rodada**, quem tem **Speed efetivo maior age primeiro** (empate
= desempate determinístico por id, pra ser reconstruível como já é hoje). Assim o
Speed é uma decisão de build, não decoração — e quem começa alterna com o ritmo.

### 3.2 Economia de energia (a tensão de "gastar ou guardar")  *(fase B)*
Cada rodada você **ganha energia**. Cartas **custam** energia. Cartas fortes custam
mais; cartas de reação você só pode usar se **guardou** energia no turno do oponente.
Isso cria o dilema tático central: *descarrego agora ou seguro pra reagir?*

### 3.3 Janela de reação em tempo real (o showcase do Realtime)  *(fase C)*
Quando você joga uma carta, o oponente **vê ao vivo** (Broadcast) e, se tiver uma
**carta de reação** + energia guardada, abre uma **janela curta** (ex. 5s, um
countdown **real** empurrado pelo servidor) pra responder **antes da sua carta
resolver**. Fluxo: *age → (oponente reage?) → resolve → vez do oponente.*

Isso é impossível de fazer bem com o polling de 2s (a janela de reação seria
grosseira e trapaceável); com Broadcast + timer sincronizado, é preciso e justo.

### 3.4 O que muda no motor
- `Battle` ganha **de quem é a vez** (`activeUserId`) e a ordem de iniciativa.
- O turno passa a ser **de um ator só** — o modelo "os dois submetem pro turno N"
  (`BattlePendingMove`) vira **uma ação por vez** (`BattleAction`).
- `resolveTurn` deixa de casar duas jogadas e passa a **aplicar uma ação** (e, na
  fase C, resolver a interação ação↔reação). A **matemática de dano** e o engine
  puro em TS **continuam** — muda a *orquestração* do turno, não o cálculo.

> É uma reescrita real da orquestração (não trivial). Mas a trava otimista de
> concorrência e o "resolver dentro de uma transação" continuam valendo iguais.

---

## 4. As 4 melhorias de regra, encaixadas no modelo novo

1. **Abandono por desconexão (Presence).** Some o `missedTurns` que decai de 1 em 1
   (era remédio pra falta de relógio). Regra nova: se é a sua vez e a **Presence**
   mostra que você saiu e **não voltou em X s → o oponente vence**. Um timeout
   continua como *backstop* no `pg_cron` (caso raro dos dois offline).
2. **Timer real na tela.** `turnStartedAt` + duração viram um **countdown
   sincronizado** empurrado pelo servidor — vale pro turno e pra janela de reação.
   Abre espaço pra brincar: turno mais curto no começo, ou **banco de tempo estilo
   xadrez** por partida.
3. **Feedback ao vivo.** "Oponente está escolhendo", "jogou uma carta" (sem revelar
   qual até resolver), de quem é a iniciativa — tudo por Broadcast/Presence. Mata a
   tela morta de espera.
4. **Anti-enrolação direta.** Com relógio real, turno que estoura **passa
   automático** (ação nula / "hesitação") — regra legível, sem o contador
   acumulativo torto de hoje.

---

## 5. Novo modelo de dados (schema — esboço)

> Pode mudar à vontade, como você disse. `*ApiId` são as chaves de gestão/refetch.

**Espelho da PokéAPI (novo — substitui o "nunca espelhar"):**
```prisma
model Pokemon {                 // espécie
  id           String @id @default(cuid())
  pokemonApiId Int    @unique   // National Dex id — chave de refetch
  name         String
  types        Json             // ["electric"]
  baseStats    Json             // {hp,atk,def,spa,spd,spe}
  spriteUrl    String? @db.Text
  fetchedAt    DateTime @default(now())
  learnset     PokemonMove[]
  userPokemons UserPokemon[]
}

model Move {                    // skill
  id          String @id @default(cuid())
  moveApiId   Int    @unique
  name        String
  type        String
  power       Int?
  accuracy    Int?
  pp          Int
  priority    Int    @default(0)
  damageClass String            // physical | special | status
  effect      Json?             // efeitos estruturados (status, stat stage, etc.)
  fetchedAt   DateTime @default(now())
  learnedBy   PokemonMove[]
}

model PokemonMove {             // learnset (n:n)
  pokemonId String
  moveId    String
  pokemon   Pokemon @relation(fields: [pokemonId], references: [id], onDelete: Cascade)
  move      Move    @relation(fields: [moveId], references: [id], onDelete: Cascade)
  @@id([pokemonId, moveId])
}
```

**Coleção + nível (substitui `UserCard`):**
```prisma
model UserPokemon {
  id         String @id @default(cuid())
  userId     String
  pokemonId  String            // espécie
  level      Int    @default(1)
  xp         Int    @default(0)
  capturedAt DateTime @default(now())
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  pokemon    Pokemon @relation(fields: [pokemonId], references: [id])
  deckSlots  DeckSlot[]
  @@unique([userId, pokemonId])   // 1 instância por espécie (relaxar se quiser duplicatas)
}
```

**Deck = loadouts (substitui `DeckCard`):**
```prisma
model DeckSlot {                // um loadout: 1 Pokémon + 6 cartas
  id            String @id @default(cuid())
  deckId        String
  userPokemonId String
  order         Int
  cards         DeckSlotCard[]
  @@unique([deckId, order])
}

model DeckSlotCard {            // as 6 skills escolhidas
  id         String @id @default(cuid())
  deckSlotId String
  moveId     String
  order      Int                // 0..5 — posição na barra
  @@unique([deckSlotId, order])
  @@unique([deckSlotId, moveId])
}
```
*(`Deck` continua, trocando `deckCards` por `slots DeckSlot[]`.)*

**Batalha:** `Battle` ganha `activeUserId` + iniciativa; `BattlePendingMove` →
`BattleAction` (ação única por turno); o snapshot `BattlePokemon` passa a carregar
**stats derivados de base+nível**, o **loadout de 6 cartas**, e campos de estado que
entram por fase (`energy`, `cooldown` por carta, `statusEffects`). O princípio de
**snapshot congelado no início da partida** (§CLAUDE.md) **se mantém** — nível/API
mudando no meio não afeta partida em andamento.

---

## 6. Stats 100% da API + nível incremental

Remover: o nível 50 fixo e qualquer stat montado à mão. Derivar de **base stats da
API** com fórmula da série principal (simplificada, sem IV/EV no começo):

```
HP     = floor(2 * baseHP  * nível / 100) + nível + 10
Demais = floor(2 * base    * nível / 100) + 5
```

- **Nível** entra como multiplicador real de todo stat → cumpre "multiplicador nos
  status das skills" (o dano da skill escala pelo stat do atacante, que escala com
  nível). Se quiser que a *skill em si* também escale além do stat, adiciono um
  `skillPowerMult = 1 + (nível - 1) * k` (k ajustável) — é uma alavanca de balanço.
- **XP/progressão:** captura no nv.1; ganha XP por batalha (mais por vitória);
  nível sobe por curva. Depois dá pra amarrar **evolução** (a API dá a cadeia
  evolutiva) a um nível-alvo — gancho natural pra fase futura.

**Decisão aberta F4:** a curva de XP exata e o valor de `k`. Proponho valores e a
gente afina jogando.

---

## 7. Espelhar a PokéAPI + rotina de refresh

Hoje o projeto **não** espelha Pokémon (só cacheia JSON cru em `PokeApiCache`).
Revertemos isso de propósito, porque agora precisamos **consultar/filtrar por
atributo** (montar deck, listar learnset, ordenar por stat) — coisa que key-value
JSON não faz bem.

- **Seed inicial:** um backfill que popula `Pokemon`/`Move`/`PokemonMove` a partir da
  API (começar por uma geração pra não puxar tudo de uma vez).
- **Rotina de refresh:** **reaproveita o padrão de cron que já subimos** — rota
  `POST /api/cron/refresh-pokedex` (Bearer `CRON_SECRET`), que dá `upsert` por
  `pokemonApiId`/`moveApiId` no que estiver com `fetchedAt` velho. `pg_cron` roda
  isso devagar (1×/dia basta — dados de gen lançada quase não mudam). É o mesmo
  motor de cron do relógio de turno, outro job.
- `pokemonApiId`/`moveApiId` são a chave: identificam, deduplicam e guiam o refetch.

---

## 8. Infra de transporte, tempo e segurança (Realtime + cron)

Duas peças, papéis diferentes — **não confundir** (foi o erro clássico da discussão):

- **`pg_cron` = o relógio / worker.** Faz o tempo passar **sem cliente** (resolve o
  turno vencido de uma partida zumbi). É a única peça que o Realtime **não**
  substitui. Roda no Supabase (o "worker que não existe na Vercel Hobby").
- **Realtime = o push.** Avisa que o turno virou, pra tirar o cliente do polling. É
  **transporte, não computação** — não executa `resolveTurn`.

### 8.1 Realtime — as decisões (não eram óbvias, valem ouro)

- **Realtime é SINAL, não DADO.** O trigger no `Battle` empurra payload mínimo
  `{battleId, currentTurn, status}` por **Broadcast from Database**; o cliente refaz
  o `GET /api/battle/[id]` que **já passa pelo DTO**. **NÃO** usar **Postgres
  Changes** (assinar a tabela): streama a linha crua e **reabre o vazamento de
  `pendingMoves`** (regra 3 do CLAUDE.md).
- **Realtime NUNCA é autoritativo.** Só faz o caminho DTO'd disparar mais cedo.
  Mensagem perdida/duplicada/fora de ordem não importa: o refetch é idempotente e o
  **fallback de polling lento (15–30s)** cobre o buraco. Dispensa retry/ack/ordem.
- **Fronteira: "abrir o Realtime ≠ abrir o PostgREST".** A policy vai em
  **`realtime.messages`** (participante ↔ topic `battle:<id>`), **não** nas tabelas
  do app (que seguem deny-all). A key no browser só destrava o WebSocket, não lê
  `Battle`/`User` via REST → **não** reabre o buraco do `enable_rls_all_tables`.
  Quando isso entrar, o CLAUDE.md consequência #5 precisa ser reescrito com essa
  fronteira.
- **Auth: JWT customizado assinado com `SUPABASE_JWT_SECRET`** (rota nova
  `GET /api/realtime/token`; better-auth valida e assina). Casa com better-auth sem
  Supabase Auth. ⚠️ **Gotcha:** `auth.uid()` faz cast pra `uuid`, mas os ids são
  **cuid (texto)** → a policy lê `current_setting('request.jwt.claims', true)::jsonb->>'sub'`
  como **texto**. Copiar `auth.uid()` da doc = policy nega tudo em silêncio.
- **Cliente mais exigente:** a **janela de reação (§3.3)** — ela *precisa* do timer
  sincronizado por push pra ser justa (impossível com o polling de 2s).

### 8.2 Estado da implementação

✅ **Feito e verificado** (`tsc`·`vitest`·`eslint`·`next build` verdes):
- `src/app/api/cron/resolve-turns/route.ts` — rota `POST`, auth `Bearer <CRON_SECRET>`
  timing-safe e fail-closed. Chama `resolveDueBattles`.
- `src/modules/battle/commands/resolveDueBattles.ts` (+ teste) — varre partidas
  `IN_PROGRESS` com turno vencido, resolve via `resolveIfDue`, teto de 50/passada,
  sequencial, **isolando falhas**.
- Supabase: `pg_cron` 1.6.4 + `pg_net` 0.20.3 instalados (`pg_net` no schema
  `extensions`, advisor limpo). **Não** vão em migration Prisma (o dev é Postgres
  local sem essas extensões — quebraria; ver [[dev-db-is-local-postgres]]).
- `CRON_SECRET` no **Supabase Vault** (secret `cron_secret`); o job lê de lá.
- Bug do `migrate dev` (P1014 no `ALTER _prisma_migrations`) corrigido com guard
  `IF EXISTS` na migration de RLS.

⏳ **Pendente:**
1. **Agendar o job** — precisa da **URL de produção da Vercel** (o `.env` só tem
   `localhost`). SQL em §8.3.
2. **Setar `CRON_SECRET` na Vercel** (Settings → Environment Variables), MESMO valor
   do Vault. Reexibir: `select decrypted_secret from vault.decrypted_secrets where name='cron_secret';`
3. **Fase 2 Realtime no cliente** (as decisões de §8.1) — ainda não codada. Até lá o
   polling de 2s segue como fallback (e é o motor do dev local, que não tem Realtime).

### 8.3 Runbook do cron

Agendar (uma vez, no SQL Editor do Supabase — troque `SEU-DOMINIO`):
```sql
select cron.schedule(
  'resolve-battle-turns',
  '30 seconds',   -- só resolvemos turnos JÁ vencidos (>90s); 30s sobra e economiza
  $$
  select net.http_post(
    url     := 'https://SEU-DOMINIO.vercel.app/api/cron/resolve-turns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 5000
  );
  $$
);
```
Inspecionar / desfazer:
```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 10;
select id, status_code, error_msg from net._http_response order by id desc limit 10;
select cron.unschedule('resolve-battle-turns');
```

---

## 9. Roadmap (fatias verticais — cada fase é jogável)

> **Nota (F2):** o dono escolheu o MVP completo — energia e reação entram já na
> Fase A, não em fases separadas. As antigas B/C foram dobradas dentro de A.

| Fase | Entrega | Por que nessa ordem |
|---|---|---|
| **0 — Fundação de dados** ✅ | Tabelas `Pokemon`/`Move`/`PokemonMove`, seed, refresh cron, stats por nível, `UserPokemon` com nível/XP. Reset total da base. | Tudo depende dos dados virem da API e do nível existir. |
| **A — Duelo tático completo (MVP)** | Deck 1 loadout; turno alternado por iniciativa; **energia** por rodada + custo de carta; joga 1 das 6 cartas; **cartas de reação + janela de reação em tempo real**; HP→0 acaba. Realtime: reveal ao vivo, timer real sincronizado, Presence/abandono. | É o jogo tático inteiro já jogável. Maior e mais arriscado que um MVP mínimo — por isso a Fase 0 tem que estar sólida antes. |
| **D — Profundidade** | Efeitos ricos da API (status, mudança de stat, prioridade), cooldowns, evolução por nível, e **opcional** time de até 3 (troca). | Complexidade que empilha por cima do núcleo estável. |

### Estado da Fase 0 (implementada — dev local)

✅ **Feito e verificado** (`tsc`·`vitest` 159·`eslint`·`next build` verdes):
- **Schema + migration `20260716005502_phase0_pokedex_mirror`**: `Pokemon`,
  `Move`, `PokemonMove` (learnset n:n), `UserPokemon` (nível/XP, `@@unique
  [userId,pokemonId]`). RLS ligada nas 4 tabelas na mesma migration (AGENTS.md).
  **Aditiva** — `UserCard`/`DeckCard`/battle seguem intactos até a Fase A migrar.
- **`pokedex/domain/leveling.ts`** (+ 12 testes): `deriveStats` (fórmula §6, sem
  nível 50 fixo), curva de XP (`applyXp`/`xpForNextLevel`) e `skillPowerMult` —
  os valores de **F4** isolados em constantes tunáveis (`XP_PER_LEVEL`,
  `SKILL_POWER_K`).
- **`pokedex/commands/syncPokedex.ts`**: motor único (seed + refresh), upsert
  idempotente por `pokemonApiId`/`moveApiId`. **Não** usa `$transaction` de
  propósito (bulk re-rodável, não é escrita-claim atômica).
- **Seed**: `npm run seed` (`prisma/seed.ts`, via `tsx`). **Gen 1 semeada no dev
  local**: 151 espécies, 592 moves, 14368 vínculos de learnset.
- **Refresh cron**: `POST /api/cron/refresh-pokedex` (Bearer `CRON_SECRET`,
  `authorizeCron` compartilhado com `resolve-turns` em `lib/cronAuth.ts`) →
  `refreshPokedex` re-sincroniza o lote mais antigo (50/passada).

✅ **Infra de prod (atualizado 2026-07-15):** o `.env` agora aponta pro **Supabase**;
a migration `phase0` já está aplicada lá (tabelas existem) e a **Gen 1 foi semeada
no Supabase** (`npm run seed`). O `syncPokedex` passou a inserir o learnset com
`createMany`+`skipDuplicates` (o upsert por linha estourava o tempo da lambda no
cron); `DEFAULT_REFRESH_BATCH` caiu pra 20 (o gargalo do refresh é a rede da PokéAPI).

⏳ **Pendente da Fase 0:**
1. **Agendar o `refresh-pokedex` no `pg_cron`** (1×/dia) — mesmo runbook do §8.3,
   trocando a rota pra `/api/cron/refresh-pokedex` e usando a URL de prod da Vercel.

### Estado da Fase A (parcial)

✅ **A1 — núcleo puro do duelo alternado FEITO** (`tsc`+168 testes verdes):
`battle/domain/duelTypes.ts` (`DuelState`: `activeUserId`, round, order,
`actedThisRound`; ação de UM ator), `duelInitiative.ts` (Speed manda, desempate
determinístico por userId), `duelEngine.ts` (`startDuel`/`applyDuelAction` —
aplica UMA ação, passa a vez, recalcula iniciativa a cada rodada, encerra 1×1 no
faint). Reaproveita `calculateDamage`/`typeChart`/`STRUGGLE`. Arquivos NOVOS ao
lado do engine simultâneo antigo — o jogo atual segue vivo.

✅ **Realtime destravado:** `SUPABASE_JWT_SECRET` (legacy secret, "still used to
verify") já está no `.env`; URL + publishable key vêm do MCP. Falta codar
(policy `realtime.messages`, trigger, rota do token, cliente) — é a fatia A3.

⏳ **Próxima fatia — A1-wiring (backend, verificável sem Realtime):** migration
destrutiva (reset liberado) — `Battle` ganha `activeUserId`/round; `BattleAction`
no lugar de `BattlePendingMove`; `DeckSlot`/`DeckSlotCard`; `BattlePokemon` montado
de `UserPokemon`+nível (`deriveStats`) + 6 cartas. Reescrever buildTeamSnapshot
(lê o espelho, não a PokéAPI ao vivo), enqueueBattle, submitMove→submitAction,
resolveTurn com `applyDuelAction` (mesma trava otimista + transação). queries+DTO.
Popular `UserPokemon` no packs. **Depois:** UI battle-room, A2 energia, A3
reação+Realtime, Fase D.

**Aviso honesto sobre a Fase A:** com energia + reação já no MVP, ela é grande e o
**balanceamento** (custo de energia × poder de carta × janela de reação) só se acerta
iterando. Vale quebrá-la internamente em *sub-entregas testáveis* — (A1) loop
alternado + Realtime, (A2) energia, (A3) reação — mesmo entregando tudo como "Fase A".
A diferença pro plano rejeitado é que **não paramos e jogamos** entre elas; seguimos
direto até o jogo completo.

---

## 10. Riscos / o que quebra (honestidade)

- **Reset da coleção atual** (4 cartas + decks): o modelo muda demais; provável
  recomeçar a coleção (F3). Migração de batalhas em andamento: encerrar as abertas
  antes de migrar.
- **Reescrita da orquestração do turno** (simultâneo→alternado): é a parte cara. O
  engine de *dano* sobrevive; o *fluxo* muda bastante e precisa de teste novo.
- **Reverter "nunca espelhar Pokémon"**: atualizar CLAUDE.md/schema comments — hoje
  eles afirmam o contrário, e alguém vai se confundir se ficarem.
- **Custo de dados da API**: o seed puxa muita coisa; respeitar a fair-use (cache
  local, que agora é tabela de verdade) e semear por geração.
- **Balanceamento**: alternado com iniciativa/energia/reação é potente mas fácil de
  desbalancear. Só se acerta jogando — daí as fases serem jogáveis cedo.

---

## 11. Decisões

- **F1** ✅ 1×1 puro, schema pronto pra time.
- **F2** ✅ MVP já com energia + reação (jogo tático completo na Fase A).
- **F3** ✅ reset total da base liberado.
- **F4** ⏳ curva de XP e multiplicador de skill por nível — afinamos jogando (§6).

Com F1–F3 travadas, o schema da **Fase 0** já pode ser desenhado por completo. Próximo
passo natural: detalhar a Fase 0 (schema Prisma final + seed + refresh) e começar.
