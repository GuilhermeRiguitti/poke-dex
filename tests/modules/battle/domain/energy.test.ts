import { describe, expect, it } from "vitest";
import {
  ENERGY_MAX,
  ENERGY_PER_ROUND,
  ENERGY_START,
  affordableSlots,
  canAfford,
  energyCostOf,
  hasAffordableCard,
  regenEnergy,
} from "@/src/modules/battle/domain/energy";
import type { BattleMoveDef } from "@/src/modules/battle/domain/types";

function card(over: Partial<BattleMoveDef> = {}): BattleMoveDef {
  return {
    id: 1,
    name: "tackle",
    type: "normal",
    power: 40,
    accuracy: 100,
    damageClass: "physical",
    priority: 0,
    maxPp: 35,
    currentPp: 35,
    ...over,
  };
}

describe("energyCostOf", () => {
  it("cobra por faixa de poder", () => {
    expect(energyCostOf(card({ power: 40 }))).toBe(1);
    expect(energyCostOf(card({ power: 60 }))).toBe(1); // borda de cima da faixa
    expect(energyCostOf(card({ power: 61 }))).toBe(2);
    expect(energyCostOf(card({ power: 90 }))).toBe(2);
    expect(energyCostOf(card({ power: 91 }))).toBe(3);
    expect(energyCostOf(card({ power: 250 }))).toBe(3);
  });

  it("carta de status custa o mínimo", () => {
    // Quem usa status já paga o preço de não causar dano no turno; cobrar caro
    // por cima tiraria a única alternativa de quem está sem energia.
    expect(energyCostOf(card({ damageClass: "status", power: null }))).toBe(1);
  });

  it("poder nulo ou zero não vira NaN nem custo negativo", () => {
    expect(energyCostOf(card({ power: null }))).toBe(1);
    expect(energyCostOf(card({ power: 0 }))).toBe(1);
  });

  it("NENHUMA carta custa zero", () => {
    // O piso de 1 + o regen de 1 por rodada são o que garante que sempre existe
    // jogada possível. Custo 0 quebraria a economia por outro lado (spam), mas o
    // que importa aqui é o piso existir.
    for (const power of [null, 0, 1, 40, 60, 90, 120, 250]) {
      expect(energyCostOf(card({ power }))).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("regenEnergy", () => {
  it("devolve o combinado por rodada", () => {
    expect(regenEnergy(0)).toBe(ENERGY_PER_ROUND);
    expect(regenEnergy(2)).toBe(2 + ENERGY_PER_ROUND);
  });

  it("não passa do teto", () => {
    // Sem teto, quem trocasse de pokémon várias rodadas juntaria energia
    // infinita e a mecânica deixaria de ser um limite.
    expect(regenEnergy(ENERGY_MAX)).toBe(ENERGY_MAX);
    expect(regenEnergy(ENERGY_MAX + 5)).toBe(ENERGY_MAX);
  });
});

describe("canAfford / affordableSlots", () => {
  it("pagar exatamente o custo é permitido", () => {
    expect(canAfford(2, 2)).toBe(true);
    expect(canAfford(1, 2)).toBe(false);
  });

  it("carta sem PP não conta como pagável, mesmo sendo barata", () => {
    // É o que impede a barra inteira de ser desabilitada em vez de cair no
    // struggle quando a única carta barata está zerada.
    const moves = [card({ power: 120, currentPp: 5 }), card({ power: 40, currentPp: 0 })];
    expect(affordableSlots(moves, 1)).toEqual([]);
    expect(hasAffordableCard(moves, 1)).toBe(false);
  });

  it("lista os índices que dá pra pagar agora", () => {
    const moves = [
      card({ power: 40 }), // custa 1
      card({ power: 120 }), // custa 3
      card({ power: 70 }), // custa 2
    ];
    expect(affordableSlots(moves, 2)).toEqual([0, 2]);
    expect(affordableSlots(moves, 3)).toEqual([0, 1, 2]);
    expect(affordableSlots(moves, 0)).toEqual([]);
  });
});

describe("os números do começo", () => {
  it("o jogador entra com energia pra jogar a carta mais cara", () => {
    // Se ENERGY_START ficasse abaixo do custo máximo, o round 1 começaria com a
    // carta grande já bloqueada — o que não é tensão, é confusão.
    expect(ENERGY_START).toBeGreaterThanOrEqual(energyCostOf(card({ power: 250 })));
  });

  it("o teto é maior que o início, senão o acúmulo não existe", () => {
    expect(ENERGY_MAX).toBeGreaterThan(ENERGY_START);
  });
});
