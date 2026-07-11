export interface BattleStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

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

export interface BattleSideState {
  userId: string;
  activeSlot: number;
  team: BattlePokemonState[]; // até 6
}

export interface BattleState {
  turnNumber: number;
  sideA: BattleSideState;
  sideB: BattleSideState;
}

export type BattleAction =
  | { type: "MOVE"; moveSlot: number } // índice 0-3 dos moves do ativo
  | { type: "SWITCH"; toSlot: number }
  | { type: "NONE" }; // sem jogada (timeout / nada a fazer)

export type BattleSideLabel = "A" | "B";

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
