# JOGO — o que falta

> Herdado do `PLANO_JOGO.md`, apagado em 2026-08-07. As regras de jogo que
> continuam valendo foram pro `README.md` (e o que o código tem que respeitar por
> causa delas, pro `CLAUDE.md` § "O jogo: as regras moram no README"); o histórico
> de execução está no git. Aqui ficou só o que NÃO foi feito.

- [x] **Energia por rodada + custo de carta** — **FEITO (2026-08-14)**. A tensão
  de "descarrego agora ou guardo?": entra com 3, cada carta custa 1–3 por faixa
  de poder, a rodada devolve 1 (teto 6).
  - **A alavanca de balanceamento é `battle/domain/energy.ts`, e só ela.** Nada
    vai pro banco: ninguém filtra nem ordena por custo (regra 3.1), e guardar em
    coluna obrigaria a re-sincronizar o espelho a cada ajuste. O `energyCost` é
    calculado no SERVIDOR e vai pronto no DTO — a tabela de faixas não vai pro
    browser.
  - **Fica em `BattleParticipant.energy`, não no `BattlePokemon`**: o recurso é do
    JOGADOR. No pokémon, o `clearVolatiles` da troca limparia junto e **trocar
    viraria recarga**.
  - **Custo mínimo 1 + regen 1 garantem que sempre há jogada.** E o motor tem o
    ramo de STRUGGLE quando NENHUMA carta é pagável — sem ele, ficar sem energia
    seria ficar sem ação, e ficar sem ação três vezes é derrota por abandono.
    Verificado quebrando de propósito.
  - **Gasta antes de rolar acerto** (errar cobra, igual ao PP) e o **regen só
    acontece em `resolveRound`** — nunca no `applyForcedSwitch`/`applyLeadLoadout`,
    que rodam DENTRO da mesma rodada e pagariam duas vezes.
  - **A energia é pública nos dois lados**, como HP e status: sem ver o recurso do
    oponente não dá pra ler a ameaça. O que continua segredo é o `cardSlot`.
  - **A tela distingue "sem PP" de "sem energia"** (`disabledReason`): os dois
    exigem reações opostas — um só passa trocando de pokémon, o outro passa
    sozinho no round seguinte. Botão cinza igual faria o jogador achar que travou.
- [x] **Abandono por desconexão** — **FEITO (2026-08-14)**. X = **60s** (decisão
  do dono). O `missedTurns` (3×90s) continua como backstop, e o `pg_cron` também.
  - **NÃO usa a Presence do Supabase, e isso é decisão, não atalho.** Três
    razões independentes: (1) o evento `leave` chega ao BROWSER do oponente, e
    declarar vitória é ESCRITA — aceitar o cliente como fonte da verdade é
    aceitar vitória forjada; (2) quem fecha a aba não envia nada, e se os DOIS
    saem não há quem observe; (3) o backstop de verdade roda no `pg_cron`, DENTRO
    do banco, sem WebSocket nenhum — ele só sabe ler coluna. Logo: heartbeat HTTP
    → `BattleParticipant.lastSeenAt`. Bônus: a policy de `realtime.messages`
    (que filtra `extension = 'broadcast'`) **não precisou mudar** — Presence usa
    `'presence'` e seria bloqueada em silêncio.
  - **O heartbeat pega carona no `GET /status`** que o polling já faz, e vem
    DEPOIS do `isParticipant` (a lição do achado de auditoria: nunca escrever
    antes de autorizar) e ANTES do `resolveIfDue` (senão o jogador seria dado
    como ausente no mesmo request em que provou estar presente). O próprio
    `where` é o throttle.
  - ⚠️ **O tick do polling parou de pular quando `document.hidden`** — era isso
    que faria "troquei de aba por 1 minuto" virar "abandonou". A economia de
    invocação desceu pro `loadFullState` (o request pesado), que é onde ela
    realmente valia.
  - **O piso é `battle.createdAt`, não `turnStartedAt`** (que reseta a cada round
    e daria 60s novos de graça por turno). E sem piso, `lastSeenAt` null viraria
    "ausente desde 1970" e **toda partida nasceria abandonada** — tem teste.
  - **Dois limiares de propósito:** 60s encerra (regra do jogo, não pode ser
    sensível a engasgo de rede) e 40s avisa na tela. Se a tela só dissesse
    "desconectado" no instante em que a partida acaba, o aviso não avisaria nada.
  - Os dois ausentes → `ABANDONED` sem vencedor, coerente com o abandono mútuo.
