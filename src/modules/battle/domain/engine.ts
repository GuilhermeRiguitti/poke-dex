import { calculateDamage } from "./damage";
import { effectivenessMultiplier, TypeEffectivenessMap } from "./typeChart";
import {
  BattleAction,
  BattleEvent,
  BattleMoveDef,
  BattlePokemonState,
  BattleSideLabel,
  BattleSideState,
  BattleState,
} from "./types";

// Motor de batalha PURO: recebe um BattleState + a jogada de cada lado e
// devolve o novo estado. Não toca em banco, rede, nem Math.random direto
// (rng é injetado) — por isso dá pra testar de forma determinística
// (ver engine.test.ts) e é chamado a partir de resolve.ts, que é quem
// integra isso com o Prisma.
//
// Tudo aqui é regra NOSSA (não existe "PokéAPI de regras de batalha"; a API
// só fornece dados de pokémon/moves/tipos, não como o combate deve rodar).
// Simplificações importantes em relação ao jogo oficial:
//  - só 1x1 (sem duplas), sem terreno/clima, sem itens/habilidades
//  - ordem do turno: trocas primeiro (sempre), depois ataques por
//    prioridade do move e, empatando, por velocidade; empate total = 50/50 no rng
//  - se o ativo desmaiar, o dono é OBRIGADO a trocar no próximo turno
//    (ver needsSwitch) — não existe "sem pokémon pra mandar, perde na hora"
//    aqui dentro; quem decide fim de jogo por falta de troca é a camada de
//    cima (resolve.ts / rotas da API)
//  - sem status alterados (veneno, sono, paralisia...)
//  - PP é gasto de verdade (ver executeAttack), mas não há éter/restauração:
//    zerou, zerou até o fim da partida.

/**
 * Golpe de último recurso, quando NENHUM golpe do ativo tem PP.
 *
 * Sem isso, um pokémon sem PP não teria ação nenhuma: o jogador não conseguiria
 * atacar, e se também não pudesse trocar (resto do time desmaiado) ficaria
 * travado sem jogada válida — e três turnos sem jogar é derrota por abandono
 * (MAX_CONSECUTIVE_MISSES). Ou seja: sem struggle, acabar o PP viraria uma
 * forma de PERDER a partida sem poder fazer nada.
 *
 * Não vem da PokéAPI: os valores são nossos (o struggle real tem recuo, que
 * este sistema não modela). Espelha o fallback de buildTeamSnapshot.
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

/** true se o pokémon ainda tem ao menos um golpe com PP. */
function hasUsableMove(mon: BattlePokemonState): boolean {
  return mon.moves.some((m) => m.currentPp > 0);
}

export interface ResolveTurnParams {
  state: BattleState;
  actionA: BattleAction;
  actionB: BattleAction;
  typeChart: TypeEffectivenessMap;
  rng: () => number;
}

export interface ResolveTurnResult {
  state: BattleState;
  events: BattleEvent[];
  winner: BattleSideLabel | null;
  /** true quando o ativo desse lado desmaiou e o time ainda tem substitutos — próxima ação obrigatoriamente é SWITCH */
  needsSwitch: { A: boolean; B: boolean };
}

function cloneState(state: BattleState): BattleState {
  return JSON.parse(JSON.stringify(state)) as BattleState;
}

function getActive(side: BattleSideState): BattlePokemonState {
  const mon = side.team.find((p) => p.slot === side.activeSlot);
  if (!mon) throw new Error(`No pokemon in active slot ${side.activeSlot}`);
  return mon;
}

/** Ativo desmaiado + ação MOVE não é válido (não dá pra atacar desmaiado) — vira NONE. */
function sanitizeAction(side: BattleSideState, action: BattleAction): BattleAction {
  if (action.type === "MOVE" && getActive(side).fainted) return { type: "NONE" };
  return action;
}

function applySwitch(side: BattleSideState, action: BattleAction, label: BattleSideLabel, events: BattleEvent[]) {
  if (action.type !== "SWITCH") return;
  const target = side.team.find((p) => p.slot === action.toSlot);
  if (!target || target.fainted) return;
  side.activeSlot = action.toSlot;
  events.push({ type: "switch", side: label, toSlot: action.toSlot, pokemonName: target.name });
}

/** Só existem 2 combatentes por turno — decide a ordem sem precisar de sort genérico. */
function determineAttackOrder(
  actionA: BattleAction,
  actionB: BattleAction,
  monA: BattlePokemonState,
  monB: BattlePokemonState,
  rng: () => number
): BattleSideLabel[] {
  const priorityA = actionA.type === "MOVE" ? monA.moves[actionA.moveSlot]?.priority ?? 0 : -Infinity;
  const priorityB = actionB.type === "MOVE" ? monB.moves[actionB.moveSlot]?.priority ?? 0 : -Infinity;

  if (priorityA !== priorityB) return priorityA > priorityB ? ["A", "B"] : ["B", "A"];
  if (monA.stats.speed !== monB.stats.speed) {
    return monA.stats.speed > monB.stats.speed ? ["A", "B"] : ["B", "A"];
  }
  return rng() < 0.5 ? ["A", "B"] : ["B", "A"];
}

