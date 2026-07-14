// Tipos que descrevem o "estado" de uma batalha. Nada aqui vem direto da
// PokéAPI: são a nossa modelagem própria. Os VALORES que preenchem esses
// campos é que vêm ou da API (nome, tipos, base stats, moves) ou são
// inventados por nós (nível fixo, fórmulas de conversão, regras de turno).
// Ver lib/battle/snapshot.ts pra ver de onde cada campo é montado.

// Os 6 stats de batalha (HP, Atk, Def, SpAtk, SpDef, Speed) já convertidos
// pra valores de jogo. Os base stats crus vêm da PokéAPI; a conversão pra
// esses valores "de batalha" é nossa fórmula em stats.ts.
export interface BattleStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

// Um golpe pronto pra batalha. type/power/accuracy/damageClass/priority/maxPp
// vêm direto da PokéAPI (endpoint /move). currentPp é nosso (controle de uso
// durante a partida) — hoje não é decrementado em lugar nenhum, então PP não
// é um limite real ainda.
export interface BattleMoveDef {
  id: number;
  name: string;
  type: string; // nome do tipo do move, ex: "fire"
  power: number | null;
  accuracy: number | null; // null = sempre acerta
  damageClass: "physical" | "special" | "status";
  priority: number;
  maxPp: number;
  currentPp: number;
}

// Um pokémon dentro da batalha (snapshot mutável: HP atual, se desmaiou etc).
// pokemonId/name/types/moves = vindos da PokéAPI (via snapshot.ts).
// slot/level/stats/maxHp/currentHp/fainted = decisões/cálculos nossos:
//  - slot: posição no time (1-6), definida pela ordem no deck do usuário, não pela API.
//  - level: sempre BATTLE_LEVEL (50) pra todo mundo, pra equilibrar por base stat só.
//  - stats/maxHp: base stats da API rodados pela fórmula oficial do jogo (stats.ts),
//    mas sem IV/EV (assumidos neutros/zerados) — não existe treino nesse sistema.
export interface BattlePokemonState {
  slot: number; // 1-6, posição no time
  pokemonId: number;
  name: string;
  types: string[]; // 1-2 tipos
  level: number;
  stats: BattleStats;
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: BattleMoveDef[]; // até 4
}

// Um dos dois lados da batalha (um jogador): time completo + qual slot está
// ativo no momento. 100% estrutura nossa, sem relação com a PokéAPI.
export interface BattleSideState {
  userId: string;
  activeSlot: number;
  team: BattlePokemonState[]; // até 6
}

// Estado completo de uma batalha num dado turno. É isso que entra e sai da
// função pura resolveTurn (engine.ts) — não depende de banco nem de rede.
export interface BattleState {
  turnNumber: number;
  sideA: BattleSideState;
  sideB: BattleSideState;
}

// A "jogada" que cada lado escolhe no turno: atacar com um dos 4 moves,
// trocar de pokémon ativo, ou nada (perdeu o timeout / ativo desmaiado).
export type BattleAction =
  | { type: "MOVE"; moveSlot: number } // índice 0-3 dos moves do ativo
  | { type: "SWITCH"; toSlot: number }
  | { type: "NONE" }; // sem jogada (timeout / nada a fazer)

export type BattleSideLabel = "A" | "B";

// Log de tudo que aconteceu num turno (pra renderizar no client e pra
// guardar no BattleTurnLog do banco). Puramente descritivo do que o engine
// decidiu, não é usado como input de nada.
export type BattleEvent =
  | { type: "switch"; side: BattleSideLabel; toSlot: number; pokemonName: string }
  | {
      type: "attack";
      side: BattleSideLabel;
      moveName: string;
      damage: number;
      effectiveness: number;
      isCrit: boolean;
      missed: boolean;
      targetFainted: boolean;
    }
  | { type: "noAction"; side: BattleSideLabel };
