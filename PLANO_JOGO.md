# Plano — duelo tático 1v1 fiel à série

> **Status: plano de design + estado de implementação.** Coleção com **nível
> incremental**, tudo de stat vindo da **PokéAPI**, e turno **SIMULTÂNEO** (os
> dois escolhem às cegas; o Speed decide quem bate primeiro).
> **Documento único** — o antigo `TODO_TURNO.md` foi fundido aqui.
>
> ⚠️ **O turno alternado foi revertido (2026-07-21).** A Fase A1 chegou a
> implementar turno alternado (`activeUserId`, uma ação por vez). Não é como o
> Pokémon funciona, e o preço era alto: quem jogava em segundo escolhia **já
> sabendo** a jogada do outro, e o Speed virava "quem começa a rodada" em vez de
> "quem bate primeiro". Voltamos ao simultâneo — ver §3. As seções abaixo já
> refletem o modelo atual.

---

## 1. A visão em um parágrafo

**PokéDuel.** Você **coleciona Pokémon** — cada um nasce em **nível 5** e sobe
jogando. O nível **libera skills**: cada Pokémon só conhece o que já aprendeu por
level-up naquele nível, exatamente como a PokéAPI descreve (`level_learned_at`).
Pra montar o deck, você escolhe **um Pokémon** e **até 6 cartas (skills)** dele —
sua "barra de golpes". A batalha é **1×1 por turnos SIMULTÂNEOS**: os dois
escolhem a carta do mesmo round **sem ver a do outro**, e quem tem mais Speed
executa primeiro (priority do golpe vem antes de tudo). A profundidade vem de
**ler o oponente e apostar** — não de reagir depois de ver.

Nada de stat é inventado por nós: **tudo deriva das base stats da API + o nível**.

---

## 2. Decisões travadas × decisões abertas

**Travadas:**
- Turno **SIMULTÂNEO**, como a série. Dentro do turno a ordem é **priority do
  golpe → Speed → sorteio** (speed tie). ~~Alternado~~ — revertido em 2026-07-21.
- Deck = **1 Pokémon + até 6 cartas** desse Pokémon (a carta é uma *skill*).
- **Stats 100% da API.** Some o nível 50 fixo e todo stat montado à mão.
- **Nível incremental**: entra na coleção no nv.5, sobe com XP de batalha, e o
  papel dele é **liberar skills** + escalar stats (§6). **Não** multiplica o
  poder da skill — isso era invenção nossa e saiu.
- **Espelhar a PokéAPI no nosso banco** (tabelas `Pokemon`/`Move`) com **rotina de
  refresh** — revertendo de propósito a decisão atual de "nunca espelhar" (§7).

**Também travadas (respondidas):**
- **F1 — 1×1 puro**, com o schema já pronto pra time (troca vira uma fase depois).
- **F2 — o MVP (Fase A) já entra com energia + reação.** Não é o loop mínimo: é o
  jogo tático completo desde a primeira versão jogável (decisão do dono).
- **F3 — reset total liberado.** A base de dev pode ser recriada à vontade; não há
  dado válido a preservar (nem em prod). Sem migração de compatibilidade.

**Ainda aberta:**
- **F4 — curva de XP.** Hoje: `medium-fast` (total pro nível n = n³) e ganho pela
  fórmula da série. Afinamos jogando. A curva REAL por espécie
  (`growth_rate` em `/pokemon-species`) é o próximo passo de fidelidade, e vem de
  graça se/quando buscarmos species pra evolução.

---

## 3. O modelo de turno SIMULTÂNEO (fiel à série)

Os dois jogadores escolhem a carta do **mesmo round**, sem ver a do outro. Quando
as duas estão na mesa, o turno resolve inteiro. Não existe "de quem é a vez".

**Por que reverter o alternado:** no alternado, quem jogava em segundo escolhia
**depois de ver** a jogada do adversário — a informação era assimétrica por
construção, e o Speed tinha virado "quem começa a rodada". No simultâneo a aposta
é simétrica e o Speed volta ao papel dele: **bater antes de tomar**.

### 3.1 Ordem dentro do turno (`domain/turnOrder.ts`)
1. **Priority do golpe** (quick-attack sai na frente de tudo) — dado real da API.
2. **Speed efetivo** (que deriva do nível).
3. Empate total: **sorteio**, como o "speed tie" do jogo.

