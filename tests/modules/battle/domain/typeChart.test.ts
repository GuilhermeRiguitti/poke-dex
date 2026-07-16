import { describe, expect, it } from "vitest";
import { effectivenessMultiplier, TypeEffectivenessMap } from "@/src/modules/battle/domain/typeChart";

const chart: TypeEffectivenessMap = {
  fire: { grass: 2, water: 0.5, fire: 0.5 },
  water: { fire: 2, grass: 0.5 },
};

describe("effectivenessMultiplier", () => {
  it("retorna o multiplicador direto contra um único tipo", () => {
    expect(effectivenessMultiplier(chart, "fire", ["grass"])).toBe(2);
    expect(effectivenessMultiplier(chart, "fire", ["water"])).toBe(0.5);
  });

  it("multiplica os dois tipos do defensor (dual-type)", () => {
    expect(effectivenessMultiplier(chart, "fire", ["grass", "water"])).toBeCloseTo(1);
  });

  it("assume 1 (neutro) quando o par não está no chart", () => {
    expect(effectivenessMultiplier(chart, "normal", ["grass"])).toBe(1);
  });
});