- [x] **Mecânica reativa** — **FEITA (2026-08-14) como PROTECT.** O desenho
  antigo (janela de reação) continua enterrado: ele pressupunha turno ALTERNADO.
  O que entrou é uma **carta defensiva escolhida às cegas**, no mesmo round que
  todas as outras — não há reação a nada, há uma APOSTA de que o oponente vai
  atacar.
  - **Resolve ANTES dos ataques, fora da ordem do turno.** Se resolvesse na
    ordem, um protect "lento" seria inútil contra golpe de priority alta, e a
    proteção deixaria de ser aposta pra virar função da Speed.
  - **O atacante bloqueado perde o turno E paga PP e energia.** É isso que dá
    sentido à aposta: proteger só vale porque o outro perde o turno junto.
  - **A chance cai pela metade a cada uso consecutivo** (100→50→25) e zera ao
    fazer outra coisa ou ao trocar. Sem isso, quem tivesse energia sobrando
    protegeria todo turno e o duelo empataria por esgotamento de PP.
  - **A 1ª proteção não toca o rng** — a suíte inteira do motor depende de quem
    não tem motivo não sortear nada.
  - ⚠️ **A lista de golpes que protegem é por NOME** (`PROTECT_MOVES`), não pelo
    `meta` da API: `protect` vem com `category = "unique"`, a mesma de
    `substitute` e outra dúzia de coisas sem relação. Ler "unique" como proteção
    transformaria vários golpes em escudo por engano.
- [x] **Troca de Pokémon entre jogadores** (módulo `trade`) — **FEITO
  (2026-08-14)**. Oferta/aceite transferindo a instância de `UserPokemon`.
  - **Descoberta por CÓDIGO** (decisão do dono): quem oferece gera um código de 8
    símbolos e passa por fora do jogo; quem tem o código aceita. **Não há busca
    de jogador, perfil nem lista de amigos** — o jogo nunca mostrou o nome de
    outro jogador (nem na batalha, onde o oponente é anônimo), e a troca não é o
    lugar de estrear isso. Busca por email exporia "esse email joga aqui".
  - **A transferência é `update` do `userId`, não delete+create.** O `id` da
    carta sobrevive (o `TradeLog` aponta pra ela) e os `UserPokemonMove` vão
    junto — o TM que o dono antigo ensinou continua na carta.
  - **Dois claims no aceite:** apagar a oferta (quem apaga ganhou) e o `userId`
    do doador no PRÓPRIO where do update. Perder o segundo derruba a transação,
    e o rollback devolve a oferta — mesma manobra do token no `applyTM`.
  - **Todo erro de código responde `invalid_code`** — inexistente, vencido e já
    aceito são indistinguíveis de propósito, pra a rota não virar oráculo. O
    freio (`tradeAccept`: 10/10min) é o único do jogo que existe por SEGURANÇA:
    é a única rota onde acertar um valor que você não tem dá prêmio.
  - **Carta em deck ou em partida IN_PROGRESS não pode ser oferecida**, e a
    partida é re-checada DENTRO da transação: senão o XP do fim cairia no novo
    dono, que não jogou (o `BattlePokemon.userPokemonId` é gravado por valor).
  - **Resíduo aceito:** se o doador entrar em matchmaking na janela entre o
    accept e o commit, aquela partida ainda credita XP ao novo dono. Fechar
    exigiria travar a carta no matchmaking — não paga.
  - **O alfabeto do código não tem `I`/`L`/`O`/`U`/`0`/`1`**, e a normalização
    NÃO adivinha caractere parecido: como os dois lados de cada par ambíguo
    saíram do alfabeto, mapear chutaria — e chutar transformaria um erro de
    digitação em OUTRO código válido, que pode ser a oferta de um terceiro.
