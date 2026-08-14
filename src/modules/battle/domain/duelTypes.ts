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

import type { BattleMoveDef, BattlePokemonState } from "./types";

// Um lado do duelo: o jogador e o TIME dele. `activeSlot` é o slot (1-based) do
// pokémon em campo; `team` traz todos (até 6) com HP/PP/fainted vivos — o motor
// precisa das reservas pra saber se a partida continua e pra aplicar trocas.
export interface DuelSide {
  userId: string;
  activeSlot: number;
  team: BattlePokemonState[];
  /**
   * Energia do LADO (não do pokémon em campo). É por jogador de propósito:
   * fosse por pokémon, trocar viraria recarga — e trocar já é escolha cara o
   * bastante (perde o turno) sem virar também a saída pra ficar sem energia.
   *
   * Opcional porque a coluna nasceu com default: partida começada antes desta
   * fatia lê `undefined` e cai em ENERGY_START na primeira resolução.
   */
  energy?: number;
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
//
// `moves` na TROCA é a barra de skills escolhida pra quem está ENTRANDO. As
// skills deixaram de morar no deck e passaram a ser decisão de batalha: o
// jogador monta a barra no momento em que põe o pokémon em campo. Vem já
// traduzida em BattleMoveDef (o motor é puro — quem lê a tabela Move é o
// resolveTurn, fora da transação). Ausente = mantém a barra que o pokémon já
// tinha, que é o caso do auto-promover no timeout.
export type DuelAction =
  | { userId: string; type: "MOVE"; cardSlot: number }
  | { userId: string; type: "SWITCH"; targetSlot: number; moves?: BattleMoveDef[] }
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
      /** golpe de múltiplos acertos: quantas vezes bateu (ausente = 1). */
      hits?: number;
    }
  | { type: "switch"; userId: string; fromName: string; toName: string } // trocou de pokémon (voluntária ou forçada)
  | { type: "hesitate"; userId: string } // não escolheu a tempo
  /**
   * Sumiu e não voltou (battle/domain/presence.ts). Diferente de `hesitate`:
   * hesitar é perder UM turno, isto encerra a partida. Sem o evento, o jogador
   * que ganha por ausência vê só o placar mudar sozinho e não entende por quê.
   */
  | { type: "abandoned"; userId: string }
  /** levantou o escudo (protect e família). `held: false` = a proteção falhou. */
  | { type: "protect"; userId: string; monName: string; held: boolean }
  | { type: "roundStart"; round: number; firstUserId: string }
  // ── efeitos (domain/conditions.ts) ────────────────────────────────────────
  // Todos chaveados por `targetUserId` — de quem é o pokémon que SOFREU. É o
  // dado que a tela usa pra pôr o balão na cabeça certa; quem usou o golpe já
  // aparece no evento de ataque logo antes.
  /** pegou um status novo (queimadura, sono, confusão, semente...) */
  | { type: "ailment"; targetUserId: string; monName: string; ailment: string; blocked?: "immune" | "already" }
  /** estágio de atributo mudou. `delta` 0 = já estava no teto/piso. */
  | { type: "stage"; targetUserId: string; monName: string; stat: string; delta: number; stage: number }
  /** perdeu o turno por causa de uma condição (dormindo, paralisado, recuou...) */
  | { type: "blocked"; targetUserId: string; monName: string; reason: string; selfDamage?: number }
  /** o status passou sozinho: acordou, descongelou */
  | { type: "recovered"; targetUserId: string; monName: string; ailment: string }
  /** dano de fim de turno (queimadura/veneno/semente) ou cura (recover/dreno) */
  | { type: "tick"; targetUserId: string; monName: string; source: string; hp: number; fainted?: boolean };

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
