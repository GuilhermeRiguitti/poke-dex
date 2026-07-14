import type { BattleMoveDef } from "../domain/types";
import type {
  BattleDTO,
  BattleEventDTO,
  BattleMoveDTO,
  BattlePokemonDTO,
  BattleStatusDTO,
  ParticipantDTO,
} from "../ui/types";

// Fronteira de serialização: linha do Prisma -> o que o jogador pode ver.
//
// Isso NÃO é boilerplate. A linha que tryResolveTurn devolve carrega
// `pendingMoves` (as jogadas ainda não resolvidas dos DOIS lados) e os `stats`
// de cada pokémon. Mandar a linha crua pro browser entrega a jogada do
// oponente antes do turno resolver. Aqui só passa campo que está escrito
// abaixo, então o vazamento não volta por descuido.

// Estrutural de propósito: aceita qualquer linha que tenha ao menos isto —
// inclusive as que trazem pendingMoves junto, que é justamente o ponto.
interface BattleRow {
  id: string;
  status: string;
  currentTurn: number;
  winnerId: string | null;
  participants: {
    id: string;
    userId: string;
    activeSlot: number;
    pokemons: {
      id: string;
      slot: number;
      pokemonId: number;
      name: string;
      spriteUrl: string | null;
      types: unknown;
      maxHp: number;
      currentHp: number;
      fainted: boolean;
      moves: unknown;
    }[];
  }[];
  turnLogs: { turnNumber: number; events: unknown }[];
}

function toMoveDTO(move: BattleMoveDef): BattleMoveDTO {
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
    damageClass: move.damageClass,
    priority: move.priority,
    maxPp: move.maxPp,
    currentPp: move.currentPp,
  };
}

function toPokemonDTO(row: BattleRow["participants"][number]["pokemons"][number]): BattlePokemonDTO {
  // types/moves são colunas Json no Prisma; quem escreveu foi buildTeamSnapshot,
  // então a forma é conhecida — o cast é a leitura desse contrato, não um chute.
  const moves = (row.moves as BattleMoveDef[]) ?? [];
  return {
    id: row.id,
    slot: row.slot,
    pokemonId: row.pokemonId,
    name: row.name,
    spriteUrl: row.spriteUrl,
    types: (row.types as string[]) ?? [],
    maxHp: row.maxHp,
    currentHp: row.currentHp,
    fainted: row.fainted,
    moves: moves.map(toMoveDTO),
    // level e stats NÃO entram: a UI não usa, e stats do inimigo é informação de jogo.
  };
}

function toParticipantDTO(row: BattleRow["participants"][number]): ParticipantDTO {
  return {
    id: row.id,
    userId: row.userId,
    activeSlot: row.activeSlot,
    pokemons: row.pokemons.map(toPokemonDTO),
  };
}

export function toBattleDTO(row: BattleRow): BattleDTO {
  return {
    id: row.id,
    status: row.status as BattleStatusDTO,
    currentTurn: row.currentTurn,
    winnerId: row.winnerId,
    participants: row.participants.map(toParticipantDTO),
    turnLogs: row.turnLogs.map((log) => ({
      turnNumber: log.turnNumber,
      events: (log.events as BattleEventDTO[]) ?? [],
    })),
    // pendingMoves NÃO entra. Ver o comentário no topo.
  };
}