- [x] **Cruzamento (ovo)** — **FEITO (2026-08-14)**. Cruzar dois `UserPokemon` do
  jogador: se um conhece um golpe que a espécie do outro aprende por `egg`, nasce
  uma instância nova (nível 1) com esse egg-move concedido
  (`UserPokemonMove source:"egg"`). **Sem choco** — não há worker pra temporizar.
  - **Ramo A**: a cobertura medida dispensou mexer no espelho (ver abaixo).
  - **Os dois sentidos são tentados** (`resolveBreedingEitherWay`): o jogador
    escolhe dois cards, não "quem é o pai", e não tem como saber qual espécie
    aprende o golpe por ovo. Exigir a ordem faria metade das tentativas válidas
    parecerem incompatíveis.
  - **A escolha do golpe é determinística** (menor `moveId` da interseção), não
    sorteada: o preview e o cruzamento rodam em requests diferentes e têm que
    chegar no mesmo resultado, senão a tela promete um golpe e o banco grava
    outro. Sortear também tocaria o rng, que o jogo mantém intocado por quem não
    tem motivo.
  - **Um por dia UTC**, em `PackState.lastBreedAt` (coluna, não tabela nova — é
    saldo por jogador, que é o que aquela tabela já é). O claim é a 1ª operação
    da transação, molde do `checkInLogin`; quem perde não cria nada.
  - **O claim roda DEPOIS de saber que há cruzamento**: tentativa incompatível
    não queima o dia. E existe `GET /api/breeding` (preview, só lê) pra testar
    combinações sem gastar — descobrir a incompatibilidade queimando a tentativa
    seria punir o jogador por não conhecer uma tabela que o jogo não mostra.
  - ⚠️ **A mudança sem a qual nada disso aparecia:** `readLearnset` filtrava
    `learnMethod IN (level-up, machine)`, então o egg move concedido ficava
    INVISÍVEL na ficha e no seletor de loadout — o jogador ganhava a carta e não
    conseguia jogá-la, mesmo com o `getUnlockedMoveIds` já a aceitando. Agora o
    filtro tem um `OR` pelas concedidas, e o `LearnsetMoveDTO` ganhou `source`.
  - `startOfUtcDay`/`utcDayIndex` saíram de `packs/domain/streak.ts` pra
    **`src/lib/utcDay.ts`**: três módulos precisam da MESMA fronteira do dia e
    `domain/` só importa a si mesmo. Duplicar a conta é o erro caro — bastaria
    uma cópia divergir pra o jogador ganhar duas recompensas na virada.
  - **A cobertura do espelho foi MEDIDA no prod (2026-08-14) e dá jogo:** 2.576
    linhas `learnMethod='egg'` em **548 das 1025 espécies** (~4,7 egg moves por
    espécie que tem algum); `tutor` tem 779 em 247. Ou seja: **não precisa mexer
    na PK de `PokemonMove`** nem re-seedar. Vale saber POR QUE o número é esse:
    a PK é `[pokemonId, moveId]` (uma linha por golpe) e o `METHOD_RANK` do
    `pickLearnEntry` prefere o menor rank, então **só sobrevive como `egg` o
    golpe que é exclusivamente egg naquele version group**. O pool é menor que o
    da série de propósito, e isso é o jogo.
- [x] **Tutor por quests diárias** (módulo `quests`) — **FEITO (2026-08-14)**.
  Completar quest dá 1 `tutorTokens`; o token ensina um golpe `tutor`
  (`pokemon/commands/applyTutor`, cópia do `applyTM` com moeda e método
  trocados). Fecha a 3ª e última forma de ganhar carta por fora do nível.
  - **As quests do dia são DERIVADAS do `dayIndex` por função pura**
    (`questsForDay`), e o banco guarda só o PROGRESSO. Isso resolve o problema
    que não tem solução aqui: **não há worker pra virar as quests à meia-noite**.
    Se fossem sorteadas e guardadas no 1º acesso, duas abas abertas juntas
    poderiam receber listas diferentes e a corrida decidiria qual vale.
  - **O incremento mora DENTRO do claim do `commit()`** do `resolveTurn`, ao lado
    do `grantXp` e pelo mesmo motivo — e `trackBattleFinished` **recebe o `tx`**
    em vez de abrir transação própria. Fora dali, os dois pollings de 2s pagariam
    progresso a cada leitura: "vença 3 batalhas" completaria com a aba aberta.
    O `openPack` incrementa `pack_opened` dentro do claim dele, pela mesma razão.
  - **A moeda é separada da do TM**: as torneiras têm ritmos diferentes (login
    diário × completar objetivo), e um token só faria a fácil pagar a difícil.
  - `QuestProgress` tem `dayIndex` na PK — linha nova por dia, sem nada pra
    zerar. Json no `PackState` não serviria: precisa de `increment` atômico e de
    `WHERE` por dia, e Json não entra em nenhum dos dois.
  - **Não implementado de propósito:** o `dayIndex` NÃO sai no DTO. A UI que o
    recebesse ficaria tentada a calcular o dia no cliente, onde o fuso do browser
    dá outra resposta que a do servidor.
