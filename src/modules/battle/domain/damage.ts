import { BattleMoveDef, BattlePokemonState } from "./types";

// Cálculo de dano de um golpe. É a fórmula clássica de Pokémon (a mesma dos
// jogos principais), SIMPLIFICADA. O que existe aqui é real:
//  - fórmula base de dano (nível, power, atk/def, /50 + 2)
//  - STAB (Same Type Attack Bonus, 1.5x quando o move é do mesmo tipo do atacante)
//  - efetividade de tipo (0x / 0.5x / 1x / 2x), calculada em typeChart.ts a
//    partir de dados reais da PokéAPI
//  - variância aleatória de 85%-100% no dano final (igual ao jogo)
//  - chance de crítico 1/16 com 1.5x de dano (valor de crítico "base", sem
//    itens/habilidades que aumentam a chance)
//  - teste de accuracy (chance de errar o golpe)
//
// O que NÃO existe (fica de fora de propósito, pra manter o sistema simples):
//  - habilidades (abilities) alterando dano/precisão/crítico
//  - itens segurados (held items)
//  - clima (chuva, sol, etc.)
//  - status alterados (queimadura reduzindo ataque, paralisia, veneno, sono...)
//  - burst de crítico 2x (usamos 1.5x, valor de gerações mais recentes)
//  - moves de efeito (status moves são reconhecidos mas não fazem nada além de dano zero)

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

export function rollAccuracy(move: BattleMoveDef, rng: () => number): boolean {
  const accuracy = move.accuracy ?? 100;
  return rng() * 100 < accuracy;
}

export function rollCrit(rng: () => number, critChance = CRIT_CHANCE): boolean {
  return rng() < critChance;
}

/** Fórmula simplificada do jogo: STAB, efetividade de tipo, variância 85-100%, crítico e accuracy. */
export function calculateDamage(params: DamageRollParams): DamageResult {
  const { attacker, defender, move, effectiveness, rng } = params;

  if (move.damageClass === "status" || !move.power) {
    return { damage: 0, effectiveness, isCrit: false, missed: false };
  }

  if (!rollAccuracy(move, rng)) {
    return { damage: 0, effectiveness, isCrit: false, missed: true };
  }

  if (effectiveness === 0) {
    return { damage: 0, effectiveness, isCrit: false, missed: false };
  }

  const isCrit = rollCrit(rng);
  const isPhysical = move.damageClass === "physical";
  const atkStat = isPhysical ? attacker.stats.attack : attacker.stats.specialAttack;
  const defStat = isPhysical ? defender.stats.defense : defender.stats.specialDefense;

  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const variance = VARIANCE_MIN + rng() * VARIANCE_SPAN;
  const critMultiplier = isCrit ? 1.5 : 1;

  const base =
    Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * (atkStat / defStat)) / 50) + 2;

  const damage = Math.max(1, Math.floor(base * stab * effectiveness * variance * critMultiplier));

  return { damage, effectiveness, isCrit, missed: false };
}
