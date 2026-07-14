# TODO
- level 50 e fake, ver porque colocou e se tem como nao ser fake
- varias pages client ajustar e componentizar oq for preciso
- configurar o projeto
- Api client com react query tan stack 

# Estrutura organizacional a implementar
raiz/
    /.claude
    /.next
    /prisma
    /src
        /app
        /layouts
            /components
            layout.tsx
        /modules

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
  `removeCard` -> `deleteMany({ id, userId })`; `removeFromDeck` ->
  `deleteMany({ id, deck: { userId } })`; `addToDeck` compara `userCard.userId`
  e devolve `not_found` (não vira oráculo de "esse id existe"); o `deckId` que o
  cliente manda no POST /api/battle/queue passa por `readDeckRoster`, que filtra
  `where: { id: deckId, userId }`.
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

## Aberto (achados da auditoria, ainda não corrigidos)

- [ ] **Sem rate limit em lugar nenhum.** POST /api/cards captura qualquer um dos
  1025 pokémon sem custo nem limite; um script em loop faz 1025 escritas e, em
  cache miss, 1025 fetches na PokéAPI — amplificação contra a API de terceiro, e
  a fair use policy deles (https://pokeapi.co/docs/v2) pede o contrário. O
  PokeApiCache absorve o repeteco, mas não a primeira varredura.
- [ ] **`betterAuth` sem `rateLimit`, `trustedOrigins`, `baseURL` nem config de
  `session`** (src/lib/auth.ts está no mínimo absoluto). Brute force de senha no
  sign-in não tem freio explícito.
- [ ] **`import "server-only"` não existe no projeto.** A regra "ui/ não importa
  Prisma" é hoje SÓ documentação no CLAUDE.md — está sendo cumprida, mas nada a
  força. Pôr `server-only` em lib/prisma.ts, lib/auth.ts e nos index.ts dos
  módulos transforma a próxima regressão em erro de build em vez de Prisma no
  bundle do cliente.
- [ ] `/design-system` está FORA do grupo (game) => rota pública, sem sessão.



# MELHORIA
- sistema de abrir pacote pra obter pokemons, pokemons vao ser mais dificil conseguir
baseado em algum stats que define fortitude, quando maior esse stats menor a chance dele ser sortido


# PRISMA CLIENT GLOBAL



# VERIFICAR ISSO

Documenta o padrão como ele realmente é, não como seria bonito. Pontos que fiz questão de deixar explícitos:

CQRS lite, com um aviso. Botei em destaque que aqui CQRS é separação por pasta — sem event store, sem event bus, sem read model. Sem isso, o próximo agente lê "CQRS" e te entrega um Kafka.

Tabela de dependência entre pastas. Quem pode importar quem. A linha que mais importa: ui/ não pode importar Prisma nem commands/queries — senão o Prisma vaza pro bundle do browser.

As regras estão escritas como sintoma, não como teoria. Ex., a regra 1 diz literalmente: "o sintoma de que você errou é a page virar servidor renderizando um único componente cliente que é a página inteira" — que foi exatamente o meu erro no começo. Documentei o erro, não só o acerto.

Também estão lá: o par getBattleState (escreve) vs readBattleState (só lê), a proibição de escrita no render, o DTO obrigatório com o caso real do pendingMoves, as restrições de serverless (cron 1x/dia no Hobby → resolução na leitura → atomicidade crítica), e a dívida conhecida.