- [x] **Curva de XP real por espécie** — **FEITO (2026-08-14)**.
  - **"Curva" = quanto XP cada nível custa** (`growth_rate` na PokéAPI). São seis
    na série, e cada espécie tem a sua: o XP total pro nível 50 vai de 100.000
    (`fast`) a 156.250 (`slow`). Antes, o jogo usava `medium-fast` pra todo mundo.
  - As seis fórmulas em `pokemon/domain/growthRate.ts`; `Pokemon.growthRate`
    guarda a da espécie, lida do `/pokemon-species`.
  - **Correção do que este item dizia:** "sai quase de graça" valia pro DADO
    (o fetch de species já acontecia pra evolução e o resto do payload era
    jogado fora — agora `fetchSpecies` devolve as duas coisas). **Não valia pra
    matemática:** `erratic` e `fluctuating` são polinômios POR FAIXA e **não têm
    inversa analítica**. Não existe `cbrt` pra elas.
  - Por isso `levelFromXp` deixou de ser uma conta e virou **tabela
    pré-computada (6×100) + busca binária**. De quebra ficou mais rápido que a
    raiz cúbica antiga, e sumiu o ajuste manual de ponto flutuante que estava lá
    ("cbrt(125) = 4.999999").
  - **A propagação é aditiva:** a curva é um parâmetro OPCIONAL em `xpForLevel`,
    `levelFromXp`, `applyXp`, `progressionFromXp` e `progressionFromLevel`, e cai
    em `medium-fast` — a curva única de antes. Espécie ainda não re-sincronizada
    se comporta exatamente como antes, e há teste travando isso.
  - ⚠️ **`openPack` tem que informar a curva da espécie, e informa.** A forma
    evoluída nasce em nível alto (Charizard não sai nível 1), e o `xp` gravado
    tem que ser o desse nível NAQUELA curva. Com a curva errada, o par
    (xp, level) fica incoerente e a carta **perde níveis sozinha** na primeira
    batalha, quando o `level` é recalculado a partir do `xp`. No `breedPokemon` o
    default está correto, porque o XP do nível 1 é igual nas seis curvas.
  - **Backfill:** as linhas já espelhadas nascem com o default. Pra pegar a curva
    real, `npm run seed -- 1 1025`. Sem isso nada quebra — só continua
    medium-fast.
- [x] **Fase D — efeitos ricos da API** (feito em 2026-08-12): status
  (queimadura/veneno/paralisia/sono/congelamento/confusão/semente), stat stages
  (−6..+6), efeito secundário de golpe de dano, dreno/recuo, cura, recuo de
  turno (flinch) e múltiplos acertos. O dado cru vem do `meta`/`stat_changes` do
  `/move` e mora em `Move.effect`; a tradução em mecânica é
  `battle/domain/moveEffect.ts` e o estado é `battle/domain/conditions.ts`
  (persistido em `BattlePokemon.conditions`). Regras no `README.md` §"Status e
  atributos". **Cooldown de carta NÃO entrou** — o PP já é o limitador de uso, e
  um segundo relógio por carta só faria sentido junto com energia por rodada
  (o item de cima).
  - **Depende de re-sincronizar o espelho**: golpe cujo `Move.effect` ainda está
    `null` (semeado antes desta fatia) continua inerte até o `syncPokedex`
    passar por ele. O jeito é `npm run seed -- 1 1025` (a faixa TODA — o default
    do seed é só a Gen 1). Não conte com o cron diário: ele gira 20 espécies por
    passada, o que com as 1025 espelhadas dá ~51 dias pra uma volta.
