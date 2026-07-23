// Contrato de dados entre o servidor e a UI da batalha (duelo simultâneo).
//
// Espelho ESTREITO das linhas do Prisma: só entra aqui o que o jogador pode ver.
// A linha do banco carrega a carta que o oponente já escolheu pro round em
// aberto (BattleAction.cardSlot); nada deve ser serializado pro client sem
// passar pelo mapper (toBattleDTO) — nem por props de Server Component, nem por
// NextResponse.json.

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
// userId, não por lado A/B — o que importa pra tela é quem agiu. Espelha
// DuelEvent (domain/duelTypes.ts).
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
  winnerId: string | null;
  /**
   * Quem já escolheu a carta do round atual. É o "oponente pronto" da tela —
   * e o limite exato do que pode ser dito sobre a jogada alheia antes do turno
   * resolver: QUEM, nunca O QUÊ (ver toBattleDTO).
   */
  submittedUserIds: string[];
  participants: ParticipantDTO[];
  turnLogs: TurnLogDTO[];
}

// Deck como a tela da fila precisa dele (não é o deck inteiro do Prisma).
export interface QueueDeckDTO {
  id: string;
  name: string;
  slotCount: number;
}
