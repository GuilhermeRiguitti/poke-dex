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
// NÃO é boilerplate. A linha que resolveIfDue devolve pode vir com `actions` (a
// carta pendente do jogador da vez) e com os `stats` de cada pokémon. Mandar a
// linha crua pro browser entrega a jogada do oponente antes do turno resolver.
// Aqui só passa o que está escrito abaixo — whitelist explícita fecha o vazamento.

// Estrutural de propósito: aceita qualquer linha que tenha ao menos isto —
// inclusive as que trazem `actions` junto, que é justamente o ponto.
interface BattleRow {
  id: string;
  status: string;
  round: number;
  activeUserId: string | null;
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
      level: number;
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
  // types/moves são colunas Json; quem escreveu foi buildDuelSnapshot, então a
  // forma é conhecida — o cast é a leitura desse contrato.
  const moves = (row.moves as BattleMoveDef[]) ?? [];
  return {
    id: row.id,
    slot: row.slot,
    pokemonId: row.pokemonId,
    name: row.name,
    spriteUrl: row.spriteUrl,
    types: (row.types as string[]) ?? [],
    level: row.level,
    maxHp: row.maxHp,
    currentHp: row.currentHp,
    fainted: row.fainted,
    moves: moves.map(toMoveDTO),
    // stats NÃO entram: a UI não usa, e stat do inimigo é informação de jogo.
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
    round: row.round,
    activeUserId: row.activeUserId,
    winnerId: row.winnerId,
    participants: row.participants.map(toParticipantDTO),
    turnLogs: row.turnLogs.map((log) => ({
      turnNumber: log.turnNumber,
      events: (log.events as BattleEventDTO[]) ?? [],
    })),
    // `actions` (a carta pendente do ativo) NÃO entra. Ver o comentário no topo.
  };
}
