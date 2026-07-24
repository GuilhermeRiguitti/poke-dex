import { orderForTurn, type OrderInput } from "./turnOrder";
import { calculateDamage } from "./damage";
import { effectivenessMultiplier, TypeEffectivenessMap } from "./typeChart";
import type { BattleMoveDef, BattlePokemonState } from "./types";
import {
  activeOf,
  hasLivingMon,
  needsForcedSwitch,
  type DuelAction,
  type DuelEvent,
  type DuelSide,
  type DuelState,
} from "./duelTypes";

/**
 * Carta de último recurso, quando NENHUMA carta do ativo tem PP. Sem isso, um
 * pokémon sem PP não teria ação nenhuma e ficaria travado (acumulando falta por
 * não jogar = derrota por abandono). Não vem da PokéAPI: os valores são nossos
 * (o struggle real tem recuo, que este sistema não modela). maxPp/currentPp 0 e
 * é um objeto COMPARTILHADO — quem usa não pode decrementá-lo (viraria -1 e
 * vazaria entre partidas), por isso a guarda `currentPp > 0` antes de gastar.
 */
export const STRUGGLE: BattleMoveDef = {
  id: 0,
  name: "struggle",
  type: "normal",
  power: 50,
  accuracy: null, // sempre acerta
  damageClass: "physical",
  priority: 0,
  maxPp: 0,
  currentPp: 0,
};

// Motor PURO do duelo SIMULTÂNEO em TIME. Recebe um DuelState + as DUAS jogadas
// do round e devolve o novo estado. Sem banco, sem rede, sem Math.random direto
// (rng injetado): determinístico e testável. A orquestração (Prisma, trava
// otimista, transação) fica na camada de command, como sempre.
//
// O turno é uma unidade indivisível. Diferença pro 1×1 puro: uma jogada pode ser
// TROCA (SWITCH), que resolve ANTES dos ataques; e desmaiar NÃO acaba a partida
// enquanto o lado tiver reserva viva — só zerar o time é derrota.

/** true se o pokémon ainda tem ao menos uma carta com PP. */
function hasUsableCard(mon: BattlePokemonState): boolean {
  return mon.moves.some((m) => m.currentPp > 0);
}

function cloneState(state: DuelState): DuelState {
  return JSON.parse(JSON.stringify(state)) as DuelState;
}

export interface ResolveRoundParams {
  state: DuelState;
  /** as jogadas do round; a ordem entre elas não importa (são casadas por userId). */
  actionA: DuelAction;
  actionB: DuelAction;
  typeChart: TypeEffectivenessMap;
  rng: () => number;
}

export interface DuelResult {
  state: DuelState;
  events: DuelEvent[];
  winnerId: string | null;
  finished: boolean;
}

/** Monta o estado inicial do duelo: rodada 1, os dois lados intactos. */
export function startDuel(sideA: DuelSide, sideB: DuelSide): DuelState {
  return { round: 1, sideA, sideB };
}

/**
 * Executa o golpe de um lado. Devolve true se o alvo desmaiou.
 *
 * Não age quem já foi nocauteado neste mesmo turno (o golpe que veio primeiro
 * matou). Quem trocou/hesitou nem chega aqui (não está na lista de atacantes).
 */
function executeAttack(
  attacker: BattlePokemonState,
  defender: BattlePokemonState,
  attackerUserId: string,
  cardSlot: number,
  typeChart: TypeEffectivenessMap,
  rng: () => number,
  events: DuelEvent[]
): boolean {
  if (attacker.fainted) return false; // nocauteado antes de agir: perdeu o turno

  const chosen = attacker.moves[cardSlot];

  // PP: carta sem PP com OUTRA disponível é jogada inválida (o command já
  // barra; isto é a rede de baixo) → passa em branco. NENHUMA carta com PP →
  // STRUGGLE, senão o jogador ficaria travado.
  let card = chosen;
  if (!card || (card.currentPp <= 0 && hasUsableCard(attacker))) {
    events.push({ type: "hesitate", userId: attackerUserId });
    return false;
  }
  if (card.currentPp <= 0) card = STRUGGLE;

  // PP gasto no uso, antes de rolar acerto (errar gasta PP igual). `card` é do
  // estado clonado; STRUGGLE é compartilhado e tem PP 0 — a guarda evita
  // decrementá-lo pra -1 e vazar entre partidas.
  if (card.currentPp > 0) card.currentPp -= 1;

  const effectiveness = effectivenessMultiplier(typeChart, card.type, defender.types);
  const result = calculateDamage({ attacker, defender, move: card, effectiveness, rng });

  defender.currentHp = Math.max(0, defender.currentHp - result.damage);
  if (defender.currentHp === 0) defender.fainted = true;

  events.push({
    type: "attack",
    userId: attackerUserId,
    cardName: card.name,
    damage: result.damage,
    effectiveness: result.effectiveness,
    isCrit: result.isCrit,
    missed: result.missed,
    targetFainted: defender.fainted,
  });

  return defender.fainted;
}

/**
 * Aplica uma TROCA voluntária de um lado: o ativo sai, o pokémon do slot alvo
 * entra. Emite o evento. Troca inválida (alvo inexistente, desmaiado, ou é o
 * próprio ativo) é ignorada — o command já valida; isto é a rede de baixo.
 */
function applyVoluntarySwitch(side: DuelSide, targetSlot: number, events: DuelEvent[]): void {
  const from = activeOf(side);
  const target = side.team.find((m) => m.slot === targetSlot);
  if (!target || target.fainted || target.slot === side.activeSlot) return;
  side.activeSlot = targetSlot;
  events.push({ type: "switch", userId: side.userId, fromName: from.name, toName: target.name });
}

