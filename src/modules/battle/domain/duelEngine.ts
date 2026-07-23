import { calculateDamage } from "./damage";
import { orderForTurn, type OrderInput } from "./turnOrder";
import { effectivenessMultiplier, TypeEffectivenessMap } from "./typeChart";
import type { BattleMoveDef, BattlePokemonState } from "./types";
import type { DuelAction, DuelEvent, DuelSide, DuelState } from "./duelTypes";

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

// Motor PURO do duelo SIMULTÂNEO. Recebe um DuelState + as DUAS jogadas do
// round e devolve o novo estado. Sem banco, sem rede, sem Math.random direto
// (rng injetado): determinístico e testável. A orquestração (Prisma, trava
// otimista, transação) fica na camada de command, como sempre.
//
// O turno é uma unidade indivisível: as duas cartas entram, a ordem é decidida
// (turnOrder.ts), os dois golpes saem, e a rodada avança. Quem é nocauteado
// pelo golpe que veio primeiro NÃO chega a agir — é a consequência de jogo do
// Speed importar, e o que torna "bater primeiro" uma decisão real de build.

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

/** O slot escolhido por um lado neste round, ou null se ele não agiu. */
function cardSlotOf(action: DuelAction): number | null {
  return action.type === "CARD" ? action.cardSlot : null;
}

/**
 * Executa o golpe de um lado. Devolve true se o alvo desmaiou.
 *
 * Não age quem já foi nocauteado neste mesmo turno (o golpe que veio primeiro
 * matou), nem quem hesitou.
 */
function executeAttack(
  attacker: BattlePokemonState,
  defender: BattlePokemonState,
  attackerUserId: string,
  cardSlot: number | null,
  typeChart: TypeEffectivenessMap,
  rng: () => number,
  events: DuelEvent[]
): boolean {
  if (cardSlot === null) {
    events.push({ type: "hesitate", userId: attackerUserId });
    return false;
  }
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
 * Resolve UM round inteiro: as duas jogadas, na ordem de priority → Speed →
 * sorteio. Se um lado desmaiar, o duelo acaba (1×1: desmaiar = perder) e o
 * round NÃO avança.
 *
 * Idempotência/concorrência ficam na camada de command (trava otimista por
 * (round, status) + transação), como em resolveTurn.ts. Aqui é só a regra pura.
 */
export function resolveRound(params: ResolveRoundParams): DuelResult {
  const { typeChart, rng } = params;
  const state = cloneState(params.state);
  const events: DuelEvent[] = [];

  const byUser = (userId: string): DuelSide =>
    state.sideA.userId === userId ? state.sideA : state.sideB;

  // Casa cada ação com seu lado por userId — quem chamou não precisa saber
  // qual é o "A" e qual é o "B".
  for (const action of [params.actionA, params.actionB]) {
    if (action.userId !== state.sideA.userId && action.userId !== state.sideB.userId) {
      throw new Error(`userId ${action.userId} não pertence a este duelo`);
    }
  }
  if (params.actionA.userId === params.actionB.userId) {
    throw new Error("as duas ações do round são do mesmo jogador");
  }

  const inputs: [OrderInput, OrderInput] = [
    {
      userId: params.actionA.userId,
      mon: byUser(params.actionA.userId).active,
      cardSlot: cardSlotOf(params.actionA),
    },
    {
      userId: params.actionB.userId,
      mon: byUser(params.actionB.userId).active,
      cardSlot: cardSlotOf(params.actionB),
    },
  ];

  const [first, second] = orderForTurn(inputs[0], inputs[1], rng);
  events.push({ type: "roundStart", round: state.round, firstUserId: first.userId });

  let winnerId: string | null = null;

  for (const actor of [first, second]) {
    const defender = actor.userId === first.userId ? second : first;
    const targetFainted = executeAttack(
      actor.mon,
      defender.mon,
      actor.userId,
      actor.cardSlot,
      typeChart,
      rng,
      events
    );
    if (targetFainted) {
      winnerId = actor.userId;
      break; // 1×1: nocauteou, acabou — o segundo não chega a agir
    }
  }

  if (winnerId) {
    return { state, events, winnerId, finished: true };
  }

  state.round += 1;
  return { state, events, winnerId: null, finished: false };
}
