import { accuracyFactor, effectiveStat } from "./conditions";
import { BattleMoveDef, BattlePokemonState } from "./types";

// Cálculo de dano de um golpe. É a fórmula clássica de Pokémon (a mesma dos
// jogos principais), SIMPLIFICADA. O que existe aqui é real:
//  - fórmula base de dano (nível, power, atk/def, /50 + 2)
//  - STAB (Same Type Attack Bonus, 1.5x quando o move é do mesmo tipo do atacante)
//  - efetividade de tipo (0x / 0.5x / 1x / 2x), calculada em typeChart.ts a
//    partir de dados reais da PokéAPI
//  - variância aleatória de 85%-100% no dano final (igual ao jogo)
//  - chance de crítico 1/16 com 1.5x de dano (valor de crítico "base"), somada
//    aos estágios de crítico do próprio golpe (razor-leaf e cia.)
//  - teste de accuracy (chance de errar o golpe), já pesado pelos estágios de
//    precisão do atacante e de evasão do alvo
//  - stat stages e queimadura: o atk/def que entram na fórmula são os
//    EFETIVOS (domain/conditions.ts), não os crus do snapshot
//
// O que NÃO existe (fica de fora de propósito, pra manter o sistema simples):
//  - habilidades (abilities) alterando dano/precisão/crítico
//  - itens segurados (held items)
//  - clima (chuva, sol, etc.) e barreiras (reflect/light-screen)
//  - burst de crítico 2x (usamos 1.5x, valor de gerações mais recentes)
//  - crítico ignorando os estágios de defesa do alvo

export interface DamageRollParams {
  attacker: BattlePokemonState;
  defender: BattlePokemonState;
  move: BattleMoveDef;
  effectiveness: number;
  rng: () => number; // [0, 1)
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  isCrit: boolean;
  missed: boolean;
}

const CRIT_CHANCE = 1 / 16;
const VARIANCE_MIN = 0.85;
const VARIANCE_SPAN = 0.15; // 0.85 .. 1.00

/**
 * Chance de crítico por estágio, como na série: 1/16 → 1/8 → 1/4 → 1/2. O
 * estágio vem do próprio golpe (`meta.crit_rate` da PokéAPI).
 */
const CRIT_CHANCE_BY_STAGE = [CRIT_CHANCE, 1 / 8, 1 / 4, 1 / 2];

function critChanceFor(stage: number): number {
  return CRIT_CHANCE_BY_STAGE[Math.min(Math.max(0, Math.floor(stage)), CRIT_CHANCE_BY_STAGE.length - 1)];
}

/**
 * Rola o acerto. `null` nunca erra (e nem estágio muda isso — é assim na série:
 * swift acerta mesmo contra evasão no talo).
 */
export function rollAccuracy(
  move: BattleMoveDef,
  attacker: BattlePokemonState,
  defender: BattlePokemonState,
  rng: () => number
): boolean {
  if (move.accuracy == null) return true;
  return rng() * 100 < move.accuracy * accuracyFactor(attacker, defender);
}

function rollCrit(rng: () => number, critChance = CRIT_CHANCE): boolean {
  return rng() < critChance;
}

/**
 * O tranco que a confusão dá em quem está confuso: um golpe físico de poder 40
 * SEM tipo — não tem STAB, não tem efetividade e nunca crita. Usa o Ataque e a
 * Defesa do próprio pokémon, como na série.
 */
export const CONFUSION_POWER = 40;

export function confusionSelfDamage(mon: BattlePokemonState, rng: () => number): number {
  const atk = effectiveStat(mon, "attack");
  const def = effectiveStat(mon, "defense");
  const base = Math.floor((Math.floor((2 * mon.level) / 5 + 2) * CONFUSION_POWER * (atk / def)) / 50) + 2;
  return Math.max(1, Math.floor(base * (VARIANCE_MIN + rng() * VARIANCE_SPAN)));
}

/** Fórmula simplificada do jogo: STAB, efetividade de tipo, variância 85-100%, crítico e accuracy. */
export function calculateDamage(params: DamageRollParams): DamageResult {
  const { attacker, defender, move, effectiveness, rng } = params;

  // Move de status não causa dano: efetividade de tipo não se aplica a ele.
  // Reportar o multiplicador recebido (ex: psychic 2x vs poison) fazia o log
  // dizer "0 de dano, super eficaz" — contradição — e disparava a animação de
  // super efetivo. Neutro (1) some o label; imunidade de move de DANO segue
  // abaixo, tratada separado, pra "sem efeito" continuar aparecendo.
  if (move.damageClass === "status" || !move.power) {
    return { damage: 0, effectiveness: 1, isCrit: false, missed: false };
  }

  if (!rollAccuracy(move, attacker, defender, rng)) {
    return { damage: 0, effectiveness, isCrit: false, missed: true };
  }

  if (effectiveness === 0) {
    return { damage: 0, effectiveness, isCrit: false, missed: false };
  }

  const isCrit = rollCrit(rng, critChanceFor(move.effect?.critStage ?? 0));
  const isPhysical = move.damageClass === "physical";
  // Atributo EFETIVO: já com stat stage e, no Ataque, com a queimadura cortando
  // pela metade. É o que faz um swords-dance valer o turno que ele custa.
  const atkStat = isPhysical
    ? effectiveStat(attacker, "attack")
    : effectiveStat(attacker, "specialAttack");
  const defStat = isPhysical
    ? effectiveStat(defender, "defense")
    : effectiveStat(defender, "specialDefense");

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const variance = VARIANCE_MIN + rng() * VARIANCE_SPAN;
  const critMultiplier = isCrit ? 1.5 : 1;

  const base =
    Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50) + 2;

  const damage = Math.max(1, Math.floor(base * stab * effectiveness * variance * critMultiplier));

  return { damage, effectiveness, isCrit, missed: false };
}