- [ ] **Efeitos que ficaram de fora** — **PARCIAL (2026-08-14): a proteção
  entrou; o resto NÃO.** Continuam virando `null` no `parseMoveEffect` e
  aparecendo como "sem efeito" na barra: **clima**, **barreiras**
  (reflect/light-screen), **troca forçada** (whirlwind), **OHKO** e os **ailments
  raros** (`infatuation`, `trap`, `disable`, `nightmare`, `yawn`…).
  - Cada um é uma mecânica nova no motor, não um `if` a mais — e por isso não
    couberam nesta leva. Ordem sugerida, do mais barato ao mais caro:
    **barreiras** (contador por LADO, com duração — encaixa ao lado da energia em
    `DuelSide`) → **troca forçada** (o motor já tem `applyForcedSwitch`, é
    reusar) → **clima** (estado de CAMPO, o que mais mexe em `damage.ts`) →
    **OHKO** e os ailments raros.
  - A regra de honestidade continua valendo: efeito que o jogo não modela vira
    `null` e a carta diz "sem efeito". **Nunca finja que fez algo.**

Ordem sugerida entre os três de cima: **troca** (dá uso às duplicatas e destrava
conseguir o "pai") → **cruzamento** → **tutor** (independente das outras).

# TODO
- Api client com react query tan stack 
- [ ] **Split opcional do `pokemon/domain/leveling.ts`** em `stats.ts` (deriveStats/
  calcHp/calcStat) × `xp.ts` (curva/applyXp/xpFromDefeat) × `levels.ts` (MIN/MAX/
  STARTING + clampLevel compartilhados). São duas razões de mudar no mesmo arquivo
  (SRP). Adiado duas vezes: no refactor do módulo `progression` (2026-07-30) e no
  do módulo `pokemon` (2026-08-07) — nos dois, a decisão foi mover inteiro
  primeiro. O DIP/repositório sobre o Prisma foi avaliado no primeiro e
  **descartado** (custo/benefício). Ver
  `docs/specs/2026-08-07-pokemon-module-design.md`.


# SEGURANCA

## Auditado (ver resumo abaixo)

- [x] **BYPASS api > banco / battle > banco** — auditado. As rotas são casca fina
  (sessão -> command -> HTTP) e nenhuma regra mora nelas. Achado 1 bypass real: o
  PP não era gasto (dava pra repetir o golpe mais forte pra sempre). CORRIGIDO:
  engine gasta o PP, resolveTurn grava a coluna Json `moves` de volta, submitMove
  recusa slot zerado. Fallback de struggle quando tudo zera, senão o jogador
  ficaria sem ação e perderia por abandono.
