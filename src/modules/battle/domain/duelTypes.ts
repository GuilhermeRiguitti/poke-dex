// Modelo do DUELO tático 1×1 por turnos SIMULTÂNEOS — como a série.
//
// Foi alternado por uma fatia (a Fase A1 tinha `activeUserId` + `actedThisRound`
// e uma ação por vez), e voltou: no Pokémon de verdade os dois treinadores
// escolhem o golpe do MESMO turno sem ver o do outro, e o Speed decide quem
// bate primeiro DENTRO do turno. O alternado matava exatamente isso — o Speed
// virava "quem começa a rodada" e a escolha deixava de ser às cegas.
//
// O que sobreviveu inteiro do alternado: a matemática de dano (damage.ts), a de
// tipo (typeChart.ts) e o STRUGGLE. O que mudou é a orquestração do turno.
//
// 1×1 puro (F1): cada lado tem UM pokémon ativo com uma barra de até 6 cartas.
// Não há troca no núcleo; o schema fica pronto pra time numa fase futura.

import type { BattlePokemonState } from "./types";

// Um lado do duelo: o jogador e seu pokémon ativo. Reaproveita
// BattlePokemonState (stats/moves/HP) — a carta é um BattleMoveDef do `moves`.
export interface DuelSide {
  userId: string;
  active: BattlePokemonState;
}

// Estado completo do duelo num instante. É o que entra e sai do engine puro.
// Note o que NÃO existe mais: `activeUserId`, `order` e `actedThisRound`. No
// simultâneo a rodada inteira é uma unidade — não há meio-turno pra guardar.
export interface DuelState {
  round: number;
  sideA: DuelSide;
  sideB: DuelSide;
}

// A jogada de UM lado no round: uma das cartas da barra, ou nada (o tempo
// estourou e o lado passou em branco — "hesitação").
export type DuelAction =
  | { userId: string; type: "CARD"; cardSlot: number } // 0..5 na barra
  | { userId: string; type: "NONE" };

// Log descritivo do turno (renderização + BattleTurnLog). Chaveado por userId,
// não por rótulo A/B — o que importa pra tela é quem agiu.
//
// `roundStart.firstUserId` é quem ganhou a ordem NESTE turno (priority → Speed
// → sorteio). É informação de jogo legítima e o que dá sentido ao Speed na
// tela: "seu pokémon foi mais rápido".
export type DuelEvent =
  | {
      type: "attack";
      userId: string;
      cardName: string;
      damage: number;
      effectiveness: number;
      isCrit: boolean;
      missed: boolean;
      targetFainted: boolean;
    }
  | { type: "hesitate"; userId: string } // não escolheu a tempo
  | { type: "roundStart"; round: number; firstUserId: string };
