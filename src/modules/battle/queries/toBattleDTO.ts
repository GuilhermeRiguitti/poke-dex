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
// NÃO é boilerplate, e no turno SIMULTÂNEO é mais crítico que antes: a linha
// que resolveIfDue lê traz `actions` com o `cardSlot` — a carta que o oponente
// escolheu para ESTE round, antes de ele resolver. Mandar a linha crua pro
// browser entrega a jogada do adversário justamente na janela em que a escolha
// deveria ser às cegas: dava pra abrir o devtools e responder à carta dele.
//
// O que sai daqui sobre as ações é só QUEM já escolheu (`submittedUserIds`) —
// nunca O QUÊ. Isso é informação legítima ("oponente pronto") e é o que a tela
// usa; o cardSlot não tem caminho pro cliente.

// Estrutural de propósito: aceita qualquer linha que tenha ao menos isto —
// inclusive as que trazem `actions` com cardSlot junto, que é justamente o ponto.
interface BattleRow {
  id: string;
  status: string;
  round: number;
  winnerId: string | null;
  actions?: { userId: string; round: number }[];
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
    winnerId: row.winnerId,
    // QUEM já escolheu neste round — nunca O QUÊ. Ver o comentário no topo.
    submittedUserIds: (row.actions ?? []).filter((a) => a.round === row.round).map((a) => a.userId),
    participants: row.participants.map(toParticipantDTO),
    turnLogs: row.turnLogs.map((log) => ({
      turnNumber: log.turnNumber,
      events: (log.events as BattleEventDTO[]) ?? [],
    })),
  };
}
