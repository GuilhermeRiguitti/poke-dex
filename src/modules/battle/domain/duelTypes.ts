// Modelo do DUELO tático por turnos SIMULTÂNEOS — como a série. Agora com TIME
// de até 6: o lado tem o time inteiro em campo, com UM ativo por vez, e a
// partida só acaba quando um lado fica SEM nenhum pokémon vivo.
//
// Os dois treinadores escolhem a jogada do MESMO turno sem ver a do outro, e o
// Speed decide quem bate primeiro DENTRO do turno. A jogada pode ser um GOLPE
// (MOVE) ou uma TROCA (SWITCH) — a troca resolve ANTES dos ataques (fiel à
// série): quem trocou não ataca no turno, e quem entrou PODE tomar dano.
//
// Quando o ativo desmaia e ainda há reserva viva, a partida NÃO acaba: entra em
// TROCA FORÇADA — o dono do pokémon que caiu escolhe quem entra (ou o motor
// auto-promove o 1º vivo no timeout). Só zerar o time é derrota.

import type { BattlePokemonState } from "./types";

// Um lado do duelo: o jogador e o TIME dele. `activeSlot` é o slot (1-based) do
// pokémon em campo; `team` traz todos (até 6) com HP/PP/fainted vivos — o motor
// precisa das reservas pra saber se a partida continua e pra aplicar trocas.
export interface DuelSide {
  userId: string;
  activeSlot: number;
  team: BattlePokemonState[];
}

// Estado completo do duelo num instante. É o que entra e sai do engine puro.
export interface DuelState {
  round: number;
  sideA: DuelSide;
  sideB: DuelSide;
}

// A jogada de UM lado no round:
//  - MOVE: uma das cartas da barra do ativo (0..5).
//  - SWITCH: troca o ativo pelo pokémon do slot alvo (1..6), gastando o turno.
//  - NONE: o tempo estourou e o lado passou em branco ("hesitação").
export type DuelAction =
  | { userId: string; type: "MOVE"; cardSlot: number }
  | { userId: string; type: "SWITCH"; targetSlot: number }
  | { userId: string; type: "NONE" };

// Log descritivo do turno (renderização + BattleTurnLog). Chaveado por userId,
// não por rótulo A/B — o que importa pra tela é quem agiu.
//
// `roundStart.firstUserId` é quem ganhou a ordem NESTE turno (priority → Speed
// → sorteio). É informação de jogo legítima e o que dá sentido ao Speed na tela.
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
  | { type: "switch"; userId: string; fromName: string; toName: string } // trocou de pokémon (voluntária ou forçada)
  | { type: "hesitate"; userId: string } // não escolheu a tempo
  | { type: "roundStart"; round: number; firstUserId: string };

/** O pokémon em campo de um lado. Fallback pro 1º da lista se o slot sumir. */
export function activeOf(side: DuelSide): BattlePokemonState {
  return side.team.find((m) => m.slot === side.activeSlot) ?? side.team[0];
}

/** true se o lado ainda tem ao menos um pokémon NÃO desmaiado. */
export function hasLivingMon(side: DuelSide): boolean {
  return side.team.some((m) => !m.fainted);
}

/** true se o ativo desmaiou mas ainda há reserva viva → precisa trocar. */
export function needsForcedSwitch(side: DuelSide): boolean {
  return activeOf(side).fainted && hasLivingMon(side);
}
