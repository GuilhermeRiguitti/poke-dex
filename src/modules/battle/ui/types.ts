// Contrato de dados entre o servidor e a UI da batalha (duelo alternado).
//
// Espelho ESTREITO das linhas do Prisma: só entra aqui o que o jogador pode ver.
// A linha do banco carrega a carta pendente do ativo (BattleAction); nada deve
// ser serializado pro client sem passar pelo mapper (toBattleDTO) — nem por
// props de Server Component, nem por NextResponse.json.

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
  level: number;
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

// Eventos do turno do duelo (renderização + BattleTurnLog). Chaveados por
// userId, não por lado A/B — no alternado o "lado" perde sentido; o que importa
// é quem agiu. Espelha DuelEvent (domain/duelTypes.ts).
export type BattleEventDTO =
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
  | { type: "hesitate"; userId: string }
  | { type: "roundStart"; round: number; firstUserId: string };

export interface TurnLogDTO {
  turnNumber: number;
  events: BattleEventDTO[];
}

export type BattleStatusDTO = "IN_PROGRESS" | "FINISHED" | "ABANDONED";

export interface BattleDTO {
  id: string;
  status: BattleStatusDTO;
  round: number;
  activeUserId: string | null;
  winnerId: string | null;
  participants: ParticipantDTO[];
  turnLogs: TurnLogDTO[];
}

// Deck como a tela da fila precisa dele (não é o deck inteiro do Prisma).
export interface QueueDeckDTO {
  id: string;
  name: string;
  slotCount: number;
}
