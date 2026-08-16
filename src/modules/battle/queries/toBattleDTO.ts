import { bstOf, rarityTier } from "@/src/modules/pokemon";
import { TURN_TIMEOUT_MS, remainingTurnMs } from "../domain/turnClock";
import { STAGE_STATS, normalizeConditions } from "../domain/conditions";
import { ENERGY_MAX, energyCostOf } from "../domain/energy";
import { absenceRemainingMs, isPresent } from "../domain/presence";
import { effectivenessMultiplier, type TypeEffectivenessMap } from "../domain/typeChart";
import type { BattleMoveDef } from "../domain/types";
import type {
  BattleDTO,
  BattleEventDTO,
  BattleMoveDTO,
  BattlePokemonDTO,
  BattleStatusDTO,
  MonConditionsDTO,
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
  turnStartedAt: Date;
  /** Piso da presença: quem nunca carimbou é medido daqui. */
  createdAt: Date;
  actions?: { userId: string; round: number }[];
  participants: {
    id: string;
    userId: string;
    activeSlot: number;
    energy: number;
    lastSeenAt: Date | null;
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
      conditions?: unknown;
    }[];
  }[];
  turnLogs: { turnNumber: number; events: unknown }[];
}

/**
 * Efetividade da carta contra quem está EM CAMPO do outro lado. `null` quando
 * não há o que medir — carta de status/sem poder, sem matriz, ou sem defensor.
 *
 * É a MESMA conta que o motor faz na hora do golpe (`effectivenessMultiplier`),
 * só que antecipada: sem ela o jogador só descobre que o golpe era pouco eficaz
 * DEPOIS de gastar o turno e a energia, e "ler o matchup" deixa de ser jogada.
 */
function effectivenessOf(
  move: BattleMoveDef,
  chart: TypeEffectivenessMap | null,
  defenderTypes: string[] | null,
): number | null {
  if (!chart || !defenderTypes || defenderTypes.length === 0) return null;
  if (move.damageClass === "status" || move.power == null) return null;
  return effectivenessMultiplier(chart, move.type, defenderTypes);
}

function toMoveDTO(
  move: BattleMoveDef,
  chart: TypeEffectivenessMap | null,
  defenderTypes: string[] | null,
): BattleMoveDTO {
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
    // Do servidor, sempre: a tabela de faixas é balanceamento e não vai pro
    // browser (ver o comentário em BattleMoveDTO.energyCost).
    energyCost: energyCostOf(move),
    effect: move.effect ?? null,
    effectiveness: effectivenessOf(move, chart, defenderTypes),
  };
}

/**
 * O estado alterado como a tela vê. Whitelist explícita, como todo o resto
 * deste arquivo: `sleepTurns` fica de fora (quantos turnos o sono ainda dura é
 * escondido também na série) e os estágios saem só quando são diferentes de
 * zero. Status, confusão e semente SÃO públicos — jogar contra status sem
 * enxergar o status seria adivinhação.
 */
function toConditionsDTO(raw: unknown): MonConditionsDTO {
  const c = normalizeConditions(raw);
  return {
    status: c.status,
    confused: c.confusionTurns > 0,
    seeded: c.seeded,
    stages: STAGE_STATS.filter((stat) => c.stages[stat] !== 0).map((stat) => ({ stat, stage: c.stages[stat] })),
  };
}

function toPokemonDTO(
  row: BattleRow["participants"][number]["pokemons"][number],
  chart: TypeEffectivenessMap | null,
  /** tipos do ativo ADVERSÁRIO — é contra ele que a efetividade é medida */
  defenderTypes: string[] | null,
): BattlePokemonDTO {
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
    moves: moves.map((mv) => toMoveDTO(mv, chart, defenderTypes)),
    conditions: toConditionsDTO(row.conditions),
    // Raridade pela fortitude: pinta o metal da moldura da carta de reserva.
    // NÃO é informação nova — sai de `pokemonId`, que já está aqui. Vem
    // calculada do servidor porque `bstOf` carrega a tabela dos 1025 BSTs e a
    // arena é código de cliente.
    rarity: rarityTier(bstOf(row.pokemonId)),
    // stats NÃO entram: a carta de reserva é `mini` (não desenha barras), e
    // este DTO leva os pokémon dos DOIS lados — mandar stat daqui entregaria
    // os números exatos do oponente. Mesma razão do cardSlot, logo abaixo.
  };
}

function toParticipantDTO(
  row: BattleRow["participants"][number],
  /** Piso da presença pra quem nunca carimbou: o createdAt da PARTIDA. */
  floor: Date,
  now: number,
  chart: TypeEffectivenessMap | null,
  defenderTypes: string[] | null,
): ParticipantDTO {
  const present = isPresent(row.lastSeenAt, floor, new Date(now));
  return {
    id: row.id,
    userId: row.userId,
    activeSlot: row.activeSlot,
    pokemons: row.pokemons.map((p) => toPokemonDTO(p, chart, defenderTypes)),
    energy: row.energy,
    energyMax: ENERGY_MAX,
    present,
    // Só conta quando ele JÁ está fora da janela de batida — enquanto o sinal é
    // recente, mostrar um cronômetro assustaria o jogador à toa (uma batida
    // atrasada 21s é normal).
    absentForMs: present ? null : absenceRemainingMs(row.lastSeenAt, floor, new Date(now)),
  };
}

/** Tipos de quem está em campo por participante — o defensor de cada lado. */
function activeTypesOf(p: BattleRow["participants"][number]): string[] | null {
  const active = p.pokemons.find((m) => m.slot === p.activeSlot);
  return active ? ((active.types as string[]) ?? []) : null;
}

// `now` é parâmetro pra o teste poder cravar o instante — em produção é sempre
// o relógio do servidor, que é justamente o ponto do countdown (ver turnEndsInMs
// em ui/types.ts).
//
// `chart` é OPCIONAL de propósito: quem não passa a matriz recebe
// `effectiveness: null` em toda carta e a tela simplesmente não desenha o selo
// de vantagem — em vez de o mapper virar assíncrono e arrastar uma consulta pra
// dentro da fronteira de serialização, que tem que continuar pura e testável.
export function toBattleDTO(
  row: BattleRow,
  now = Date.now(),
  chart: TypeEffectivenessMap | null = null,
): BattleDTO {
  // A efetividade de um lado se mede contra o ATIVO do outro. Em partida de 2
  // isso é só "o outro participante"; com um lado só (estado degenerado), fica
  // sem defensor e o campo vira null em vez de mentir 1x.
  const defenderTypes = row.participants.map((_, i) =>
    row.participants.length === 2 ? activeTypesOf(row.participants[1 - i]) : null,
  );
  return {
    id: row.id,
    status: row.status as BattleStatusDTO,
    round: row.round,
    winnerId: row.winnerId,
    // QUEM já escolheu neste round — nunca O QUÊ. Ver o comentário no topo.
    submittedUserIds: (row.actions ?? []).filter((a) => a.round === row.round).map((a) => a.userId),
    // O tempo que sobra pra escolher. Não é segredo de ninguém: a janela é a
    // mesma pros dois lados e começa no mesmo instante (turnStartedAt).
    turnEndsInMs: remainingTurnMs(row.turnStartedAt, now),
    turnTimeoutMs: TURN_TIMEOUT_MS,
    participants: row.participants.map((p, i) =>
      toParticipantDTO(p, row.createdAt, now, chart, defenderTypes[i]),
    ),
    turnLogs: row.turnLogs.map((log) => ({
      turnNumber: log.turnNumber,
      events: (log.events as BattleEventDTO[]) ?? [],
    })),
  };
}
