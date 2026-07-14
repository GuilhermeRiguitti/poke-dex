// Contrato de dados entre o servidor e a UI da batalha.
//
// É de propósito um espelho ESTREITO das linhas do Prisma: só entra aqui o que
// o jogador pode ver. A linha do banco carrega coisas que ele NÃO pode (ver
// toBattleDTO), então nada deve ser serializado pro client sem passar por esse
// mapper — nem por props de Server Component, nem por NextResponse.json.

export interface BattleMoveDTO {
  id: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  damageClass: "physical" | "special" | "status";
  priority: number;
  maxPp: number;
  currentPp: number;
}

export interface BattlePokemonDTO {
  id: string;
  slot: number;
  pokemonId: number;
  name: string;
  spriteUrl: string | null;
  types: string[];
  maxHp: number;
  currentHp: number;
  fainted: boolean;
  moves: BattleMoveDTO[];
}

export interface ParticipantDTO {
  id: string;
  userId: string;
  activeSlot: number;
  pokemons: BattlePokemonDTO[];
}

// Rótulo do lado. Não é "eu/inimigo": é a ordenação estável por userId que o
// engine persiste nos eventos do turno (ver resolveTurn.ts).
export type BattleSideLabelDTO = "A" | "B";

export type BattleEventDTO =
  | { type: "switch"; side: "A" | "B"; toSlot: number; pokemonName: string }
  | {
      type: "attack";
      side: "A" | "B";
      moveName: string;
      damage: number;
      effectiveness: number;
      isCrit: boolean;
      missed: boolean;
      targetFainted: boolean;
    }
  | { type: "noAction"; side: "A" | "B" };

export interface TurnLogDTO {
  turnNumber: number;
  events: BattleEventDTO[];
}

export type BattleStatusDTO = "IN_PROGRESS" | "FINISHED" | "ABANDONED";

export interface BattleDTO {
  id: string;
  status: BattleStatusDTO;
  currentTurn: number;
  winnerId: string | null;
  participants: ParticipantDTO[];
  turnLogs: TurnLogDTO[];
}

// Deck como a tela da fila precisa dele (não é o deck inteiro do Prisma).
export interface QueueDeckDTO {
  id: string;
  name: string;
  pokemonCount: number;
}
