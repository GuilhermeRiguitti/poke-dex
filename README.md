# PokeDex

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

## Tudo vem da PokéAPI

A [PokéAPI](https://pokeapi.co/) é a **fonte da verdade** do jogo. Não inventamos
número nenhum: atributos, tipos, golpes, efetividade de tipo, learnset e evolução
saem todos de lá. O que buscamos, e de qual endpoint:

- **A espécie** (`/pokemon/{id}`): os **atributos base** (HP, ataque, defesa,
  etc.), os **tipos**, a arte/sprite e a lista de golpes que ela aprende.
- **Cada golpe** (`/move/{id}`): poder, precisão, PP, prioridade e a classe
  (físico, especial ou status).
- **A efetividade de tipo** (`/type/{id}`): quem é super eficaz, pouco eficaz ou
  não tem efeito contra quem. É isso que decide o multiplicador de dano na
  batalha — não uma tabela nossa.
- **A evolução** (`/pokemon-species/{id}` → `/evolution-chain/{id}`): a cadeia de
  evolução da espécie (explicado abaixo).

Como a PokéAPI é pública e gratuita, a política de uso justo dela pede que a gente
guarde o que busca em vez de bater na API a todo momento. Por isso **copiamos os
dados para o nosso próprio banco** (o comando `npm run seed`) e trabalhamos em
cima dessa cópia — isso também deixa filtrar e ordenar Pokémon por atributo, coisa
que a API crua não faz. Começamos pela 1ª geração (151 Pokémon) para não puxar os
mais de mil de uma vez, e uma rotina diária mantém a cópia atualizada.

### Golpes liberados por nível (learnset)

A PokéAPI descreve, para cada golpe de uma espécie, **em que nível** e **por qual
método** ela aprende (subindo de nível, por TM, por ovo, por tutor) — e isso muda
de um jogo para outro. A gente aproveita exatamente esse dado: escolhe **um jogo**
como referência para cada espécie e guarda, golpe a golpe, o nível de aprendizado.

No jogo, os golpes aprendidos **subindo de nível** entram como carta assim que o
Pokémon alcança aquele nível. É por isso que um Pokémon recém-pego tem poucas
cartas: subir de nível é o que **libera** golpes novos, como na série.

Os golpes que na série viriam por **TM (Máquina Técnica)** você ganha à parte: a
cada dia que entra no jogo, recebe um **token de TM**, e gasta um token pra
ensinar um golpe de máquina a um Pokémon que o conhece. (As outras vias da série —
ovo e tutor — ainda não estão no jogo.)

### Evolução (usamos a modelagem da própria PokéAPI)

A PokéAPI modela a evolução como uma **árvore**: cada espécie aponta para aquilo
em que ela evolui, e cada passo vem com a **condição** (o gatilho) para acontecer
— subir de nível, usar uma pedra, trocar, amizade, e por aí vai. Quando o gatilho
é por nível, a API informa o **nível mínimo**.

A gente usa **só as evoluções por nível** (gatilho "subir de nível" com um nível
mínimo). Evolução por pedra, troca, amizade ou horário fica de fora, porque não é
"chegar num nível" e o jogo não modela essas condições. Na prática:

- **Charmander → Charmeleon** (nível 16) **entra** — é por nível.
- **Eevee** (evolui por pedra/amizade) **não evolui** aqui.

Para cada espécie a gente guarda a evolução por nível como uma seta simples: **em
qual Pokémon ela vira** e **em que nível**. Quando o seu Pokémon ganha experiência
e chega nesse nível, ele **evolui de verdade** — vira a espécie nova, e passa a
usar os atributos e o learnset dela. As cartas que a espécie nova não aprende saem
do deck; as que ela também conhece continuam.

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
