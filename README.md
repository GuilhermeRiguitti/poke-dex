# PokéDuel

Jogo de duelo 1×1 de Pokémon, jogado no navegador. Você coleciona Pokémon, monta
um deck e batalha contra outro jogador em turnos.

## O jogo

- **Coleção com nível.** Cada Pokémon começa no nível 1 e sobe ganhando experiência
  ao batalhar. Subir de nível aumenta os atributos e **libera golpes novos** — cada
  Pokémon só sabe os golpes que aprenderia naquele nível no jogo original. Ao chegar
  no nível certo, ele **evolui**.
- **Deck.** Você escolhe 1 Pokémon e até 6 golpes dele para levar à batalha.
- **Turno simultâneo.** Os dois jogadores escolhem a carta do round **ao mesmo
  tempo, sem ver a escolha do outro**. Quando as duas estão na mesa, o turno é
  resolvido: quem tem mais Velocidade ataca primeiro (alguns golpes têm prioridade
  e furam a fila). A graça está em **ler o oponente e apostar**, não em reagir
  depois de ver a jogada dele.
- **Fim.** Quando o HP de um Pokémon chega a zero, a batalha acaba.

Todos os atributos e golpes vêm da [PokéAPI](https://pokeapi.co/) — nada é
inventado à mão.

## Como a batalha avança por dentro

O jogo roda em um servidor **serverless**: não existe um processo ligado o tempo
todo esperando os jogadores. Quem faz o turno avançar é a **própria tela** —
enquanto a batalha está aberta, o navegador pergunta o estado ao servidor de tempos
em tempos, e é essa pergunta que resolve o turno assim que as duas cartas já foram
jogadas.

Duas peças ajudam:

- **Aviso em tempo real (Realtime).** Em vez de só esperar a próxima pergunta, o
  servidor avisa a tela na hora em que o turno vira ou o oponente joga a carta,
  para a batalha responder rápido. É apenas um aviso: quem de fato resolve o turno
  continua sendo a tela quando pergunta de novo.
- **Verificação de segurança agendada.** Se os **dois** jogadores fecham a aba no
  meio da partida, ninguém está mais perguntando o estado ao servidor — e, sem
  isso, o turno nunca avançaria e a batalha ficaria travada para sempre, sem
  terminar. Para cobrir esse caso, uma tarefa agendada no banco de dados roda a
  cada 30 segundos e encerra as batalhas que estão paradas com o tempo do turno já
  vencido.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19
- Postgres no [Supabase](https://supabase.com), acessado via [Prisma](https://www.prisma.io)
- [better-auth](https://better-auth.com) para login (e-mail e senha)
- Supabase Realtime para o aviso em tempo real da batalha
- Tailwind CSS 4
- TypeScript e Vitest (testes)

## Rodando localmente

Você precisa de **Node 20+** e do **[Supabase CLI](https://supabase.com/docs/guides/cli)**.
O CLI sobe, usando **Docker**, uma cópia completa do Supabase na sua máquina —
banco Postgres **e o servidor de Realtime** — para você testar o aviso em tempo
real da batalha localmente, sem depender de nenhum serviço externo.

```bash
# 1. copie o arquivo de exemplo e preencha os valores.
#    O comando do passo 2 imprime as chaves locais do Supabase.
cp .env_example .env

# 2. sobe o Supabase local (Docker): banco + realtime
npx supabase start

# 3. prepara o banco e carrega os Pokémon (Gen 1) a partir da PokéAPI
npx prisma migrate deploy
npm run seed

# 4. sobe o app
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.