- [x] **IDOR** — auditado, nenhum encontrado. Toda escrita escopa o dono no
  PRÓPRIO `where` (não num findUnique antes, que seria corrida):
  `removeCard` -> `deleteMany({ id, userId })`; o `deckId` que o cliente manda no
  POST /api/battle/queue passa por `readDeckRoster`, que filtra
  `where: { id: deckId, userId }`.
  - **Reauditado em 2026-08-06**, quando `addToDeck`/`removeFromDeck`/
    `reorderDeck` viraram um `saveDeck` só (`PUT /api/deck`, corpo com o time
    inteiro). O padrão não mudou: o `findMany` do time filtra `{ id: { in },
    userId }` no PRÓPRIO where e exige que a contagem BATA — uma carta de outro
    dono derruba o save inteiro com `not_found` (não vira oráculo de "esse id
    existe") e **nada é escrito**. O deck alvo continua sendo o do próprio
    usuário (`getOrCreateDeck(userId)`), então o `deleteMany` do save não alcança
    deck alheio. A forma do corpo (quantidade, posições, repetidos) é validada
    por função pura ANTES de qualquer ida ao banco (`validateDeckSlots`).
- [x] **Escrita antes da autorização** (achado NOVO, não estava nesta lista).
  `getBattleState`/`getBattleStatus` chamavam `tryResolveTurn` — que ESCREVE e
  pode bater na PokéAPI — e só DEPOIS checavam se o usuário era participante. O
  403 saía certo, mas a partida alheia já tinha sido mexida e a chamada de rede
  já tinha saído. CORRIGIDO: as duas agora fazem LÊ -> AUTORIZA -> ESCREVE. O
  `tryResolveTurn` foi partido em `loadBattleForResolve` (só lê) + `resolveIfDue`
  (escreve), então a autorização reusa a MESMA leitura que a resolução já ia
  fazer — autorizar antes de escrever custa ZERO query extra, o que importa
  porque /status é polling de 2s dos dois jogadores. Ver queries/battleAccess.ts.
- [x] **Prisma pro bundle do browser** — hoje NÃO vaza: nenhum arquivo de `ui/`
  ou `components/` importa `lib/prisma`, `lib/auth`, `commands/` ou `queries/`.
  Mas isso é só disciplina — ver "server-only" abaixo.
- [x] **refreshToken / token expires na Account** — NÃO usar, e NÃO remover. Só
  `emailAndPassword` está ligado, então `accessToken`/`refreshToken`/`idToken` e
  os `*ExpiresAt` são todos NULL; existem porque o prismaAdapter do better-auth
  espera esse shape. Só passam a importar se entrar login social — e aí guardam
  token de terceiro em texto plano, o que merece pensar em criptografia. A coluna
  `password` guarda o hash e não é selecionada em lugar nenhum do código.
- [] **Conferir RLS se esta sendo aplicado apos deploy com m** — verificar
## Aberto (achados da auditoria, ainda não corrigidos)


- [~] **Sem rate limit em lugar 
nenhum.** **CÓDIGO FEITO (2026-08-14), FALTA A
  MIGRATION** (o stack local estava fora do ar na hora; ver o aviso no fim desta
  seção). As 7 rotas de escrita (`PUT /api/deck`, `POST /api/battle/queue`,
  `POST /api/training/tm`, `POST /api/packs/{checkin,open}`,
  `DELETE /api/cards/[id]`, `GET /api/realtime/token`) chamam
  `enforceRateLimit()` logo depois da sessão. Os tetos ficam todos juntos em
  `RATE_LIMITS` (`src/lib/rateLimit.ts`), pra dar pra ler o orçamento inteiro de
  uma vez.
  - **O contador é TABELA** (`RateLimit`), não `Map`: em serverless a memória não
    sobrevive à invocação, e um contador que zera não conta nada.
  - **Uma tabela só, e o formato é ditado pelo better-auth**, que grava em
    `key`/`count`/`lastRequest` quando o `rateLimit` dele usa `storage:
    "database"`. Como a forma servia, não vale erguer uma segunda tabela com as
    mesmas três colunas — o que separa os dois mundos é o prefixo da chave
    (`app:` é nosso).
  - **Janela FIXA, não deslizante**, e fail-**OPEN** se o banco cair: o freio é
    contra script em loop, não é controle de acesso. Quem protege dado é a sessão
    e o `where` escopado por dono, e esses não têm exceção.
  - ⚠️ **`GET /api/battle/[id]/status` ficou de fora de propósito** — é o MOTOR do
    jogo (2 jogadores × 1 request a cada 2s, e é ele que resolve o turno). Teto
    ali trava a partida, não contém abuso. O aviso está no JSDoc da função.
  - Fora do escopo por ora: `POST /api/battle/[id]/{move,loadout}`. São de
    escrita, mas cada chamada é barata e a `@@unique[battleId, round, userId]` já
    impede repetição; pôr teto ali arrisca o jogo por pouco ganho.
  - **Correção do achado original (2026-08-14):** a redação antiga falava de um
    `POST /api/cards` capturando os 1025 pokémon e amplificando contra a PokéAPI.
    **Essa rota não existe** (`api/cards/[id]` só tem DELETE) e o cenário morreu
    quando o espelho entrou: a única fonte de pokémon é o `openPack`, que sorteia
    da tabela `Pokemon` local, **sem nenhum fetch**, e ainda tem cooldown. Hoje só
    `syncPokedex` (cron/seed) e `fetchAndCacheType` batem na PokéAPI.
- [~] **`betterAuth` no mínimo absoluto.** **CÓDIGO FEITO (2026-08-14), FALTA A
  MIGRATION.** `src/modules/auth/auth.ts` (não `src/lib/auth.ts`, que nunca
  existiu) ganhou `baseURL`, `trustedOrigins`, `session` e `rateLimit`.
  - `rateLimit` com `storage: "database"` — o default é `memory`, que aqui **não
    freia nada** (a lambda zera). Regras próprias e bem mais apertadas no caminho
    que um ataque de senha percorre: `/sign-in/email` 5/min.
  - `session.updateAge` de 1 dia porque **todo poll de 2s da batalha chama
    `getSession`** — sem isso o better-auth reescreveria a linha da sessão a cada
    request, ou seja, ~1 escrita por segundo por partida só pra carimbar data.
- [x] ~~**`import "server-only"` não existe no projeto.**~~ **FEITO
  (2026-08-14).** Está em `lib/prisma.ts`, `lib/rateLimit.ts`,
  `modules/auth/auth.ts` e nos **6 barrels** de módulo. A regra "ui/ não importa
  Prisma" deixou de ser só documentação: **verifiquei quebrando de propósito** —
  um `import "@/src/modules/battle"` dentro de um componente `"use client"` faz o
  `next build` falhar com 8 erros de `server-only`.
  - A armadilha que o plano previa (`packs/ui/types.ts` importando do barrel)
    **não existia**: o arquivo só cita `STARTING_LEVEL` num comentário. Nenhum
    arquivo de `ui/` puxa barrel.
  - **Pegadinha real, essa sim:** `server-only` resolve pro `empty.js` só sob a
    condição `react-server` (o bundler do Next) e pro `index.js` — que LANÇA de
    propósito — em Node puro. O vitest roda em Node, então precisou de um alias
    em `vitest.config.ts`; sem ele, todo teste que alcançasse `lib/prisma` de
    verdade morreria no import, com um erro sem relação com o que ele prova.
- [x] ~~`/design-system` está FORA do grupo (game) => rota pública, sem sessão.~~
  **FEITO (2026-08-14):** movida pra `src/app/(game)/design-system/`, herdando o
  `redirect("/login")` do layout do grupo. A URL não muda — `(game)` é grupo de
  rota, não segmento. O `next build` confirma: a rota saiu de estática pra `ƒ`
  (dinâmica), que é o sintoma de ela ter passado a ler sessão.

> ✅ **Migration aplicada (2026-08-14).** São DUAS pastas, e vale saber por quê:
> `20260814052202_rate_limit` cria a tabela, e `20260814060000_rate_limit_rls`
> liga a RLS que faltou nela. **A regra do AGENTS.md é ligar RLS na MESMA
> migration que cria a tabela — essa foi gerada e aplicada sem a linha**, e
> migration aplicada é imutável (editar o `.sql` muda o checksum e o
> `migrate deploy` seguinte falha). Conserto de migration aplicada é sempre outra
> migration. Sem isso a tabela ficaria aberta na API PostgREST, entregando o
> "zere meu próprio contador" — justo o que o freio existe pra impedir.


# PRISMA CLIENT GLOBAL

# VERIFICAR ISSO

Documenta o padrão como ele realmente é, não como seria bonito. Pontos que fiz questão de deixar explícitos:

CQRS lite, com um aviso. Botei em destaque que aqui CQRS é separação por pasta — sem event store, sem event bus, sem read model. Sem isso, o próximo agente lê "CQRS" e te entrega um Kafka.

Tabela de dependência entre pastas. Quem pode importar quem. A linha que mais importa: ui/ não pode importar Prisma nem commands/queries — senão o Prisma vaza pro bundle do browser.

As regras estão escritas como sintoma, não como teoria. Ex., a regra 1 diz literalmente: "o sintoma de que você errou é a page virar servidor renderizando um único componente cliente que é a página inteira" — que foi exatamente o meu erro no começo. Documentei o erro, não só o acerto.

Também estão lá: o par getBattleState (escreve) vs readBattleState (só lê), a proibição de escrita no render, o DTO obrigatório com o caso real do pendingMoves, as restrições de serverless (cron 1x/dia no Hobby → resolução na leitura → atomicidade crítica), e a dívida conhecida.


# TELA POKDEMON DETALHE
Detalhar melhor as skills em formato de cartas, verificar todas e melhorar UI e exibicao das cartas (parece ter mais cartaz do que disponiveis na batalha , verificar sobre isso e montar uma pre selecao de skills pra da a opcao do usuario montar um deck mais customizado , combinando skills com variedade de pokemon, e ao mesmo tempo n precisar carregar todas as skills na UI da batalha

# VER ESSE SCRPT
`scripts\generate-rarity.mjs`





# MIGRATIONS / REPRODUZIR O BANCO DO ZERO

Nenhum dos dois quebra o deploy de hoje. Os dois quebram **subir um ambiente novo**
(ou um banco local limpo). Analisar depois.

- [ ] **Os jobs do pg_cron não estão em migration nenhuma.** No prod rodam dois,
  ativos: `resolve-battle-turns` (30s, o backstop que resolve turno de partida que
  ninguém está pollando) e `refresh-pokedex` (**desativado em 2026-08-14**, ver
  `ROTINAS.md` §3 — o job existe, só está com `active = false`). A migration
  `supabase/migrations/20260715022134_enable_pg_cron_pg_net.sql` cria só as
  **extensões** — o `cron.schedule` está lá como comentário, pra rodar na mão.
  Resultado: ambiente novo sobe sem o backstop, e ninguém percebe até uma partida
  travar. O motivo de não versionar é real (o comando embute a URL do deploy, que
  muda por ambiente — versionar a de prod faria um staging bater no prod). Saída
  possível: a migration lê a URL e o secret de um GUC do banco
  (`current_setting('app.deploy_url')`) ou do Vault do Supabase, em vez de
  hardcode. Aí o `cron.schedule` vira versionável e o valor fica por ambiente.
  Já documentado como gap em `DEPLOY.md` e no cabeçalho da própria migration.

- [x] ~~**O fluxo de dev documentado está na ordem errada e quebra num banco
  limpo.**~~ **(a) FEITO (2026-07-31):** `DEPLOY.md` § "Rodar migrations
  localmente (dev)" agora manda Prisma → Supabase, com o porquê e o aviso do
  `db reset` ao lado; o `README.md` § "Rodando localmente" ganhou o
  `supabase db push` que faltava (sem ele o Realtime não sobe no local, apesar de
  o próprio README prometer isso). **(b) FEITO (2026-08-14):** o script
  `"db:reset"` entrou no `package.json` encadeando
  `supabase db reset && prisma migrate deploy && supabase db push`, pra ninguém
  depender de lembrar a ordem. Contexto original:
  `DEPLOY.md` mandava `supabase db push` e
  **depois** `prisma migrate deploy`. Num banco local recém-criado isso falha: as
  migrations de realtime dependem de tabelas que o Prisma ainda não criou —
  `create function ... language sql` valida o corpo contra `public."BattleParticipant"`
  (check_function_bodies) e o `create trigger` precisa de `public."Battle"`. O
  `.github/workflows/deploy.yml` faz na ordem certa (Prisma → Supabase); só a doc
  de dev diverge. Mesma pegadinha vale pro `supabase db reset`, que roda só
  `supabase/migrations/` e por isso nunca funciona sozinho aqui.
  Duas coisas a fazer: **(a)** inverter a ordem no `DEPLOY.md`; **(b)** avaliar um
  script `"db:reset"` no `package.json` encadeando
  `supabase db reset && prisma migrate deploy && supabase db push`, pra ninguém
  depender de lembrar a ordem.


# SEGURANÇA EM DEPLOY (VER SOBRE)
Como você optou por repository secrets (sem o gate de aprovação do environment), a trava é disciplina, não o pipeline: toda migration nova que for pra main precisa ser lida antes procurando DROP/DELETE/ALTER ... DROP. Se um dia isso te preocupar, o environment: Production com "required reviewer" é a rede — mas isso é decisão sua, e por ora está do jeito que você quis.