Consequência de jogo: **quem é nocauteado antes de agir perde o turno**. É isso
que dá peso a montar em cima de Speed ou de priority.

### 3.2 Economia de energia (a tensão de "gastar ou guardar")  *(fatia A2)*
Cada rodada você **ganha energia**; cartas **custam** energia. Dilema: descarrego
agora ou seguro? Encaixa no simultâneo sem mudar a orquestração — é custo na
validação da carta + um campo no snapshot.

### 3.3 Janela de reação *(reavaliar)*
O desenho original de "reação" (ver a carta do oponente e responder antes de
resolver) **pressupunha turno alternado** — no simultâneo ninguém vê a jogada do
outro antes de resolver, que é justamente o ponto. Se quisermos algo reativo,
tem que ser outra mecânica (ex.: carta defensiva escolhida às cegas, resolvida na
ordem). **Não implementar como estava escrito.**

### 3.4 Como o motor ficou
- `Battle` tem `round` e `turnStartedAt`. **Não tem** `activeUserId`.
- Cada jogador tem no máximo uma `BattleAction` por round
  (`@@unique[battleId, round, userId]`) — e ela é **segredo** até resolver.
- `resolveRound()` (`domain/duelEngine.ts`) casa as DUAS jogadas e aplica na
  ordem do §3.1. `resolveIfDue()` (command) só dispara quando **as duas cartas
  estão na mesa** ou o timeout venceu (quem faltou hesita).
- A trava otimista continua igual, guardando por `(round, status)`.

---

## 4. As 4 melhorias de regra, encaixadas no modelo novo

1. **Abandono por desconexão (Presence).** ⏳ Ainda o `missedTurns`. Regra
   pretendida: a **Presence** mostra que você saiu e **não voltou em X s → o
   oponente vence**. O timeout segue como *backstop* no `pg_cron`.
   No simultâneo o contador ficou **simétrico** (os dois estão sempre em turno),
   o que já matou a regra torta que o alternado precisava pro oponente.
2. **Timer real na tela.** ⏳ `turnStartedAt` + duração viram um **countdown
   sincronizado**. Continua valendo (e no simultâneo vale pros dois ao mesmo
   tempo, que é mais simples).
3. **Feedback ao vivo.** ✅ **feito**: "oponente pronto / escolhendo" chega por
   Broadcast (`battle_action_submitted`), **sem revelar a carta** — o DTO manda
   `submittedUserIds`, nunca o `cardSlot`.
4. **Anti-enrolação direta.** ✅ turno que estoura resolve mesmo assim; quem não
   escolheu **hesita** e leva falta.

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

