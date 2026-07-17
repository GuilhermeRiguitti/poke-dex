import { calculateDamage } from "./damage";
import { computeInitiative } from "./duelInitiative";
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

// Motor PURO do duelo alternado (PLANO_JOGO.md §3) — Fase A1. Recebe um
// DuelState + UMA ação e devolve o novo estado. Sem banco, sem rede, sem
// Math.random direto (rng injetado): determinístico e testável, igual ao
// engine antigo. A orquestração (Prisma/HTTP/trava otimista) fica na camada de
// command, como sempre.
//
// A diferença de fundo pro engine.ts: lá `resolveTurn` casa DUAS jogadas de um
// turno; aqui `applyDuelAction` aplica UMA. É a virada de "simultâneo" pra
// "alternado". A conta de dano (calculateDamage) e o STRUGGLE são reaproveitados.

/** true se o pokémon ainda tem ao menos uma carta com PP. */
function hasUsableCard(mon: BattlePokemonState): boolean {
  return mon.moves.some((m) => m.currentPp > 0);
}

function cloneState(state: DuelState): DuelState {
  return JSON.parse(JSON.stringify(state)) as DuelState;
}

function sideOf(state: DuelState, userId: string): DuelSide {
  if (state.sideA.userId === userId) return state.sideA;
  if (state.sideB.userId === userId) return state.sideB;
  throw new Error(`userId ${userId} não pertence a este duelo`);
}

function otherSide(state: DuelState, userId: string): DuelSide {
  return state.sideA.userId === userId ? state.sideB : state.sideA;
}

export interface ApplyDuelActionParams {
  state: DuelState;
  action: DuelAction;
  typeChart: TypeEffectivenessMap;
  rng: () => number;
}

export interface DuelResult {
  state: DuelState;
  events: DuelEvent[];
  winnerId: string | null;
  finished: boolean;
}

/**
 * Monta o estado inicial do duelo: rodada 1, iniciativa calculada, a vez é de
 * quem começa. `sideA`/`sideB` são só os dois lados (a ordem entre eles não
 * importa — a iniciativa decide quem age primeiro).
 */
export function startDuel(sideA: DuelSide, sideB: DuelSide): DuelState {
  const order = computeInitiative(sideA, sideB);
  return {
    round: 1,
    order,
    activeUserId: order[0],
    actedThisRound: 0,
    sideA,
    sideB,
  };
}

/**
 * Aplica UMA ação do jogador da vez e avança o duelo:
 *  - CARD: joga a carta no oponente (com PP/STRUGGLE e a conta de dano reais).
 *  - NONE: hesitação (o turno estourou e passou em branco — §4.4).
 *
 * Depois de agir, passa a vez: se ainda falta um ator na rodada, é a vez dele;
 * se os dois já agiram, começa uma rodada nova e a iniciativa é recalculada
 * (§3.1 — hoje o Speed é estático, mas recalcular deixa pronto pra stat stages
 * da Fase D). Se o oponente desmaiar, o duelo acaba na hora (1×1: desmaiar =
 * perder) e a vez NÃO avança.
 *
 * Idempotência/concorrência ficam na camada de command (trava otimista por
 * `activeUserId` + round), como em resolveTurn.ts. Aqui é só a regra pura.
 */
export function applyDuelAction(params: ApplyDuelActionParams): DuelResult {
  const { typeChart, rng } = params;
  const state = cloneState(params.state);
  const events: DuelEvent[] = [];

  if (params.action.userId !== state.activeUserId) {
    throw new Error(`não é a vez de ${params.action.userId}`);
  }

  const attackerSide = sideOf(state, state.activeUserId);
  const defenderSide = otherSide(state, state.activeUserId);
  const attacker = attackerSide.active;
  const defender = defenderSide.active;

  let winnerId: string | null = null;

  if (params.action.type === "CARD") {
    const chosen = attacker.moves[params.action.cardSlot];

    // PP: mesma regra do engine antigo. Carta sem PP com OUTRA disponível é
    // jogada inválida (o command já barra; isto é a rede de baixo) → passa em
    // branco. NENHUMA carta com PP → STRUGGLE, senão o jogador ficaria travado.
    let card = chosen;
    if (!card || (card.currentPp <= 0 && hasUsableCard(attacker))) {
      events.push({ type: "hesitate", userId: state.activeUserId });
    } else {
      if (card.currentPp <= 0) card = STRUGGLE;
      // PP gasto no uso, antes de rolar acerto (errar gasta PP igual). `card` é
      // do estado clonado; STRUGGLE é compartilhado e tem PP 0 — a guarda evita
      // decrementá-lo pra -1 e vazar entre partidas.
      if (card.currentPp > 0) card.currentPp -= 1;

      const effectiveness = effectivenessMultiplier(typeChart, card.type, defender.types);
      const result = calculateDamage({ attacker, defender, move: card, effectiveness, rng });

      defender.currentHp = Math.max(0, defender.currentHp - result.damage);
      if (defender.currentHp === 0) defender.fainted = true;

      events.push({
        type: "attack",
        userId: state.activeUserId,
        cardName: card.name,
        damage: result.damage,
        effectiveness: result.effectiveness,
        isCrit: result.isCrit,
        missed: result.missed,
        targetFainted: defender.fainted,
      });

      if (defender.fainted) winnerId = state.activeUserId;
    }
  } else {
    events.push({ type: "hesitate", userId: state.activeUserId });
  }

  if (winnerId) {
    return { state, events, winnerId, finished: true };
  }

  // Passa a vez. actedThisRound conta quantos já agiram nesta rodada.
  state.actedThisRound += 1;
  if (state.actedThisRound >= 2) {
    // Rodada completa → nova rodada, iniciativa recalculada.
    state.round += 1;
    state.actedThisRound = 0;
    state.order = computeInitiative(state.sideA, state.sideB);
    state.activeUserId = state.order[0];
    events.push({ type: "roundStart", round: state.round, firstUserId: state.order[0] });
  } else {
    // Ainda falta o segundo ator: a vez é dele.
    state.activeUserId = state.order[state.actedThisRound];
  }

  return { state, events, winnerId: null, finished: false };
}