function executeAttack(
  attackerSide: BattleSideState,
  defenderSide: BattleSideState,
  action: BattleAction,
  attackerLabel: BattleSideLabel,
  typeChart: TypeEffectivenessMap,
  rng: () => number,
  events: BattleEvent[]
) {
  if (action.type !== "MOVE") {
    events.push({ type: "noAction", side: attackerLabel });
    return;
  }

  const attacker = getActive(attackerSide);
  const defender = getActive(defenderSide);
  if (attacker.fainted || defender.fainted) return; // desmaiou nesse turno antes de agir

  const chosen = attacker.moves[action.moveSlot];
  if (!chosen) {
    events.push({ type: "noAction", side: attackerLabel });
    return;
  }

  // PP: quem decide o que fazer com um golpe sem PP é aqui, não a rota.
  //  - ainda há OUTRO golpe com PP => a jogada é inválida (submitMove já barra;
  //    isto é a rede de baixo) e o turno passa em branco.
  //  - NENHUM golpe tem PP => struggle, senão o jogador ficaria sem ação e
  //    perderia por abandono. Ver STRUGGLE.
  let move = chosen;
  if (move.currentPp <= 0) {
    if (hasUsableMove(attacker)) {
      events.push({ type: "noAction", side: attackerLabel });
      return;
    }
    move = STRUGGLE;
  }

  // O PP é gasto no MOMENTO DO USO, antes de rolar acerto: errar o golpe gasta
  // PP igual (é assim no jogo). `attacker` é do estado JÁ CLONADO por
  // resolveTurn, então isto muta o novo estado, não o que veio do banco.
  // STRUGGLE tem currentPp 0 e é um objeto compartilhado — a guarda impede que
  // ele seja decrementado (viraria -1 e vazaria entre partidas).
  if (move.currentPp > 0) move.currentPp -= 1;

  // effectiveness = multiplicador de tipo (dado real da PokéAPI, via typeChart).
  // calculateDamage aplica a fórmula de dano (nossa, ver damage.ts) em cima disso.
  const effectiveness = effectivenessMultiplier(typeChart, move.type, defender.types);
  const result = calculateDamage({ attacker, defender, move, effectiveness, rng });

  defender.currentHp = Math.max(0, defender.currentHp - result.damage);
  if (defender.currentHp === 0) defender.fainted = true;

  events.push({
    type: "attack",
    side: attackerLabel,
    moveName: move.name,
    damage: result.damage,
    effectiveness: result.effectiveness,
    isCrit: result.isCrit,
    missed: result.missed,
    targetFainted: defender.fainted,
  });
}

function sideHasSurvivors(side: BattleSideState): boolean {
  return side.team.some((p) => !p.fainted);
}

export function resolveTurn(params: ResolveTurnParams): ResolveTurnResult {
  const { typeChart, rng } = params;
  const state = cloneState(params.state);
  const events: BattleEvent[] = [];

  const actionA = sanitizeAction(state.sideA, params.actionA);
  const actionB = sanitizeAction(state.sideB, params.actionB);

  // 1. Trocas sempre antes de ataques
  applySwitch(state.sideA, actionA, "A", events);
  applySwitch(state.sideB, actionB, "B", events);

  // 2. Ataques na ordem de prioridade/velocidade (quem trocou não ataca nesse turno)
  const monA = getActive(state.sideA);
  const monB = getActive(state.sideB);
  const order = determineAttackOrder(
    actionA.type === "SWITCH" ? { type: "NONE" } : actionA,
    actionB.type === "SWITCH" ? { type: "NONE" } : actionB,
    monA,
    monB,
    rng
  );

  for (const label of order) {
    const isA = label === "A";
    const action = isA ? actionA : actionB;
    if (action.type === "SWITCH") continue; // já resolvido, sem ataque nesse turno
    executeAttack(
      isA ? state.sideA : state.sideB,
      isA ? state.sideB : state.sideA,
      action,
      label,
      typeChart,
      rng,
      events
    );
  }

  state.turnNumber += 1;

  const aAlive = sideHasSurvivors(state.sideA);
  const bAlive = sideHasSurvivors(state.sideB);
  const winner: BattleSideLabel | null = !aAlive ? "B" : !bAlive ? "A" : null;

  const needsSwitch = {
    A: aAlive && getActive(state.sideA).fainted,
    B: bAlive && getActive(state.sideB).fainted,
  };

  return { state, events, winner, needsSwitch };
}