model PokemonMove {             // learnset (n:n) — COM o "como aprende"
  pokemonId      String
  moveId         String
  levelLearnedAt Int    @default(0)           // 0 se não é level-up
  learnMethod    String @default("level-up")  // level-up | machine | egg | tutor
  versionGroup   String @default("")          // jogo de referência da espécie
  pokemon   Pokemon @relation(fields: [pokemonId], references: [id], onDelete: Cascade)
  move      Move    @relation(fields: [moveId], references: [id], onDelete: Cascade)
  @@id([pokemonId, moveId])
  @@index([pokemonId, learnMethod, levelLearnedAt])
}
```

**Coleção + nível (substitui `UserCard`):**
```prisma
model UserPokemon {
  id         String @id @default(cuid())
  userId     String
  pokemonId  String            // espécie
  level      Int    @default(5)     // STARTING_LEVEL
  xp         Int    @default(125)   // XP TOTAL acumulado; level == levelFromXp(xp)
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

**Batalha:** `Battle` tem `round` (e **não** `activeUserId` — o simultâneo não tem
"vez"); `BattleAction` é a carta de UM jogador no round, uma por jogador; o
snapshot `BattlePokemon` carrega **stats derivados de base+nível**, o **loadout**,
o `userPokemonId` (caminho de volta pra creditar XP) e campos que entram por fase
(`energy`, `cooldown`, `statusEffects`). O princípio de **snapshot congelado no
início da partida** (§CLAUDE.md) **se mantém** — nível/API mudando no meio não
afeta partida em andamento.

---

## 6. Stats 100% da API + nível incremental

Remover: o nível 50 fixo e qualquer stat montado à mão. Derivar de **base stats da
API** com fórmula da série principal (simplificada, sem IV/EV no começo):

```
HP     = floor(2 * baseHP  * nível / 100) + nível + 10
Demais = floor(2 * base    * nível / 100) + 5
```

O nível influencia o jogo por **três** caminhos, todos fiéis à série:

1. **Escala os stats** (fórmula acima) — o dano da skill sobe porque o
   atk/spa do atacante subiu.
2. **Entra direto na fórmula de dano** (`domain/damage.ts`).
3. **LIBERA SKILLS** — é o mais importante, e o que faltava. Ver §7.

> ❌ **`skillPowerMult` foi REMOVIDO.** Existia um multiplicador nosso
> (`1 + (nível-1)*k`) pra fazer a skill escalar *além* do stat. Nunca foi ligado
> em produção e **não é como o jogo funciona** — no Pokémon o nível não deixa
> thunderbolt "mais forte" por si; ele sobe seu stat e destrava golpes novos.
> Não reintroduzir.

**XP/progressão (implementado):** o pokémon entra na coleção em `STARTING_LEVEL`
(5) e ganha XP ao fim de cada partida:

```
xp ganho = floor(baseExperience_do_derrotado * nível_do_derrotado / 7)   (gen 5+)
curva    = medium-fast → XP total pra estar no nível n = n³
```

`UserPokemon.xp` é o **total acumulado**, e `level` é função dele
(`levelFromXp`) — não existe par inválido pra reparar depois.
**Desvio consciente:** o perdedor leva `LOSER_XP_SHARE` (25%) do que levaria.
Na série quem é nocauteado não ganha nada; aqui isso prenderia quem perde num
loop sem nunca destravar carta nova.

---

## 7. Espelhar a PokéAPI + learnset por nível + refresh

O projeto espelha `Pokemon`/`Move`/`PokemonMove` porque precisamos
**consultar/filtrar por atributo** (montar deck, listar learnset, ordenar por
stat) — coisa que o key-value cru de `PokeApiCache` não faz.

- **Seed inicial:** `npm run seed` popula a partir da API (Gen 1 por padrão, pra
  não puxar 1025 de uma vez).
- **Rotina de refresh:** `POST /api/cron/refresh-pokedex` (Bearer `CRON_SECRET`)
  re-sincroniza o lote mais antigo. `pg_cron` roda 1×/dia.
- `pokemonApiId`/`moveApiId` são a chave: identificam, deduplicam e guiam o refetch.

### 7.1 O learnset é o dado que faltava (a PokéAPI já modela isso)

O espelho guardava só o par `(pokemon, move)` — resultado: **todo pokémon nascia
sabendo o learnset inteiro**, e o nível não significava nada além de stat.

A API entrega, por move, um `version_group_details[]` com **nível de
aprendizado**, **método** (`level-up` / `machine` / `egg` / `tutor`) e **jogo**.
Agora gravamos isso (`domain/learnset.ts` decide, `syncPokedex` grava):

- **Um version group por espécie**, o mais recente em que ela aprende algo por
  level-up (`VERSION_GROUP_PREFERENCE`). Misturar jogos daria "Pikachu que
  aprende tudo de todas as gerações" — o oposto de fiel. Exigir level-up evita
  cair num jogo em que a espécie só aparece com TMs (pokémon sem nada a destravar).
- **Só `level-up` vira carta**, e só com `levelLearnedAt <= nível`. TM/ovo/tutor
  ficam gravados (fidelidade do espelho) mas fora do jogo: no jogo real elas não
  pedem nível, então liberá-las apagaria a progressão que o nível acabou de ganhar.
- A trava é do **servidor** (`addToDeck`), não da UI: o `POST /api/deck` é
  público. O modal mostra as travadas com o nível exigido — ver o que vem é
  metade da progressão.

**Consequência que muda o começo do jogo:** um pokémon novo tem ~3-4 cartas, não
6. `CARDS_PER_SLOT` virou **teto**, não obrigação.

---

## 8. Infra de transporte, tempo e segurança (Realtime + cron)

Duas peças, papéis diferentes — **não confundir** (foi o erro clássico da discussão):

- **`pg_cron` = o relógio / worker.** Faz o tempo passar **sem cliente** (resolve o
  turno vencido de uma partida zumbi). É a única peça que o Realtime **não**
  substitui. Roda no Supabase (o "worker que não existe na Vercel Hobby").
- **Realtime = o push.** Avisa que o turno virou, pra tirar o cliente do polling. É
  **transporte, não computação** — não executa `resolveTurn`.

### 8.1 Realtime — as decisões (não eram óbvias, valem ouro)

- **Realtime é SINAL, não DADO.** São **dois** triggers de **Broadcast from
  Database**, os dois com payload mínimo, e o cliente refaz o
  `GET /api/battle/[id]` que **já passa pelo DTO** (o hook nem lê o payload):
  - `battle_updated` — UPDATE no `Battle`: o turno resolveu.
  - `battle_action_submitted` — INSERT em `BattleAction`: o oponente trancou a
    carta. **Só existe por causa do simultâneo**: escolher a carta não mexe no
    `Battle`, então sem ele o "oponente pronto" esperaria o próximo poll (20s
    com o canal de pé). Payload leva `userId`/`round`, **nunca o `cardSlot`** —
    seria o vazamento da regra 3 pelo WebSocket.

  **NÃO** usar **Postgres Changes** (assinar a tabela): streama a linha crua e
  reabre exatamente esse vazamento.
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
- **O que justifica o Realtime hoje** (revisado em 2026-07-21, com o simultâneo):
  a **assimetria de espera**. Quem submete a 2ª carta resolve o turno no próprio
  POST e vê o resultado na resposta; quem submeteu **primeiro** não tem request
  nenhum a caminho — sem push, ele descobre no próximo tick. O push zera essa
  espera pros dois. E não dá pra resolver isso na Vercel Hobby com SSE/WebSocket
  (função efêmera, teto de duração): o socket **tem** que vir de fora, e o
  Supabase já está no stack. Ver a análise completa no fim de §8.2.

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

✅ **Pré-requisitos do Realtime destravados (2026-07-16):** MCP do Supabase
funcionando (só `list_branches` erra — branching é feature paga, ignorar);
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **já no
`.env`** (públicas); `SUPABASE_JWT_SECRET` já estava. Advisor de segurança limpo
(zero `rls_disabled_in_public`; os `rls_enabled_no_policy` INFO são o estado
desejado).

✅ **Jobs agendados e envs de prod setadas (2026-07-16):** `resolve-battle-turns`
(30s) e `refresh-pokedex` (03:15 UTC diário) ativos no `pg_cron`, apontando pra
URL de prod `https://poke-dex-rgt.vercel.app`; as 4 envs (`CRON_SECRET`,
`SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) setadas na Vercel pelo dono.

✅ **Fatia A3 — Realtime CODADA e verificada no stack local (2026-07-17):**
decisão de abertura resolvida como **Supabase CLI local** (Docker; `npx supabase
start`, banco em :54322, API em :54321). Entregue (projeto verde: tsc · vitest
141 · eslint · next build):
- `supabase/migrations/20260717055314_realtime_battle_broadcast.sql` (+ a irmã
  `…055605_realtime_harden_functions_private_schema.sql`) — policy em
  `realtime.messages` (participante ↔ topic `battle:<id>`, `sub` lido como
  TEXTO) + trigger `battle_broadcast_update` no `Battle` via `realtime.send`
  (payload mínimo `{battleId, round, status}`). **Fora das migrations Prisma de
  propósito** (schema `realtime` só existe na plataforma). Descoberta que não
  estava no plano: a checagem de participação precisa de função **`SECURITY
  DEFINER`** — a policy roda como `authenticated`, deny-all nas tabelas do app;
  sem ela, nega tudo em silêncio.
- `GET /api/realtime/token` — better-auth → JWT HS256 (`modules/realtime`:
  `createRealtimeToken` no index chama `domain/signRealtimeToken`, testado;
  claims `sub` + `role: authenticated`, TTL 1h).
- `useBattleRoom` — push → refetch do DTO; canal assinado relaxa o polling de
  2s pra **20s** (fallback); erro/queda no canal devolve os 2s. A assinatura do
  canal mora em `modules/realtime/ui/useRealtimeChannel` e
  `modules/realtime/ui/supabaseBrowser` é o singleton do socket
  (`@supabase/supabase-js` entrou SÓ pra isso).
- **e2e no stack local passou:** participante assina (SUBSCRIBED), UPDATE no
  `Battle` entrega o broadcast mínimo, **não-participante é negado**
  (`Unauthorized ... Channel topic`). Rota do token dirigida de verdade
  (401 sem sessão; JWT correto com sessão).
- CLAUDE.md (consequências #1 e #5) e AGENTS.md atualizados: a fronteira do
  Realtime saiu de "quando entrar" pra implementada.

✅ **Revisão do Realtime + 2º trigger (2026-07-21):** o uso foi auditado com o
turno simultâneo no lugar. Conclusão: **continua valendo, e agora com um motivo
mais forte que antes** — é o único jeito de tirar o jogador que submeteu PRIMEIRO
da espera cega (ele não tem request a caminho). Alternativas descartadas: SSE e
WebSocket na Vercel Hobby (função efêmera com teto de duração — o socket tem que
vir de fora), long-polling (segura invocação e queima cota), e baixar o intervalo
de poll (2s × 2 jogadores já é ~1 invocação/s por partida).
Adicionado `supabase/migrations/20260721121000_realtime_action_submitted.sql`:
trigger de INSERT em `BattleAction` → evento `battle_action_submitted`, payload
`{battleId, userId, round}` (**sem `cardSlot`**). Função em `private` (não
exposta como RPC) e coberta pela policy que já existe — ela autoriza por TOPIC,
não por evento. `useRealtimeChannel` passou a aceitar **vários eventos numa
assinatura só** (dois canais pro mesmo topic pagariam dois handshakes).

⏳ **Pendente:**
1. **Merge `refactor-resolve-turn` → `main` (dono).** A Vercel deploya a `main`,
   que ainda tem o jogo VELHO — quebrado contra o banco já migrado; o cron toma
   404 até esse deploy subir. Depois do merge: conferir
   `select status_code from net._http_response order by id desc limit 5;`
   (deve virar 200) e jogar um duelo em prod.
2. ✅ **SQL do Realtime aplicado no PROD (2026-07-17)** via MCP `apply_migration`
   (policy + trigger + funções). **Endurecido:** as funções foram movidas de
   `public` pra um schema **`private`** — no `public` elas ficavam expostas como
   RPC do PostgREST (`/rest/v1/rpc/...`, advisor acusou 3 WARN
   `*_security_definer_function_executable`); `private` não é exposto. Advisor
   de segurança **LIMPO** depois (só os `rls_enabled_no_policy` INFO desejados).
   Verificado com `set role authenticated`: participante real → true, forasteiro
   → false. O arquivo `supabase/migrations/...` foi atualizado pra refletir a
   versão `private` (era a fonte da verdade do local também).
3. **Jogar um duelo com 2 browsers no dev local** pra ver o push na tela (o
   e2e provou o transporte; falta o olho no jogo). ⚠️ Dev server que já estava
   de pé precisa **restart** ao trocar o `.env` — o singleton do Prisma segura
   a URL antiga mesmo com o "Reload env" do Next.
4. **Confirmar as 4 envs do Realtime na Vercel** (o dono disse que setou):
   `NEXT_PUBLIC_SUPABASE_URL` (prod), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_JWT_SECRET` (o legacy secret do PROD — tem que casar com o que o
   Realtime valida), `CRON_SECRET`. Sem elas o prod cai no polling (funciona,
   só sem push).

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
| **A — Duelo tático completo (MVP)** | Deck 1 loadout (cartas **liberadas por nível**); **turno simultâneo** com ordem por priority/Speed; XP e nível subindo por batalha; HP→0 acaba. Falta: **energia** por rodada + custo de carta, timer real sincronizado, Presence/abandono. | É o jogo tático inteiro já jogável. Maior e mais arriscado que um MVP mínimo — por isso a Fase 0 tem que estar sólida antes. |
| **D — Profundidade** | Efeitos ricos da API (status, mudança de stat, prioridade), cooldowns, evolução por nível, e **opcional** time de até 3 (troca). | Complexidade que empilha por cima do núcleo estável. |

### Estado da Fase 0 (implementada — dev local)

✅ **Feito e verificado** (`tsc`·`vitest` 159·`eslint`·`next build` verdes):
- **Schema + migration `20260716005502_phase0_pokedex_mirror`**: `Pokemon`,
  `Move`, `PokemonMove` (learnset n:n), `UserPokemon` (nível/XP, `@@unique
  [userId,pokemonId]`). RLS ligada nas 4 tabelas na mesma migration (AGENTS.md).
  **Aditiva** — `UserCard`/`DeckCard`/battle seguem intactos até a Fase A migrar.
- **`pokedex/domain/leveling.ts`**: `deriveStats` (fórmula §6, sem nível 50
  fixo) + curva de XP. *(Reescrito em 2026-07-21: a curva virou a da série e o
  `skillPowerMult` foi removido — ver §6.)*
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

✅ **A1-wiring FEITO** (backend, verificado sem Realtime — `tsc` backend + `vitest`
134 + `eslint` verdes): migration destrutiva `20260716140000_phaseA1_duel_wiring`
(reset liberado, F3) — `Battle` ganha `round`/`activeUserId`; `BattleAction` no
lugar de `BattlePendingMove`; `DeckSlot`/`DeckSlotCard`; `UserCard`/`DeckCard`
CORTADOS (coleção = `UserPokemon`, deck = loadouts). `buildDuelSnapshot` lê o
espelho local (não a PokéAPI ao vivo) e deriva stats por nível (`deriveStats`);
`resolveTurn` usa `applyDuelAction` com trava otimista por `(activeUserId, round,
status)` + transação; `submitMove`→`submitAction` ("é a sua vez" + carta);
`enqueueBattle` seta iniciativa. `packs`→`UserPokemon` (pool do espelho);
`pokedex/getCollection`/`removeCard` e o módulo `deck` migrados. queries+DTO novos
(sem vazar a `BattleAction` pendente). **UI quebrada de propósito** (coleção, deck,
battle-room) — é o follow-up abaixo.

✅ **UI do modelo novo FEITA** (projeto inteiro verde: `tsc` · `vitest` 139 ·
`eslint` · `next build`):
- **Coleção** recolada no `CollectionDTO` novo (`userPokemonId`/`level`): card
  mostra o nível; `CollectionCardActions` abre o **`LoadoutBuilder`** (modal) que
  busca o learnset (`GET /api/deck/learnset/[userPokemonId]`) e escolhe até 6
  cartas → `POST /api/deck {userPokemonId, moveIds}`. "No deck ✓" remove o slot.
- **Battle-room** reescrito pro duelo alternado em **HTML** (`DuelTable` +
  `battleView.ts` puro/testado + `useBattleRoom` pollando `round`+`activeUserId`):
  mostra de quem é a vez, barra de 6 cartas (PP/tipo/power), HP, log. O canvas
  **Konva foi aposentado** (`BattleTable`/`useHtmlImage` deletados) — repor é polish.

✅ **Transporte Realtime FEITO (2026-07-17, ver §8.2):** push → refetch no
`useBattleRoom`, polling relaxa pra 20s com canal de pé. Verificado e2e no
Supabase CLI local.

✅ **VOLTA AO SIMULTÂNEO + learnset por nível + XP (2026-07-21)** — `tsc` ·
`vitest` 164 · `eslint` · `next build` verdes. Migration
`20260721120000_simultaneous_turns_and_level_learnset`:
- **Turno simultâneo**: `duelTypes`/`duelEngine` (`resolveRound` casa as duas
  jogadas) + `turnOrder.ts` (priority → Speed → sorteio). `duelInitiative.ts`
  **deletado**; `Battle.activeUserId` **dropado**. `resolveIfDue` só resolve com
  as duas cartas na mesa (ou timeout), claim por `(round, status)`, faltas
  simétricas, **um log por rodada**. `submitAction` não tem mais "é a sua vez".
- **Learnset por nível** (§7.1): `version_group_details` normalizado em
  `lib/pokeapi`, decidido em `pokedex/domain/learnset.ts`, gravado em
  `PokemonMove` (nível/método/jogo). `readLearnset` devolve travadas com o nível
  exigido; **`addToDeck` recusa carta não destravada** (o POST é público).
- **XP** (§6): `awardBattleXp` credita dentro da transação do claim (o claim é o
  que garante pagamento único). `BattlePokemon.userPokemonId` é o caminho de
  volta. `openPack` cria em `STARTING_LEVEL`.
- **DTO/UI**: `submittedUserIds` (quem, nunca o quê) → `canPlay` /
  `waitingOpponent` / `opponentReady`; a mesa mostra "Escolha sua carta" /
  "Aguardando oponente" + selo de oponente pronto.
- **Realtime**: 2º trigger `battle_action_submitted` (ver §8.2).

⚠️ **A migration NÃO foi aplicada** — o `.env` aponta pro Supabase de PROD. O
dono roda `npx prisma migrate deploy` (ou `dev`) e **`npm run seed`** (o
learnset antigo é apagado pela migration: não havia como converter sem o dado da
API — ver o cabeçalho da migration). O SQL do Realtime novo entra pelo
`supabase db push` / MCP, como os irmãos.

⏳ **Próxima fatia:** timer sincronizado na tela, energia (A2), **evolução por
nível** (ver abaixo), Fase D, e (opcional) repor o canvas Konva. A "janela de
reação" precisa ser **redesenhada** — o desenho antigo pressupunha turno
alternado (§3.3).

⏳ **Evolução por nível — fatia própria, ainda NÃO feita.** Ficou de fora desta
leva de propósito (decisão do dono, 2026-07-21). O que ela precisa, pra quem
pegar:
1. **Dado**: `/pokemon-species/{id}` → `evolution_chain`, e `/evolution-chain/{id}`
   → gatilho (`trigger: level-up`, `min_level`). Hoje o espelho **não** guarda
   nada disso; entra como coluna/tabela nova (e a mesma chamada traz o
   `growth_rate`, que fecha o F4 da curva de XP).
2. **Regra**: ao subir de nível em `awardBattleXp`, se bateu o `min_level` da
   cadeia, o `UserPokemon` **troca de espécie** (`pokemonId`). Stats vêm de
   graça (derivam da espécie nova).
3. **O buraco que precisa de decisão**: o loadout aponta pra `Move` da espécie
   ANTIGA. Evoluções costumam manter quase todo o learnset, mas não é garantido
   — é preciso decidir entre podar as cartas órfãs, manter (grandfather) ou
   forçar remontagem. **Não dá pra implementar sem essa escolha.**
4. E o snapshot de partida em andamento **não** pode mudar (é congelado) — a
   evolução só vale da próxima partida em diante.

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
- **Reescrita da orquestração do turno**: feita duas vezes (simultâneo→alternado
  →simultâneo). O engine de *dano* sobreviveu inteiro nas duas; o *fluxo* é que
  muda. Lição: **decidir o modelo de turno olhando pro jogo real primeiro** — o
  alternado custou uma fatia inteira pra descobrir que a informação assimétrica
  quebrava o duelo.
- **Custo de dados da API**: o seed puxa muita coisa; respeitar a fair-use (cache
  local, que agora é tabela de verdade) e semear por geração.
- **Learnset por nível muda a cara do começo**: pokémon novo tem ~3-4 cartas, não
  6. Se ficar seco demais, as alavancas são `STARTING_LEVEL` e o XP por batalha —
  não voltar a liberar o learnset inteiro.
- **Balanceamento**: só se acerta jogando — daí as fases serem jogáveis cedo.

---

## 11. Decisões

- **F1** ✅ 1×1 puro, schema pronto pra time.
- **F2** ✅ MVP completo na Fase A. *(A "reação" precisa ser redesenhada — §3.3.)*
- **F3** ✅ reset total da base liberado.
- **F4** ⏳ curva de XP — hoje medium-fast (n³) e ganho pela fórmula da série;
  afinamos jogando (§6). O ~~multiplicador de skill por nível~~ saiu da questão:
  não existe no jogo real (§6).

**Decidido em 2026-07-21 (esta leva):**
- **Turno SIMULTÂNEO**, revertendo o alternado (§3).
- **Learnset travado por nível**, só `level-up`, version group mais recente por
  espécie (§7.1).
- **XP pela fórmula da série**, perdedor leva 25%.
- **Evolução por nível fica pra fatia própria** — o que ela exige está listado no
  fim de "Estado da Fase A".
