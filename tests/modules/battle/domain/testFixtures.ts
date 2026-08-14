import { emptyConditions } from "@/src/modules/battle/domain/conditions";
import type { MoveEffect } from "@/src/modules/battle/domain/moveEffect";
import { BattleMoveDef, BattlePokemonState } from "@/src/modules/battle/domain/types";

// Helpers só pra testes (duelEngine.test.ts, damage.test.ts): montam pokémon e
// cartas de batalha com valores fake/redondos, sem tocar em PokéAPI nem banco.
// Nada aqui reflete dados reais de pokémon.

let nextMoveId = 1;

export function makeMove(overrides: Partial<BattleMoveDef> = {}): BattleMoveDef {
  return {
    id: nextMoveId++,
    name: "tackle",
    type: "normal",
    power: 80,
    accuracy: 100,
    damageClass: "physical",
    priority: 0,
    maxPp: 15,
    currentPp: 15,
    ...overrides,
  };
}

/**
 * Um efeito de carta "vazio", pra o teste preencher só o que interessa. Os
 * defaults são os de um golpe sem efeito nenhum — chance 100 e 1 acerto — pra
 * que `makeEffect({ ailment: "burn" })` queime SEMPRE e o teste não precise de
 * rng pra provar o que quer provar.
 */
export function makeEffect(overrides: Partial<MoveEffect> = {}): MoveEffect {
  return {
    ailment: null,
    ailmentChance: 100,
    ailmentMinTurns: null,
    ailmentMaxTurns: null,
    stageChanges: [],
    stageChance: 100,
    stageTarget: "foe",
    flinchChance: 0,
    healPct: 0,
    drainPct: 0,
    critStage: 0,
    minHits: 1,
    maxHits: 1,
    protects: false,
    ...overrides,
  };
}

export function makeMon(overrides: Partial<BattlePokemonState> = {}): BattlePokemonState {
  const maxHp = overrides.maxHp ?? 100;
  return {
    slot: 1,
    pokemonId: 1,
    name: "test-mon",
    types: ["normal"],
    level: 50,
    stats: {
      hp: maxHp,
      attack: 100,
      defense: 100,
      specialAttack: 100,
      specialDefense: 100,
      speed: 50,
    },
    maxHp,
    currentHp: maxHp,
    fainted: false,
    moves: [makeMove()],
    conditions: emptyConditions(),
    ...overrides,
  };
}

/** RNG que devolve valores fixos, na ordem, e falha se consumida além do esperado (protege contra rolagens não intencionais). */
export function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng sequence exhausted after ${values.length} calls`);
    return values[i++];
  };
}

export function throwingRng(): () => number {
  return () => {
    throw new Error("rng should not have been called");
  };
}