/** Desfecho da partida a partir das reservas vivas: quem zerou o time perdeu. */
function outcome(state: DuelState): { finished: boolean; winnerId: string | null } {
  const aLiving = hasLivingMon(state.sideA);
  const bLiving = hasLivingMon(state.sideB);
  if (aLiving && bLiving) return { finished: false, winnerId: null };
  if (!aLiving && !bLiving) return { finished: true, winnerId: null }; // empate (duplo nocaute do último)
  return { finished: true, winnerId: aLiving ? state.sideA.userId : state.sideB.userId };
}

/**
 * Resolve UM round NORMAL inteiro (os dois lados com ativo vivo):
 *  1. as TROCAS resolvem primeiro (quem trocou não ataca);
 *  2. os ATAQUES saem na ordem priority → Speed → sorteio, contra o ativo ATUAL
 *     de cada lado (pós-troca) — quem entrou por troca PODE tomar dano;
 *  3. desmaiar NÃO encerra enquanto houver reserva viva; a partida só acaba
 *     quando um lado zera o time.
 *
 * Idempotência/concorrência ficam na camada de command (trava otimista + tx).
 */
export function resolveRound(params: ResolveRoundParams): DuelResult {
  const { typeChart, rng } = params;
  const state = cloneState(params.state);
  const events: DuelEvent[] = [];

  for (const action of [params.actionA, params.actionB]) {
    if (action.userId !== state.sideA.userId && action.userId !== state.sideB.userId) {
      throw new Error(`userId ${action.userId} não pertence a este duelo`);
    }
  }
  if (params.actionA.userId === params.actionB.userId) {
    throw new Error("as duas ações do round são do mesmo jogador");
  }

  const actionOf: Record<string, DuelAction> = {
    [params.actionA.userId]: params.actionA,
    [params.actionB.userId]: params.actionB,
  };

  // 1) TROCAS primeiro (fiel à série): mudam o ativo antes de qualquer ataque.
  for (const side of [state.sideA, state.sideB]) {
    const action = actionOf[side.userId];
    if (action.type === "SWITCH") applyVoluntarySwitch(side, action.targetSlot, events);
  }

  // Hesitação (NONE) vira evento; troca e golpe não hesitam.
  for (const side of [state.sideA, state.sideB]) {
    if (actionOf[side.userId].type === "NONE") events.push({ type: "hesitate", userId: side.userId });
  }

  // 2) ATAQUES: só quem escolheu MOVE, na ordem do turno pelo ativo atual.
  const attackers = [state.sideA, state.sideB].filter((s) => actionOf[s.userId].type === "MOVE");

  const cardSlotOf = (side: DuelSide): number => {
    const a = actionOf[side.userId];
    return a.type === "MOVE" ? a.cardSlot : 0;
  };

  let ordered: DuelSide[] = attackers;
  if (attackers.length === 2) {
    const [x, y] = attackers;
    const inX: OrderInput = { userId: x.userId, mon: activeOf(x), cardSlot: cardSlotOf(x) };
    const inY: OrderInput = { userId: y.userId, mon: activeOf(y), cardSlot: cardSlotOf(y) };
    const [first] = orderForTurn(inX, inY, rng);
    ordered = first.userId === x.userId ? [x, y] : [y, x];
  }

  if (ordered.length > 0) {
    events.push({ type: "roundStart", round: state.round, firstUserId: ordered[0].userId });
  }

  for (const side of ordered) {
    const foe = side === state.sideA ? state.sideB : state.sideA;
    executeAttack(activeOf(side), activeOf(foe), side.userId, cardSlotOf(side), typeChart, rng, events);
  }

  const { finished, winnerId } = outcome(state);
  if (finished) return { state, events, winnerId, finished: true };

  state.round += 1;
  return { state, events, winnerId: null, finished: false };
}

export interface ForcedSwitchParams {
  state: DuelState;
  /** slot escolhido por cada lado; null/inválido → auto-promove o 1º vivo. */
  choiceA: number | null;
  choiceB: number | null;
}

/** Slot do substituto na troca forçada: a escolha (se válida) ou o 1º vivo. */
function forcedTarget(side: DuelSide, choice: number | null): number | null {
  if (choice != null) {
    const picked = side.team.find((m) => m.slot === choice);
    if (picked && !picked.fainted) return picked.slot;
  }
  const first = [...side.team].sort((a, b) => a.slot - b.slot).find((m) => !m.fainted);
  return first ? first.slot : null;
}

/**
 * Aplica a TROCA FORÇADA: para cada lado cujo ativo desmaiou (e ainda tem
 * reserva viva), coloca em campo o substituto escolhido — ou o 1º vivo, se a
 * escolha não veio (timeout) ou é inválida. Depois disso nenhum lado precisa
 * mais trocar, e o próximo round é normal.
 */
export function applyForcedSwitch(params: ForcedSwitchParams): DuelResult {
  const state = cloneState(params.state);
  const events: DuelEvent[] = [];

  for (const side of [state.sideA, state.sideB]) {
    if (!needsForcedSwitch(side)) continue;
    const choice = side.userId === state.sideA.userId ? params.choiceA : params.choiceB;
    const target = forcedTarget(side, choice);
    if (target == null) continue; // sem reserva viva (não deveria: needsForcedSwitch garante)
    const from = activeOf(side);
    side.activeSlot = target;
    const to = side.team.find((m) => m.slot === target)!;
    events.push({ type: "switch", userId: side.userId, fromName: from.name, toName: to.name });
  }

  const { finished, winnerId } = outcome(state);
  if (finished) return { state, events, winnerId, finished: true };

  state.round += 1;
  return { state, events, winnerId: null, finished: false };
}
