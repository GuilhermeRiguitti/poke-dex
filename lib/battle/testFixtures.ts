import { BattleMoveDef, BattlePokemonState, BattleSideState, BattleState } from "./types";

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
    ...overrides,
  };
}

export function makeSide(overrides: Partial<BattleSideState> = {}): BattleSideState {
  return {
    userId: "user-a",
    activeSlot: 1,
    team: [makeMon()],
    ...overrides,
  };
}

export function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    turnNumber: 1,
    sideA: makeSide({ userId: "user-a" }),
    sideB: makeSide({ userId: "user-b" }),
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
