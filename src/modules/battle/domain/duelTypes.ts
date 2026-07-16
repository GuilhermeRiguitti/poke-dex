// Modelo do DUELO tático 1×1 por turnos ALTERNADOS (PLANO_JOGO.md §3) — Fase A.
//
// Contraste com o modelo antigo (domain/types.ts + engine.ts), que segue vivo
// até a orquestração migrar: lá os DOIS lados submetem pro mesmo turno N e o
// engine CASA as duas jogadas. Aqui o turno é de UM ator só (`activeUserId`);
// cada ação é aplicada sozinha, e o outro reage no turno dele. A MATEMÁTICA de
// dano (damage.ts) e a de tipo (typeChart.ts) são reaproveitadas inteiras — o
// que muda é só a orquestração do turno.
//
// 1×1 puro (F1): cada lado tem UM pokémon ativo com uma barra de 6 cartas. Não
// há troca no núcleo — a profundidade vem de ler o oponente e reagir, não de
// trocar de pokémon (§1). O schema fica pronto pra time numa fase futura.
//
// Energia (§3.2) e reação (§3.3) NÃO entram aqui: são as fatias A2 e A3. Este
// arquivo é a fatia A1 — só o loop alternado com iniciativa.

import type { BattlePokemonState } from "./types";

// Um lado do duelo: o jogador e seu pokémon ativo. Reaproveita
// BattlePokemonState (stats/moves/HP) — a carta é um BattleMoveDef do `moves`.
export interface DuelSide {
  userId: string;
  active: BattlePokemonState;
}

// Estado completo do duelo num instante. É o que entra e sai do engine puro.
//  - `round`: rodada atual (1..). Uma rodada = os dois agem uma vez.
//  - `order`: ordem de iniciativa DESTA rodada [primeiro, segundo] (por Speed,
//    desempate determinístico por userId — §3.1). Reconstruível.
//  - `activeUserId`: de quem é a vez agora.
//  - `actedThisRound`: quantas ações já saíram nesta rodada (0, 1 ou 2).
export interface DuelState {
  round: number;
  order: [string, string];
  activeUserId: string;
  actedThisRound: number;
  sideA: DuelSide;
  sideB: DuelSide;
}

// A ação de UM ator no seu turno: jogar uma das 6 cartas, ou nada (hesitação
// por timeout — §4.4, o turno estoura e passa em branco).
export type DuelAction =
  | { userId: string; type: "CARD"; cardSlot: number } // 0..5 na barra
  | { userId: string; type: "NONE" };

// Log descritivo de um turno do duelo (renderização + BattleTurnLog). Chaveado
// por userId, não por rótulo A/B — no alternado o "lado" perde sentido; o que
// importa é quem agiu.
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
  | { type: "hesitate"; userId: string } // timeout: turno passou em branco
  | { type: "roundStart"; round: number; firstUserId: string };
