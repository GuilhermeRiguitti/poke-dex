import { BattleMoveDef, BattlePokemonState } from "./types";

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
